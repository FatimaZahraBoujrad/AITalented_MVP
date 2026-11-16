"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ProjectScale, SeniorityBand, CurrentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { recomputeCompleteness } from "@/lib/completeness";
import { enqueueEmail } from "@/lib/email";
import { queueVerification, markSkillPending } from "@/lib/verification/engine";

const BUILDER = "/candidate/profile";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function ok(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function detectMethod(url: string): "repo" | "deployment" | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (parsed.hostname === "github.com" || parsed.hostname === "www.github.com") return "repo";
    return "deployment";
  } catch {
    return null;
  }
}

async function currentProfile() {
  const user = await requireRole("candidate");
  if (!user.profile) redirect("/candidate");
  return { user, profile: user.profile };
}

const basicsSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required").max(80),
  headline: z.string().trim().max(120, "Headline must be 120 characters or fewer"),
  location: z.string().trim().max(80),
  yearsExperience: z.coerce.number().int().min(0).max(40),
  seniorityBand: z.enum(["junior", "mid"]),
  currentStatus: z.enum(["open", "employed", "not_looking"]),
  contactEmailPublic: z
    .union([z.string().trim().email("Public contact email is invalid"), z.literal("")])
    .optional(),
});

export async function saveBasicsAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const parsed = basicsSchema.safeParse({
    fullName: formData.get("fullName"),
    headline: formData.get("headline"),
    location: formData.get("location"),
    yearsExperience: formData.get("yearsExperience") ?? 0,
    seniorityBand: formData.get("seniorityBand"),
    currentStatus: formData.get("currentStatus"),
    contactEmailPublic: formData.get("contactEmailPublic") ?? "",
  });
  if (!parsed.success) fail(BUILDER, parsed.error.issues[0].message);

  await db.candidateProfile.update({
    where: { id: profile.id },
    data: {
      fullName: parsed.data.fullName,
      headline: parsed.data.headline,
      location: parsed.data.location,
      yearsExperience: parsed.data.yearsExperience,
      seniorityBand: parsed.data.seniorityBand as SeniorityBand,
      currentStatus: parsed.data.currentStatus as CurrentStatus,
      contactEmailPublic: parsed.data.contactEmailPublic || null,
    },
  });
  await recomputeCompleteness(profile.id);
  await audit({ actorUserId: user.id, action: "candidate.basics_saved", entityType: "profile", entityId: profile.id });
  ok(BUILDER, "Basics saved");
}

export async function toggleVisibilityAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const visible = formData.get("visible") === "true";
  await db.candidateProfile.update({ where: { id: profile.id }, data: { visible } });
  await audit({
    actorUserId: user.id,
    action: visible ? "candidate.profile_visible" : "candidate.profile_hidden",
    entityType: "profile",
    entityId: profile.id,
  });
  ok("/candidate", visible ? "Profile is visible to recruiters" : "Profile hidden from recruiters");
}

const skillSchema = z.object({
  taxonomyId: z.string().min(1),
  evidenceRef: z.string().trim().max(500).optional(),
});

export async function addSkillAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const parsed = skillSchema.safeParse({
    taxonomyId: formData.get("taxonomyId"),
    evidenceRef: formData.get("evidenceRef") ?? "",
  });
  if (!parsed.success) fail(BUILDER, "Choose a skill from the vocabulary");

  const skill = await db.skillTaxonomy.findUnique({ where: { id: parsed.data.taxonomyId } });
  if (!skill || !skill.active) fail(BUILDER, "That skill is not in the active vocabulary");

  const evidence = parsed.data.evidenceRef?.trim() ?? "";
  const method = evidence ? detectMethod(evidence) : null;
  if (evidence && !method) fail(BUILDER, "Evidence must be a public GitHub repo or deployment URL");

  const existing = await db.skillClaim.findUnique({
    where: { profileId_skillName: { profileId: profile.id, skillName: skill.name } },
  });
  if (existing?.verificationStatus === "verified") fail(BUILDER, `${skill.name} is already verified`);

  const claim = existing
    ? await db.skillClaim.update({
        where: { id: existing.id },
        data: {
          skillCategory: skill.category,
          evidenceRef: evidence || existing.evidenceRef,
          verificationMethod: method ?? existing.verificationMethod,
          failureReason: null,
          selfReported: !evidence,
        },
      })
    : await db.skillClaim.create({
        data: {
          profileId: profile.id,
          skillName: skill.name,
          skillCategory: skill.category,
          selfReported: !evidence,
          evidenceRef: evidence || null,
          verificationMethod: method,
          verificationStatus: "unverified",
        },
      });

  if (evidence && method) {
    await markSkillPending(claim.id);
    await queueVerification("skill", claim.id, method);
  }

  await recomputeCompleteness(profile.id);
  await audit({
    actorUserId: user.id,
    action: "candidate.skill_added",
    entityType: "skill",
    entityId: claim.id,
    metadata: { skill: skill.name, evidence: Boolean(evidence) },
  });
  ok(BUILDER, evidence ? `${skill.name} queued for verification` : `${skill.name} added as self-reported`);
}

