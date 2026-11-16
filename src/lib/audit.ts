import { db } from "./db";

/**
 * Every privileged action (verification decisions, admin actions, interest handling)
 * writes an AuditLog row so the pilot can be reconstructed after the fact.
 */
export async function audit(input: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadataJson: input.metadata ? (input.metadata as object) : undefined,
    },
  });
}
