"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getSessionUser } from "@/lib/session";
import { enqueueEmail } from "@/lib/email";
import { appUrl } from "@/lib/url";
import { audit } from "@/lib/audit";
import { homeForRole } from "@/lib/auth";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "";
}

async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = randomBytes(24).toString("hex");
  await db.user.update({ where: { id: userId }, data: { emailVerifyToken: token } });
  await enqueueEmail({
    to: email,
    kind: "verify_email",
    subject: "Verify your AITalented email",
    body: `Confirm your email to make your verified profile searchable by recruiters:\n\n${appUrl()}/verify-email?token=${token}\n\nIf you did not create this account, ignore this email.\n\n— AITalented`,
  });
}

export async function signupAction(formData: FormData): Promise<void> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  const consent = formData.get("consent") === "on";

  if (fullName.length < 2) fail("/signup", "Enter your full name");
  if (!email.success) fail("/signup", email.error.issues[0].message);
  if (!password.success) fail("/signup", password.error.issues[0].message);
  if (!consent) fail("/signup", "You must consent to your verified profile being searchable");

  const existing = await db.user.findUnique({ where: { email: email.data } });
  if (existing) fail("/signup", "An account with this email already exists");

  const user = await db.user.create({
    data: {
      email: email.data,
      passwordHash: await hashPassword(password.data),
      role: "candidate",
      emailVerified: false,
      profile: {
        create: {
          fullName,
          seniorityBand: "junior",
          currentStatus: "open",
          contactEmailPublic: email.data,
        },
      },
    },
  });

  await sendVerificationEmail(user.id, user.email);
  await audit({
    actorUserId: user.id,
    action: "candidate.signup",
    entityType: "user",
    entityId: user.id,
    metadata: { consentToSearchable: true },
  });
  await createSession(user.id);
  redirect("/candidate?welcome=1");
}

export async function loginAction(formData: FormData): Promise<void> {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const backTo = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  if (!email.success) fail(backTo, "Enter a valid email address");

  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const failures = await db.loginAttempt.count({
    where: { identifier: email.data, succeeded: false, createdAt: { gte: since } },
  });
  if (failures >= MAX_FAILURES) {
    fail(backTo, "Too many failed attempts. Try again in 15 minutes.");
  }

  const user = await db.user.findUnique({ where: { email: email.data } });
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;

  await db.loginAttempt.create({ data: { identifier: email.data, succeeded: ok } });

  if (!user || !ok) fail(backTo, "Incorrect email or password");
  if (user.status === "suspended") fail(backTo, "This account is suspended");

  await createSession(user.id);
  await audit({
    actorUserId: user.id,
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
    metadata: { role: user.role },
  });
  redirect(next || homeForRole(user.role));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function resendVerificationAction(): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.emailVerified) redirect("/candidate");
  await sendVerificationEmail(user.id, user.email);
  redirect("/candidate?success=Verification email sent");
}

export async function acceptInviteAction(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  const password = passwordSchema.safeParse(formData.get("password"));
  const consent = formData.get("consent") === "on";

  const user = await db.user.findUnique({ where: { inviteToken: token } });
  if (!user) fail("/invite/invalid", "This invite link is invalid or has already been used");
  if (!password.success) fail(`/invite/${token}`, password.error.issues[0].message);
  if (!consent) fail(`/invite/${token}`, "You must consent to your verified profile being searchable");

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(password.data),
      inviteToken: null,
      emailVerified: true,
    },
  });

  if (user.role === "candidate") {
    const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      await db.candidateProfile.create({
        data: {
          userId: user.id,
          fullName: user.email.split("@")[0],
          contactEmailPublic: user.email,
        },
      });
    }
  }

  await audit({
    actorUserId: user.id,
    action: "candidate.invite_accepted",
    entityType: "user",
    entityId: user.id,
  });
  await createSession(user.id);
  redirect(homeForRole(user.role));
}

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const next = passwordSchema.safeParse(formData.get("next"));
  if (!next.success) fail("/candidate/settings", next.error.issues[0].message);
  if (!(await verifyPassword(current, user.passwordHash))) {
    fail("/candidate/settings", "Current password is incorrect");
  }
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next.data) },
  });
  await audit({ actorUserId: user.id, action: "auth.password_changed", entityType: "user", entityId: user.id });
  redirect("/candidate/settings?success=Password updated");
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (String(formData.get("confirm") ?? "") !== "DELETE") {
    fail("/candidate/settings", 'Type DELETE to confirm account deletion');
  }
  await audit({
    actorUserId: user.id,
    action: "candidate.account_deleted",
    entityType: "user",
    entityId: user.id,
  });
  await db.user.delete({ where: { id: user.id } });
  await destroySession();
  redirect("/?deleted=1");
}
