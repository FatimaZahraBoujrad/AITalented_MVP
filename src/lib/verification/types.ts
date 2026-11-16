export type VerificationOutcome =
  | { ok: true; evidence: Record<string, unknown>; manual?: false }
  | { ok: false; reason: string; retryable?: boolean; manual?: boolean };
