import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { sendDigestsNowAction } from "@/app/actions/admin";
import { Flash, PageHeader } from "@/components/ui";

export default async function OutboxPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  await requireRole("admin");

  const emails = await db.emailOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 40 });

  return (
    <div className="shell">
      <PageHeader
        kicker="Admin"
        title="Email outbox"
        sub="No SMTP provider is connected: every outbound email is rendered and captured here, including invite and verification links. Connect a provider to deliver them."
      >
        <form action={sendDigestsNowAction}>
          <button className="btn btn--sm btn--primary" type="submit">
            Run weekly digests now
          </button>
        </form>
      </PageHeader>
      <Flash error={params.error} success={params.success} />

      {emails.length === 0 ? (
        <p className="muted">No emails captured yet.</p>
      ) : (
        <div className="stack">
          {emails.map((email) => (
            <details className="card card--flat" key={email.id}>
              <summary style={{ cursor: "pointer", fontSize: 13.5 }}>
                <strong>{email.subject}</strong>
                <span className="faint" style={{ marginLeft: 10, fontSize: 11.5 }}>
                  {email.kind} → {email.to} · {formatDate(email.createdAt)}
                </span>
              </summary>
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--sans)",
                  fontSize: 12.5,
                  color: "var(--muted)",
                  lineHeight: 1.6,
                  margin: "12px 0 0",
                }}
              >
                {email.body}
              </pre>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
