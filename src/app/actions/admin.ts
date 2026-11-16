"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SkillCategory, VerificationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { enqueueEmail } from "@/lib/email";
import { appUrl } from "@/lib/url";
import { runWeeklyDigests } from "@/lib/digest";
import { canTransition } from "@/lib/verification/state";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

const taxonomySchema = z.object({
  name: z.string().trim().min(2, "Skill name is required").max(60),
  category: z.enum(["model_type", "framework", "deployment", "data", "other"]),
});

export async function createTaxonomyAction(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const parsed = taxonomySchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
  });
  const back = "/admin/taxonomy";
  if (!parsed.success) fail(back, parsed.error.issues[0].message);

  const existing = await db.skillTaxonomy.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    if (!existing.active) {
      await db.skillTaxonomy.update({ where: { id: existing.id }, data: { active: true } });
      await audit({ actorUserId: admin.id, action: "admin.taxonomy_reactivated", entityType: "taxonomy", entityId: existing.id });
      ok(back, `${existing.name} reactivated`);
    }
    fail(back, "That skill already exists");
  }

  const created = await db.skillTaxonomy.create({
    data: { name: parsed.data.name, category: parsed.data.category as SkillCategory },
  });
  await audit({ actorUserId: admin.id, action: "admin.taxonomy_created", entityType: "taxonomy", entityId: created.id });
  revalidatePath(back);
  ok(back, `${created.name} added to the vocabulary`);
}

export async function toggleTaxonomyAction(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const id = String(formData.get("taxonomyId") ?? "");
  const skill = await db.skillTaxonomy.findUnique({ where: { id } });
  if (!skill) fail("/admin/taxonomy", "Skill not found");
  await db.skillTaxonomy.update({ where: { id }, data: { active: !skill.active } });
  await audit({
    actorUserId: admin.id,
    action: skill.active ? "admin.taxonomy_deactivated" : "admin.taxonomy_reactivated",
    entityType: "taxonomy",
    entityId: id,
  });
  revalidatePath("/admin/taxonomy");
  ok("/admin/taxonomy", skill.active ? "Skill deactivated (existing claims kept)" : "Skill reactivated");
}

export async function decideVerificationAction(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const jobId = String(formData.get("jobId") ?? "");
  const decision = formData.get("decision") === "approve" ? "verified" : "failed";
  const reason = String(formData.get("reason") ?? "").trim();
  const back = "/admin/verification";

  if (decision === "failed" && !reason) fail(back, "A rejection needs a reason the candidate can read");

  const job = await db.verificationJob.findUnique({ where: { id: jobId } });
  if (!job) fail(back, "Verification job not found");
  if (job.status !== "manual_review") fail(back, "Only jobs in manual review can be decided here");

  if (job.entityType === "credential") {
    const credential = await db.credential.findUnique({ where: { id: job.entityId } });
    if (!credential) fail(back, "Credential not found");
    const next: VerificationStatus = decision;
    if (!canTransition(credential.verificationStatus, next)) {
      fail(back, `Illegal transition from ${credential.verificationStatus} to ${next}`);
    }
    await db.credential.update({
      where: { id: credential.id },
      data: {
        verificationStatus: next,
        failureReason: decision === "failed" ? reason : null,
        verifiedAt: decision === "verified" ? new Date() : null,
      },
    });
  } else if (job.entityType === "skill") {
    const claim = await db.skillClaim.findUnique({ where: { id: job.entityId } });
    if (!claim) fail(back, "Skill claim not found");
    const next: VerificationStatus = decision;
    if (!canTransition(claim.verificationStatus, next)) {
      fail(back, `Illegal transition from ${claim.verificationStatus} to ${next}`);
    }
    await db.skillClaim.update({
      where: { id: claim.id },
      data: {
        verificationStatus: next,
        verificationMethod: "manual",
        failureReason: decision === "failed" ? reason : null,
        verifiedAt: decision === "verified" ? new Date() : null,
      },
    });
  } else {
    fail(back, "Project verifications are automated; only credential and skill claims are manual");
  }

  await db.verificationJob.update({
    where: { id: job.id },
    data: { status: decision === "verified" ? "passed" : "failed", lastError: decision === "failed" ? reason : null },
  });

  await audit({
    actorUserId: admin.id,
    action: "admin.verification_decided",
    entityType: job.entityType,
    entityId: job.entityId,
    metadata: { decision, reason: reason || null, jobId: job.id },
  });
  revalidatePath(back);
  ok(back, decision === "verified" ? "Claim verified" : "Claim rejected with reason");
}

export async function retryJobAction(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const jobId = String(formData.get("jobId") ?? "");
  const job = await db.verificationJob.findUnique({ where: { id: jobId } });
  if (!job) fail("/admin/verification", "Job not found");
  if (!["failed", "manual_review"].includes(job.status)) fail("/admin/verification", "Only failed jobs can be retried");

  if (job.entityType === "skill") {
    const claim = await db.skillClaim.findUnique({ where: { id: job.entityId } });
    if (claim && claim.verificationStatus === "failed") {
      await db.skillClaim.update({
        where: { id: claim.id },
        data: { verificationStatus: "pending", failureReason: null },
      });
    }
  }
  if (job.entityType === "project") {
    if (job.method === "repo") {
      await db.project.update({ where: { id: job.entityId }, data: { repoStatus: "pending", repoNote: null } });
    } else {
      await db.project.update({
        where: { id: job.entityId },
        data: { deploymentStatus: "pending", deploymentNote: null },
      });
    }
  }
  await db.verificationJob.update({
    where: { id: job.id },
    data: { status: "queued", attempts: 0, lastError: null, nextRunAt: new Date() },
  });
  await audit({ actorUserId: admin.id, action: "admin.verification_retried", entityType: job.entityType, entityId: job.entityId });
  revalidatePath("/admin/verification");
  ok("/admin/verification", "Job re-queued");
}

