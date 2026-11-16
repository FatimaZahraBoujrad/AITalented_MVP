import { Prisma, type EntityType, type VerificationMethod } from "@prisma/client";
import { db } from "../db";
import { audit } from "../audit";
import { recomputeCompleteness } from "../completeness";
import { verifyGithubRepo } from "./github";
import { verifyDeploymentUrl } from "./deployment";
import type { VerificationOutcome } from "./types";
import { assertTransition } from "./state";

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_SECONDS = 30;
const RETRY_BASE = 4;

/**
 * Verification is always async (§4): mutations mark the claim pending and enqueue a job.
 * A candidate is never blocked on a verifier.
 */
export async function queueVerification(
  entityType: EntityType,
  entityId: string,
  method: VerificationMethod,
): Promise<void> {
  const existing = await db.verificationJob.findFirst({
    where: { entityType, entityId, method, status: { in: ["queued", "running"] } },
  });
  if (existing) {
    await db.verificationJob.update({
      where: { id: existing.id },
      data: { nextRunAt: new Date(), lastError: null },
    });
    return;
  }
  await db.verificationJob.create({
    data: { entityType, entityId, method, status: "queued", nextRunAt: new Date() },
  });
}

/** Mark a skill claim pending before its evidence job is enqueued. */
export async function markSkillPending(skillId: string): Promise<void> {
  const claim = await db.skillClaim.findUnique({ where: { id: skillId } });
  if (!claim) return;
  if (claim.verificationStatus === "pending") return;
  assertTransition(claim.verificationStatus, "pending");
  await db.skillClaim.update({
    where: { id: skillId },
    data: { verificationStatus: "pending", failureReason: null, verifiedAt: null },
  });
  await recomputeCompleteness(claim.profileId);
}

async function setSkillOutcome(
  skillId: string,
  next: "verified" | "failed" | "manual_review",
  method: VerificationMethod,
  failureReason?: string,
): Promise<void> {
  const claim = await db.skillClaim.findUnique({ where: { id: skillId } });
  if (!claim) return;
  if (claim.verificationStatus === next) return; // idempotent re-run
  assertTransition(claim.verificationStatus, next);
  await db.skillClaim.update({
    where: { id: skillId },
    data: {
      verificationStatus: next,
      verificationMethod: method,
      failureReason: next === "verified" ? null : failureReason ?? null,
      verifiedAt: next === "verified" ? new Date() : null,
    },
  });
  await recomputeCompleteness(claim.profileId);
}

function evidenceNote(evidence: Record<string, unknown>): string {
  const parts: string[] = [];
  if (evidence.repo) parts.push(`repo ${evidence.repo}`);
  if (evidence.commits) parts.push(`${evidence.commits} commits`);
  if (Array.isArray(evidence.languages) && evidence.languages.length) {
    parts.push(`languages: ${(evidence.languages as string[]).slice(0, 4).join(", ")}`);
  }
  if (Array.isArray(evidence.detectedMarkers) && evidence.detectedMarkers.length) {
    parts.push(`markers: ${(evidence.detectedMarkers as string[]).slice(0, 6).join(", ")}`);
  }
  if (evidence.status) parts.push(`HTTP ${evidence.status}`);
  if (evidence.latencyMs) parts.push(`${evidence.latencyMs}ms`);
  if (evidence.finalUrl) parts.push(String(evidence.finalUrl));
  if (evidence.authorshipVerified === false) parts.push("authorship not verified");
  return parts.join(" · ") || "Evidence recorded";
}

async function applyProjectOutcome(
  job: { id: string; entityId: string; method: VerificationMethod; attempts: number },
  outcome: VerificationOutcome,
): Promise<void> {
  const project = await db.project.findUnique({ where: { id: job.entityId } });
  if (!project) return;

  const isRepo = job.method === "repo";
  const note = outcome.ok ? evidenceNote(outcome.evidence) : outcome.reason;

  if (!outcome.ok && outcome.retryable && job.attempts < MAX_ATTEMPTS) {
    await scheduleRetry(job, outcome.reason);
    return;
  }

  await db.project.update({
    where: { id: project.id },
    data: isRepo
      ? {
          repoStatus: outcome.ok ? "verified" : "failed",
          repoVerified: outcome.ok,
          repoNote: note,
        }
      : {
          deploymentStatus: outcome.ok ? "verified" : "failed",
          deploymentVerified: outcome.ok,
          deploymentNote: note,
        },
  });
  await db.verificationJob.update({
    where: { id: job.id },
    data: { status: outcome.ok ? "passed" : "failed", lastError: outcome.ok ? null : outcome.reason },
  });
  await audit({
    actorUserId: null,
    action: outcome.ok ? "verification.passed" : "verification.failed",
    entityType: "project",
    entityId: project.id,
    metadata: { method: job.method, note },
  });
}

