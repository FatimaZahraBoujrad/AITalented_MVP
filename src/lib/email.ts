import { db } from "./db";

/**
 * MVP email is an outbox, not a delivered message: every outbound email (verification
 * link, interest notification, weekly digest) is rendered and stored so the pilot can
 * be operated without an SMTP provider. Admin > Outbox shows the exact payload.
 * Connecting an email provider later only needs a sender in this module.
 */
export async function enqueueEmail(input: {
  to: string;
  subject: string;
  body: string;
  kind: "verify_email" | "candidate_invite" | "interest" | "digest" | "billing";
}): Promise<void> {
  await db.emailOutbox.create({
    data: { to: input.to, subject: input.subject, body: input.body, kind: input.kind },
  });
}
