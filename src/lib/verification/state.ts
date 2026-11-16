import type { VerificationStatus } from "@prisma/client";

/**
 * Canonical verification state machine (§9.5). Enforced in code:
 *   unverified -> pending
 *   pending    -> verified | failed | manual_review
 *   manual_review -> verified | failed
 *   failed     -> pending            (candidate resubmits evidence and re-queues)
 * `verified` is terminal in the MVP.
 */
const ALLOWED: Record<VerificationStatus, VerificationStatus[]> = {
  unverified: ["pending"],
  pending: ["verified", "failed", "manual_review"],
  manual_review: ["verified", "failed"],
  failed: ["pending"],
  verified: [],
};

export class InvalidVerificationTransition extends Error {
  constructor(from: VerificationStatus, to: VerificationStatus) {
    super(`Illegal verification transition: ${from} -> ${to}`);
    this.name = "InvalidVerificationTransition";
  }
}

export function canTransition(from: VerificationStatus, to: VerificationStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: VerificationStatus, to: VerificationStatus): void {
  if (!canTransition(from, to)) throw new InvalidVerificationTransition(from, to);
}
