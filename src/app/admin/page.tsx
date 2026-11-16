import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { sendDigestsNowAction } from "@/app/actions/admin";
import { Flash, PageHeader, Stat } from "@/components/ui";

export default async function AdminMetrics({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  await requireRole("admin");
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [
    candidates,
    verifiedProfiles,
    recruiters,
    activeSeats,
    sentInterests,
    acceptedInterests,
    weeklySignups,
    queueDepth,
    failedJobs,
    pendingManual,
    outboxCount,
  ] = await Promise.all([
    db.user.count({ where: { role: "candidate" } }),
    db.candidateProfile.count({
      where: {
        OR: [
          { skills: { some: { verificationStatus: "verified" } } },
          { credentials: { some: { verificationStatus: "verified" } } },
        ],
      },
    }),
    db.recruiterAccount.count(),
    db.recruiterAccount.aggregate({
      where: { billingStatus: "active" },
      _sum: { seatCount: true },
    }),
    db.interestRequest.count(),
    db.interestRequest.count({ where: { status: "accepted" } }),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.verificationJob.count({ where: { status: { in: ["queued", "running"] } } }),
    db.verificationJob.count({ where: { status: "failed" } }),
    db.verificationJob.count({ where: { status: "manual_review" } }),
    db.emailOutbox.count(),
  ]);

  const verifiedPct = candidates > 0 ? Math.round((verifiedProfiles / candidates) * 100) : 0;
  const payingSeats = activeSeats._sum.seatCount ?? 0;

  return (
    <div className="shell">
      <PageHeader
        kicker="Admin"
        title="Pilot metrics"
        sub="Enough to compute G1–G4 by hand. No BI tool, no vanity dashboards."
      >
        <form action={sendDigestsNowAction}>
          <button className="btn btn--sm" type="submit">
            Run weekly digests now
          </button>
        </form>
        <Link className="btn btn--ghost btn--sm" href="/admin/outbox">
          Email outbox
        </Link>
      </PageHeader>
      <Flash error={params.error} success={params.success} />

      <div className="grid grid--4">
        <Stat label="G1 — candidates" value={candidates} hint="Target 300+ in AI/ML" />
        <Stat label="G1 — verified profiles" value={verifiedProfiles} hint={`${verifiedPct}% of candidates (G3 target 60%)`} />
        <Stat label="G2 — paying seats" value={payingSeats} hint={`${recruiters} recruiter account(s) (target 5–10)`} />
        <Stat label="G4 — interest loops" value={acceptedInterests} hint={`${sentInterests} sent · 3 completed target`} />
      </div>

      <div className="grid grid--4" style={{ marginTop: 16 }}>
        <Stat label="Weekly signups" value={weeklySignups} hint="All roles, last 7 days" />
        <Stat label="Queue depth" value={queueDepth} hint="Queued + running (alert above 100)" />
        <Stat label="Manual review" value={pendingManual} hint="Credentials waiting on you" />
        <Stat label="Failed jobs" value={failedJobs} hint="Retry from Verification" />
      </div>

      <div className="grid grid--2" style={{ marginTop: 20 }}>
        <section className="card">
          <h2 className="card__title">Operations</h2>
          <div className="stack" style={{ gap: 8, marginTop: 12 }}>
            <Link className="btn" href="/admin/verification">Verification queue → review credentials and failures</Link>
            <Link className="btn" href="/admin/taxonomy">Skill vocabulary → add or deactivate terms</Link>
            <Link className="btn" href="/admin/invites">Candidate invites → bulk CSV</Link>
            <Link className="btn" href="/admin/recruiters">Recruiter accounts → trials and access</Link>
            <Link className="btn" href="/admin/outbox">Email outbox → digests, invites, interest notices</Link>
          </div>
        </section>
        <section className="card">
          <h2 className="card__title">Definition of done signals</h2>
          <dl style={{ margin: "10px 0 0" }}>
            <div className="kv">
              <dt>Candidates signed up</dt>
              <dd className="mono">{candidates}</dd>
            </div>
            <div className="kv">
              <dt>Profiles carrying ≥1 verified claim</dt>
              <dd className="mono">{verifiedProfiles}</dd>
            </div>
            <div className="kv">
              <dt>Recruiters active / trial</dt>
              <dd className="mono">{recruiters}</dd>
            </div>
            <div className="kv">
              <dt>Interest requests accepted</dt>
              <dd className="mono">{acceptedInterests}</dd>
            </div>
            <div className="kv">
              <dt>Emails captured in outbox</dt>
              <dd className="mono">{outboxCount}</dd>
            </div>
            <div className="kv">
              <dt>Run date</dt>
              <dd>{formatDate(new Date())}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
