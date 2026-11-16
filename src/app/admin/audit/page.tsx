import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { Flash, PageHeader } from "@/components/ui";

const FILTERS = ["all", "skill", "credential", "project", "profile", "user", "interest", "recruiterAccount", "taxonomy", "savedSearch"];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  await requireRole("admin");
  const entity = params.entity && FILTERS.includes(params.entity) ? params.entity : "all";

  const logs = await db.auditLog.findMany({
    where: entity === "all" ? {} : { entityType: entity },
    include: { actor: { select: { email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="shell">
      <PageHeader
        kicker="Admin"
        title="Audit log"
        sub="Read-only trail of verification decisions, admin actions and candidate changes."
      >
        <div className="actions">
          {FILTERS.map((filter) => (
            <Link
              key={filter}
              className={`btn btn--sm ${entity === filter ? "btn--primary" : "btn--ghost"}`}
              href={`/admin/audit${filter === "all" ? "" : `?entity=${filter}`}`}
            >
              {filter}
            </Link>
          ))}
        </div>
      </PageHeader>
      <Flash error={params.error} success={params.success} />

      {logs.length === 0 ? (
        <p className="muted">No audit entries for this filter yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="faint" style={{ whiteSpace: "nowrap" }}>{formatDate(log.createdAt)}</td>
                  <td>
                    {log.actor?.email ?? "system/verifier"}
                    <div className="faint" style={{ fontSize: 11.5 }}>{log.actor?.role ?? "automated"}</div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{log.action}</td>
                  <td className="faint">
                    {log.entityType}
                    <div style={{ fontSize: 11 }}>{log.entityId ?? "—"}</div>
                  </td>
                  <td className="faint" style={{ fontSize: 11.5, maxWidth: 320 }}>
                    {log.metadataJson ? JSON.stringify(log.metadataJson) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
