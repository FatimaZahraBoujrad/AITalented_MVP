import { db } from "./db";

export const INTEREST_TTL_DAYS = 14;
export const INTEREST_COOLDOWN_DAYS = 30;

/** Sent requests expire after 14 days (§7.6). Called by the worker and on inbox views. */
export async function expireStaleInterests(): Promise<number> {
  const result = await db.interestRequest.updateMany({
    where: { status: "sent", expiresAt: { lt: new Date() } },
    data: { status: "expired" },
  });
  return result.count;
}

/** A recruiter may send at most one interest request per profile per 30 days. */
export async function interestCooldownRemaining(
  recruiterAccountId: string,
  profileId: string,
): Promise<number> {
  const since = new Date(Date.now() - INTEREST_COOLDOWN_DAYS * 86_400_000);
  const recent = await db.interestRequest.findFirst({
    where: { recruiterAccountId, profileId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  if (!recent) return 0;
  const nextAllowed = recent.createdAt.getTime() + INTEREST_COOLDOWN_DAYS * 86_400_000;
  return Math.max(0, Math.ceil((nextAllowed - Date.now()) / 86_400_000));
}