export async function removeSkillAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const skillId = String(formData.get("skillId") ?? "");
  const result = await db.skillClaim.deleteMany({ where: { id: skillId, profileId: profile.id } });
  if (result.count === 0) fail(BUILDER, "Skill not found");
  await recomputeCompleteness(profile.id);
  await audit({ actorUserId: user.id, action: "candidate.skill_removed", entityType: "skill", entityId: skillId });
  ok(BUILDER, "Skill removed");
}

export async function resubmitSkillAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const skillId = String(formData.get("skillId") ?? "");
  const evidence = String(formData.get("evidenceRef") ?? "").trim();
  const method = detectMethod(evidence);
  if (!method) fail(BUILDER, "New evidence must be a public GitHub repo or deployment URL");

  const claim = await db.skillClaim.findFirst({ where: { id: skillId, profileId: profile.id } });
  if (!claim) fail(BUILDER, "Skill not found");
  if (claim.verificationStatus === "verified") fail(BUILDER, "Verified claims cannot be re-verified");

  await db.skillClaim.update({
    where: { id: claim.id },
    data: { evidenceRef: evidence, verificationMethod: method, failureReason: null },
  });
  await markSkillPending(claim.id);
  await queueVerification("skill", claim.id, method);
  await recomputeCompleteness(profile.id);
  await audit({
    actorUserId: user.id,
    action: "candidate.skill_resubmitted",
    entityType: "skill",
    entityId: claim.id,
    metadata: { method },
  });
  ok(BUILDER, "New evidence submitted — verification queued");
}

const projectSchema = z.object({
  title: z.string().trim().min(3, "Project title is required").max(120),
  problem: z.string().trim().max(1200),
  approach: z.string().trim().max(1200),
  result: z.string().trim().max(600),
  repoUrl: z.union([z.string().trim().url("Repo URL is invalid"), z.literal("")]).optional(),
  deploymentUrl: z.union([z.string().trim().url("Deployment URL is invalid"), z.literal("")]).optional(),
  projectScale: z.enum(["toy", "coursework", "production", "oss"]),
});

export async function addProjectAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const count = await db.project.count({ where: { profileId: profile.id } });
  if (count >= 5) fail(BUILDER, "You can list at most 5 projects in the MVP");

  const parsed = projectSchema.safeParse({
    title: formData.get("title"),
    problem: formData.get("problem") ?? "",
    approach: formData.get("approach") ?? "",
    result: formData.get("result") ?? "",
    repoUrl: formData.get("repoUrl") ?? "",
    deploymentUrl: formData.get("deploymentUrl") ?? "",
    projectScale: formData.get("projectScale"),
  });
  if (!parsed.success) fail(BUILDER, parsed.error.issues[0].message);

  const repoUrl = parsed.data.repoUrl?.trim() || null;
  const deploymentUrl = parsed.data.deploymentUrl?.trim() || null;

  const project = await db.project.create({
    data: {
      profileId: profile.id,
      title: parsed.data.title,
      problem: parsed.data.problem,
      approach: parsed.data.approach,
      result: parsed.data.result,
      repoUrl,
      deploymentUrl,
      projectScale: parsed.data.projectScale as ProjectScale,
      repoStatus: repoUrl ? "pending" : "unverified",
      deploymentStatus: deploymentUrl ? "pending" : "unverified",
    },
  });

  if (repoUrl) await queueVerification("project", project.id, "repo");
  if (deploymentUrl) await queueVerification("project", project.id, "deployment");

  await recomputeCompleteness(profile.id);
  await audit({
    actorUserId: user.id,
    action: "candidate.project_added",
    entityType: "project",
    entityId: project.id,
    metadata: { repo: Boolean(repoUrl), deployment: Boolean(deploymentUrl) },
  });
  ok(BUILDER, "Project added — evidence is being verified");
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const projectId = String(formData.get("projectId") ?? "");
  const result = await db.project.deleteMany({ where: { id: projectId, profileId: profile.id } });
  if (result.count === 0) fail(BUILDER, "Project not found");
  await recomputeCompleteness(profile.id);
  await audit({ actorUserId: user.id, action: "candidate.project_removed", entityType: "project", entityId: projectId });
  ok(BUILDER, "Project removed");
}