async function scheduleRetry(
  job: { id: string; attempts: number },
  reason: string,
): Promise<void> {
  const delaySeconds = BACKOFF_BASE_SECONDS * Math.pow(RETRY_BASE, Math.max(job.attempts - 1, 0));
  await db.verificationJob.update({
    where: { id: job.id },
    data: {
      status: "queued",
      lastError: reason,
      nextRunAt: new Date(Date.now() + delaySeconds * 1000),
    },
  });
}

/** The worker claims a job (attempts already incremented) and calls this. */
export async function processVerificationJob(jobId: string): Promise<void> {
  const job = await db.verificationJob.findUnique({ where: { id: jobId } });
  if (!job || job.status !== "running") return;

  try {
    if (job.entityType === "credential" || job.method === "credential") {
      if (job.entityType === "credential") {
        await db.credential.update({
          where: { id: job.entityId },
          data: { verificationStatus: "manual_review" },
        });
      }
      await db.verificationJob.update({ where: { id: job.id }, data: { status: "manual_review" } });
      return;
    }

    let outcome: VerificationOutcome;

    if (job.entityType === "skill") {
      const claim = await db.skillClaim.findUnique({ where: { id: job.entityId } });
      if (!claim) {
        await db.verificationJob.update({
          where: { id: job.id },
          data: { status: "failed", lastError: "Skill claim no longer exists" },
        });
        return;
      }

      outcome =
        job.method === "repo"
          ? await verifyGithubRepo(claim.evidenceRef, claim.skillName)
          : await verifyDeploymentUrl(claim.evidenceRef);

      if (!outcome.ok && outcome.retryable && job.attempts < MAX_ATTEMPTS) {
        await scheduleRetry(job, outcome.reason);
        return;
      }

      await setSkillOutcome(
        claim.id,
        outcome.ok ? "verified" : "failed",
        job.method,
        outcome.ok ? undefined : outcome.reason,
      );
      await db.verificationJob.update({
        where: { id: job.id },
        data: { status: outcome.ok ? "passed" : "failed", lastError: outcome.ok ? null : outcome.reason },
      });
      await audit({
        actorUserId: null,
        action: outcome.ok ? "verification.passed" : "verification.failed",
        entityType: "skill",
        entityId: claim.id,
        metadata: { method: job.method, skill: claim.skillName, reason: outcome.ok ? null : outcome.reason },
      });
      return;
    }

    // Project (repo or deployment)
    const project = await db.project.findUnique({ where: { id: job.entityId } });
    if (!project) {
      await db.verificationJob.update({
        where: { id: job.id },
        data: { status: "failed", lastError: "Project no longer exists" },
      });
      return;
    }

    outcome =
      job.method === "repo"
        ? await verifyGithubRepo(project.repoUrl)
        : await verifyDeploymentUrl(project.deploymentUrl);

    await applyProjectOutcome(
      { id: job.id, entityId: job.entityId, method: job.method, attempts: job.attempts },
      outcome,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unhandled verifier error";
    if (job.attempts < MAX_ATTEMPTS) {
      await scheduleRetry(job, reason);
    } else {
      await db.verificationJob.update({
        where: { id: job.id },
        data: { status: "failed", lastError: reason },
      });
      if (job.entityType === "skill") {
        await setSkillOutcome(job.entityId, "failed", job.method, reason);
      }
    }
  }
}

/** Atomically claim queued jobs for this worker process. */
export async function claimJobs(limit = 3): Promise<string[]> {
  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    UPDATE "VerificationJob"
    SET status = 'running', attempts = attempts + 1, "updatedAt" = now()
    WHERE id IN (
      SELECT id FROM "VerificationJob"
      WHERE status = 'queued' AND "nextRunAt" <= now()
      ORDER BY "nextRunAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id
  `);
  return rows.map((r) => r.id);
}

/** Recover jobs orphaned by a worker restart. */
export async function requeueStuckJobs(): Promise<void> {
  await db.$executeRaw`
    UPDATE "VerificationJob"
    SET status = 'queued', "updatedAt" = now()
    WHERE status = 'running' AND "updatedAt" < now() - interval '5 minutes'
  `;
}
