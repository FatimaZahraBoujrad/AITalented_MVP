import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { decideVerificationAction, retryJobAction } from "@/app/actions/admin";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

export default async function VerificationQueue({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  await requireRole("admin");

  const [manualJobs, failedJobs] = await Promise.all([
    db.verificationJob.findMany({
      where: { status: "manual_review" },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    db.verificationJob.findMany({
      where: { status: "failed" },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
  ]);

  const credentialIds = manualJobs.filter((j) => j.entityType === "credential").map((j) => j.entityId);
  const skillIds = manualJobs
    .filter((j) => j.entityType === "skill" || j.entityType === "project")
    .map((j) => j.entityId);

  const [credentials, skills, projects] = await Promise.all([
    db.credential.findMany({ where: { id: { in: credentialIds } }, include: { profile: true } }),
    db.skillClaim.findMany({ where: { id: { in: skillIds } }, include: { profile: true } }),
    db.project.findMany({ where: { id: { in: skillIds } }, include: { profile: true } }),
  ]);

  const credentialMap = new Map(credentials.map((c) => [c.id, c]));
  const skillMap = new Map(skills.map((s) => [s.id, s]));
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const failedEntityIds = failedJobs.map((j) => j.entityId);
  const [failedSkills, failedProjects] = await Promise.all([
    db.skillClaim.findMany({ where: { id: { in: failedEntityIds } }, include: { profile: true } }),
    db.project.findMany({ where: { id: { in: failedEntityIds } }, include: { profile: true } }),
  ]);
  const failedLabels = new Map<string, { label: string; who: string }>([
    ...failedSkills.map((s) => [s.id, { label: `Skill · ${s.skillName}`, who: s.profile.fullName }] as const),
    ...failedProjects.map((p) => [p.id, { label: `Project · ${p.title}`, who: p.profile.fullName }] as const),
  ]);

  return (
    <div className="shell">
      <PageHeader
        kicker="Admin"
        title="Verification queue"
        sub="Manual review exists for credentials and edge cases. Every rejection needs a reason the candidate can read."
      />
      <Flash error={params.error} success={params.success} />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div>
            <h2 className="card__title">Manual review ({manualJobs.length})</h2>
            <p className="card__hint">Credentials are always manual-first in the MVP.</p>
          </div>
        </div>

        {manualJobs.length === 0 ? (
          <Empty title="Queue is clear">No credential or edge-case claims waiting.</Empty>
        ) : (
          <div className="stack">
            {manualJobs.map((job) => {
              const credential = credentialMap.get(job.entityId);
              const skill = skillMap.get(job.entityId);
              const project = projectMap.get(job.entityId);
              const who = credential?.profile.fullName ?? skill?.profile.fullName ?? project?.profile.fullName;
              return (
                <article
                  key={job.id}
                  style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 13, background: "rgba(10,15,21,.4)" }}
                >
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <strong style={{ fontSize: 13.5 }}>
                        {credential
                          ? `${credential.title} — ${credential.issuer} (${credential.year})`
                          : skill
                            ? `Skill claim · ${skill.skillName}`
                            : project
                              ? `Project · ${project.title}`
                              : `${job.entityType} ${job.entityId}`}
                      </strong>
                      <div className="faint" style={{ fontSize: 11.5 }}>
                        {who ? `Candidate: ${who} · ` : ""}
                        queued {formatDate(job.createdAt)} · {job.entityType}
                      </div>
                    </div>
                    <Badge status="manual_review" />
                  </div>
                  <div className="row" style={{ marginTop: 8, gap: 12 }}>
                    {credential?.evidenceRef ? (
                      <a className="link" style={{ fontSize: 12 }} href={credential.evidenceRef} target="_blank" rel="noopener noreferrer">
                        Evidence ↗
                      </a>
                    ) : skill?.evidenceRef ? (
                      <a className="link" style={{ fontSize: 12 }} href={skill.evidenceRef} target="_blank" rel="noopener noreferrer">
                        Evidence ↗
                      </a>
                    ) : (
                      <span className="faint" style={{ fontSize: 12 }}>No evidence link provided</span>
                    )}
                  </div>
                  <form action={decideVerificationAction} className="row" style={{ marginTop: 10, gap: 8 }}>
                    <input type="hidden" name="jobId" value={job.id} />
                    <input
                      className="input"
                      style={{ flex: 1, minWidth: 220 }}
                      name="reason"
                      placeholder="Reason if rejecting (candidate-visible)"
                    />
                    <button className="btn btn--primary btn--sm" name="decision" value="approve" type="submit">
                      Approve
                    </button>
                    <button className="btn btn--danger btn--sm" name="decision" value="reject" type="submit">
                      Reject
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Recent failures ({failedJobs.length})</h2>
            <p className="card__hint">Automated verifiers that exhausted 3 attempts. Retry once the evidence or upstream is fixed.</p>
          </div>
        </div>
        {failedJobs.length === 0 ? (
          <Empty title="No failures">Automated checks are healthy.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Entity</th>
                  <th>Method</th>
                  <th>Attempts</th>
                  <th>Last error</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {failedJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      {failedLabels.get(job.entityId)?.label ?? `${job.entityType} · ${job.entityId}`}
                      <div className="faint" style={{ fontSize: 11.5 }}>
                        {failedLabels.get(job.entityId)?.who ?? ""}
                      </div>
                    </td>
                    <td className="mono">{job.method}</td>
                    <td className="mono">{job.attempts}</td>
                    <td style={{ maxWidth: 320 }} className="faint">{job.lastError ?? "—"}</td>
                    <td className="faint">{formatDate(job.updatedAt)}</td>
                    <td>
                      <form action={retryJobAction}>
                        <input type="hidden" name="jobId" value={job.id} />
                        <button className="btn btn--sm" type="submit">Retry</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