const credentialSchema = z.object({
  type: z.enum(["degree", "cert"]),
  issuer: z.string().trim().min(2, "Issuer is required").max(120),
  title: z.string().trim().min(2, "Credential title is required").max(160),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  evidenceRef: z.string().trim().max(500).optional(),
});

export async function addCredentialAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const parsed = credentialSchema.safeParse({
    type: formData.get("type"),
    issuer: formData.get("issuer"),
    title: formData.get("title"),
    year: formData.get("year"),
    evidenceRef: formData.get("evidenceRef") ?? "",
  });
  if (!parsed.success) fail(BUILDER, parsed.error.issues[0].message);

  const credential = await db.credential.create({
    data: {
      profileId: profile.id,
      type: parsed.data.type,
      issuer: parsed.data.issuer,
      title: parsed.data.title,
      year: parsed.data.year,
      evidenceRef: parsed.data.evidenceRef?.trim() || null,
      verificationStatus: "manual_review",
    },
  });
  await db.verificationJob.create({
    data: {
      entityType: "credential",
      entityId: credential.id,
      method: "credential",
      status: "manual_review",
      attempts: 0,
    },
  });
  await recomputeCompleteness(profile.id);
  await audit({
    actorUserId: user.id,
    action: "candidate.credential_added",
    entityType: "credential",
    entityId: credential.id,
  });
  ok(BUILDER, "Credential queued for manual verification");
}

export async function resubmitCredentialAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const credentialId = String(formData.get("credentialId") ?? "");
  const evidence = String(formData.get("evidenceRef") ?? "").trim();
  if (!evidence) fail(BUILDER, "Add an evidence link (registrar page, certificate URL or reference)");

  const credential = await db.credential.findFirst({
    where: { id: credentialId, profileId: profile.id },
  });
  if (!credential) fail(BUILDER, "Credential not found");
  if (credential.verificationStatus === "verified") fail(BUILDER, "Verified credentials cannot be resubmitted");

  await db.credential.update({
    where: { id: credential.id },
    data: {
      evidenceRef: evidence,
      verificationStatus: "manual_review",
      failureReason: null,
    },
  });
  await db.verificationJob.create({
    data: {
      entityType: "credential",
      entityId: credential.id,
      method: "credential",
      status: "manual_review",
      attempts: 0,
    },
  });
  await audit({
    actorUserId: user.id,
    action: "candidate.credential_resubmitted",
    entityType: "credential",
    entityId: credential.id,
  });
  ok(BUILDER, "Credential resubmitted for manual review");
}

export async function respondInterestAction(formData: FormData): Promise<void> {
  const { user, profile } = await currentProfile();
  const interestId = String(formData.get("interestId") ?? "");
  const decision = formData.get("decision") === "accept" ? "accepted" : "declined";

  const interest = await db.interestRequest.findFirst({
    where: { id: interestId, profileId: profile.id },
    include: { recruiterAccount: { include: { user: true } } },
  });
  if (!interest) fail("/candidate/inbox", "Request not found");
  if (interest.status !== "sent") fail("/candidate/inbox", "This request has already been answered");

  await db.interestRequest.update({
    where: { id: interest.id },
    data: { status: decision, respondedAt: new Date() },
  });

  const preview = decision === "accepted" ? `\n\nYou can reach them at: ${profile.contactEmailPublic ?? "no public email set"}` : "";
  await enqueueEmail({
    to: interest.recruiterAccount.user.email,
    kind: "interest",
    subject: `Candidate ${decision} your interest request`,
    body: `${profile.fullName} has ${decision === "accepted" ? "accepted" : "declined"} your interest request.${preview}\n\n— AITalented`,
  });

  await audit({
    actorUserId: user.id,
    action: `candidate.interest_${decision}`,
    entityType: "interest",
    entityId: interest.id,
    metadata: { recruiterAccountId: interest.recruiterAccountId },
  });
  revalidatePath("/candidate/inbox");
  ok("/candidate/inbox", decision === "accepted" ? "Accepted — recruiter can see your contact email" : "Request declined");
}