export async function inviteCandidatesAction(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const csv = String(formData.get("csv") ?? "").trim();
  const back = "/admin/invites";
  if (!csv) fail(back, "Paste at least one email (CSV: email,name)");

  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 200);

  let created = 0;
  let skipped = 0;
  for (const line of lines) {
    const [rawEmail, rawName] = line.split(",").map((part) => part?.trim() ?? "");
    const email = rawEmail.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped += 1;
      continue;
    }
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      skipped += 1;
      continue;
    }
    const token = randomBytes(24).toString("hex");
    await db.user.create({
      data: {
        email,
        role: "candidate",
        emailVerified: true,
        inviteToken: token,
        profile: {
          create: {
            fullName: rawName || email.split("@")[0],
            contactEmailPublic: email,
          },
        },
      },
    });
    await enqueueEmail({
      to: email,
      kind: "candidate_invite",
      subject: "You're invited to build a verified ML portfolio",
      body: `Recruiters on AITalented are searching for verified AI/ML engineers. Claim your profile and set a password:\n\n${appUrl()}/invite/${token}\n\nIt takes about 10 minutes. No fees, ever, for candidates.\n\n— AITalented`,
    });
    created += 1;
  }

  await audit({
    actorUserId: admin.id,
    action: "admin.candidates_invited",
    entityType: "user",
    metadata: { created, skipped },
  });
  revalidatePath(back);
  ok(back, `${created} invite(s) queued${skipped ? `, ${skipped} skipped` : ""}`);
}

const recruiterSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid recruiter email"),
  orgName: z.string().trim().min(2, "Organisation name is required").max(80),
  seats: z.coerce.number().int().min(1).max(50),
  trialDays: z.coerce.number().int().min(0).max(90),
});

export async function createRecruiterAction(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const parsed = recruiterSchema.safeParse({
    email: formData.get("email"),
    orgName: formData.get("orgName"),
    seats: formData.get("seats") ?? 1,
    trialDays: formData.get("trialDays") ?? 14,
  });
  const back = "/admin/recruiters";
  if (!parsed.success) fail(back, parsed.error.issues[0].message);

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) fail(back, "A user with that email already exists");

  const token = randomBytes(24).toString("hex");
  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      role: "recruiter",
      emailVerified: true,
      inviteToken: token,
      recruiter: {
        create: {
          orgName: parsed.data.orgName,
          seatCount: parsed.data.seats,
          billingStatus: "trial",
          trialEndsAt: new Date(Date.now() + parsed.data.trialDays * 86_400_000),
        },
      },
    },
  });

  await enqueueEmail({
    to: user.email,
    kind: "candidate_invite",
    subject: `Your ${parsed.data.orgName} AITalented recruiter seat`,
    body: `You have been invited to the AITalented verified ML talent index (${parsed.data.seats} seat(s), ${parsed.data.trialDays}-day trial).\n\nSet your password: ${appUrl()}/invite/${token}\n\n— AITalented`,
  });

  await audit({
    actorUserId: admin.id,
    action: "admin.recruiter_created",
    entityType: "recruiterAccount",
    metadata: { email: user.email, orgName: parsed.data.orgName, seats: parsed.data.seats },
  });
  revalidatePath(back);
  ok(back, `Recruiter invited: ${user.email}`);
}

export async function updateRecruiterAction(formData: FormData): Promise<void> {
  const admin = await requireRole("admin");
  const accountId = String(formData.get("accountId") ?? "");
  const action = String(formData.get("action") ?? "");
  const back = "/admin/recruiters";

  const account = await db.recruiterAccount.findUnique({
    where: { id: accountId },
    include: { user: true },
  });
  if (!account) fail(back, "Recruiter account not found");

  if (action === "extend_trial") {
    await db.recruiterAccount.update({
      where: { id: account.id },
      data: {
        billingStatus: account.billingStatus === "active" ? "active" : "trial",
        trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
      },
    });
  } else if (action === "comp") {
    await db.recruiterAccount.update({
      where: { id: account.id },
      data: { billingStatus: "active" },
    });
  } else if (action === "suspend") {
    await db.user.update({ where: { id: account.userId }, data: { status: "suspended" } });
  } else if (action === "resume") {
    await db.user.update({ where: { id: account.userId }, data: { status: "active" } });
  } else if (action === "cancel") {
    await db.recruiterAccount.update({
      where: { id: account.id },
      data: { billingStatus: "canceled" },
    });
  } else {
    fail(back, "Unknown action");
  }

  await audit({
    actorUserId: admin.id,
    action: `admin.recruiter_${action}`,
    entityType: "recruiterAccount",
    entityId: account.id,
    metadata: { email: account.user.email },
  });
  revalidatePath(back);
  ok(back, "Recruiter account updated");
}

export async function sendDigestsNowAction(): Promise<void> {
  const admin = await requireRole("admin");
  const { sent } = await runWeeklyDigests({ force: true });
  await audit({ actorUserId: admin.id, action: "admin.digests_queued", entityType: "email", metadata: { sent } });
  revalidatePath("/admin/outbox");
  ok("/admin/outbox", `${sent} digest email(s) queued`);
}
