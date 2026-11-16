import Link from "next/link";
import type { JobStatus } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { SCALE_LABEL, formatDate } from "@/lib/labels";
import { toggleVisibilityAction } from "@/app/actions/candidate";
import { resendVerificationAction } from "@/app/actions/auth";
import { Badge, Flash, Meter, PageHeader, Stat, Empty } from "@/components/ui";

function jobBadge(status: JobStatus) {
  if (status === "passed") return <Badge status="verified" label="Passed" />;
  if (status === "failed") return <Badge status="failed" label="Failed" />;
  if (status === "manual_review") return <Badge status="manual_review" label="Manual review" />;
  return <Badge status="pending" label={status === "running" ? "Running" : "Queued"} />;
}

export default async function CandidateDashboard({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("candidate");
  const profile = await db.candidateProfile.findUnique({
    where: { userId: user.id },
    include: { skills: true, projects: true, credentials: true },
  });
  if (!profile) {
    return (
      <div className="shell">
        <Empty title="Profile not created yet">Contact the AITalented team to finish your setup.</Empty>
      </div>
    );
  }

  const verified = profile.skills.filter((s) => s.verificationStatus === "verified").length;
  const pending = profile.skills.filter((s) => s.verificationStatus === "pending").length;
  const failed = profile.skills.filter((s) => s.verificationStatus === "failed").length;
  const manual = profile.credentials.filter((c) => c.verificationStatus === "manual_review").length;

  const entityIds = [
    ...profile.skills.map((s) => s.id),
    ...profile.projects.map((p) => p.id),
    ...profile.credentials.map((c) => c.id),
  ];
  const jobs = await db.verificationJob.findMany({
    where: { entityId: { in: entityIds } },
    orderBy: { updatedAt: "desc" },
    take: 6,
  });
  const labels = new Map<string, string>([
    ...profile.skills.map((s) => [s.id, `Skill · ${s.skillName}`] as const),
    ...profile.projects.map((p) => [p.id, `Project · ${p.title}`] as const),
    ...profile.credentials.map((c) => [c.id, `Credential · ${c.title}`] as const),
  ]);

  const strongest = [...profile.projects].sort((a, b) => {
    const order = { toy: 1, coursework: 2, production: 3, oss: 4 } as const;
    return order[b.projectScale] - order[a.projectScale];
  })[0];
  const verifyLink = !user.emailVerified && user.emailVerifyToken ? `/verify-email?token=${user.emailVerifyToken}` : null;

  return (
    <div className="shell">
      <PageHeader
        kicker="Candidate workspace"
        title={`Hello, ${profile.fullName.split(" ")[0] || "engineer"}.`}
        sub="Build the structured portfolio recruiters can trust. Evidence is checked asynchronously — you are never blocked."
      >
        <Link className="btn" href="/candidate/preview">
          Recruiter preview
        </Link>
        <Link className="btn btn--primary" href="/candidate/profile">
          Edit profile
        </Link>
      </PageHeader>

      <Flash
        success={params.success ?? (params.welcome ? "Account created. Add your first project and skill." : undefined)}
        error={params.error}
      />

      {!user.emailVerified ? (
        <div className="flash flash--warn">
          <span aria-hidden>!</span>
          <span>
            Verify your email to become searchable by recruiters.{" "}
            {verifyLink ? (
              <Link className="link" href={verifyLink}>
                Use this pilot link
              </Link>
            ) : null}{" "}
            <form action={resendVerificationAction} style={{ display: "inline" }}>
              <button className="link" style={{ background: "none", border: 0, cursor: "pointer", padding: 0 }} type="submit">
                Resend email
              </button>
            </form>{" "}
            <span className="faint">
              (In this environment outbound email is captured in the admin outbox.)
            </span>
          </span>
        </div>
      ) : null}

      <div className="grid grid--4" style={{ marginBottom: 18 }}>
        <Stat label="Completeness" value={`${profile.completenessScore}%`} hint={profile.visible ? "Visible to recruiters" : "Hidden from recruiters"} />
        <Stat label="Verified claims" value={verified} hint={`${manual} credential(s) in manual review`} />
        <Stat label="Pending checks" value={pending} hint="Async verifiers running" />
        <Stat label="Failed checks" value={failed} hint="Resubmit with new evidence" />
      </div>

      <div className="split">
        <div className="stack">
          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Profile readiness</h2>
                <p className="card__hint">Recruiters only see profiles with at least one skill and one project.</p>
              </div>
              <span className="chip">{profile.completenessScore}/100</span>
            </div>
            <div className="meter-row">
              <span>Completeness score</span>
              <strong>{profile.completenessScore}%</strong>
            </div>
            <Meter value={profile.completenessScore} />
            <div className="divider" />
            <div className="stack" style={{ gap: 0 }}>
              {[
                {
                  label: "Basics — headline, location, experience",
                  done: Boolean(profile.headline && profile.location && profile.fullName),
                  href: "/candidate/profile#basics",
                },
                {
                  label: `Skills from the controlled vocabulary (${profile.skills.length})`,
                  done: profile.skills.length > 0,
                  href: "/candidate/profile#skills",
                },
                {
                  label: `Projects (${profile.projects.length}/5)`,
                  done: profile.projects.length > 0,
                  href: "/candidate/profile#projects",
                },
                {
                  label: `Credentials (${profile.credentials.length})`,
                  done: profile.credentials.length > 0,
                  href: "/candidate/profile#credentials",
                },
                {
                  label: "At least one verified claim",
                  done: verified > 0,
                  href: "/candidate/profile#skills",
                },
              ].map((item) => (
                <div className="kv" key={item.label}>
                  <dt>
                    <span style={{ color: item.done ? "var(--verified)" : "var(--faint)" }}>
                      {item.done ? "●" : "○"}
                    </span>{" "}
                    <Link className="link" href={item.href}>
                      {item.label}
                    </Link>
                  </dt>
                  <dd>{item.done ? "Done" : "Missing"}</dd>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Verification activity</h2>
                <p className="card__hint">Async jobs on your evidence. Failed checks show a reason you can resubmit.</p>
              </div>
            </div>
            {jobs.length === 0 ? (
              <Empty title="No checks yet">
                Add a repo URL or deployment URL to a skill or project to start verification.
              </Empty>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Entity</th>
                      <th>Method</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id}>
                        <td>
                          {labels.get(job.entityId) ?? job.entityType}
                          {job.lastError ? (
                            <div className="faint" style={{ fontSize: 11.5, marginTop: 3 }}>
                              {job.lastError}
                            </div>
                          ) : null}
                        </td>
                        <td className="mono">{job.method}</td>
                        <td>{jobBadge(job.status)}</td>
                        <td className="mono">{job.attempts}</td>
                        <td className="faint">{formatDate(job.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <h2 className="card__title">Visibility</h2>
            <p className="card__hint" style={{ marginBottom: 12 }}>
              Hidden profiles never appear in search, digests or exports — but stay editable.
            </p>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13 }}>Status</span>
              <Badge
                status={profile.visible ? "verified" : "unverified"}
                label={profile.visible ? "Visible" : "Hidden"}
              />
            </div>
            <form action={toggleVisibilityAction}>
              <input type="hidden" name="visible" value={profile.visible ? "false" : "true"} />
              <button className={`btn ${profile.visible ? "btn--ghost" : "btn--primary"} btn--wide`} type="submit">
                {profile.visible ? "Hide from recruiters" : "Make visible to recruiters"}
              </button>
            </form>
          </section>

          <section className="card">
            <h2 className="card__title">Strongest project</h2>
            {strongest ? (
              <>
                <p style={{ marginTop: 8, fontWeight: 600 }}>{strongest.title}</p>
                <div className="row" style={{ marginTop: 6 }}>
                  <span className="chip">{SCALE_LABEL[strongest.projectScale]}</span>
                  {strongest.deploymentVerified ? <Badge status="verified" label="Deployment verified" /> : null}
                </div>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 8, lineHeight: 1.5 }}>
                  {strongest.result || "Add a one-line result to make this card land."}
                </p>
              </>
            ) : (
              <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                No projects yet.{" "}
                <Link className="link" href="/candidate/profile#projects">
                  Add one
                </Link>
                .
              </p>
            )}
          </section>

          <section className="card">
            <h2 className="card__title">Candidate inbox</h2>
            <p className="card__hint">
              Interest requests from recruiters. Accepting reveals your public contact email — no chat.
            </p>
            <Link className="btn btn--wide" href="/candidate/inbox" style={{ marginTop: 12 }}>
              Open inbox
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
