import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { recruiterHasAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { interestCooldownRemaining } from "@/lib/interests";
import { addToShortlistAction, sendInterestAction } from "@/app/actions/recruiter";
import { ProfileView } from "@/components/ProfileView";
import { Badge, Flash, PageHeader } from "@/components/ui";

export default async function CandidateDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  const user = await requireRole("recruiter");
  const account = user.recruiter;
  if (!account) notFound();
  if (!recruiterHasAccess(account)) {
    return (
      <div className="shell shell--narrow">
        <div className="card">
          <h1 className="page-title">Subscription required</h1>
          <p className="page-sub">Your trial has ended. Re-activate the pilot subscription to view profiles.</p>
          <Link className="btn btn--primary" href="/recruiter/billing" style={{ marginTop: 14 }}>
            Go to billing
          </Link>
        </div>
      </div>
    );
  }

  const profile = await db.candidateProfile.findUnique({
    where: { id },
    include: { user: true, skills: true, projects: true, credentials: true },
  });
  if (!profile || !profile.visible || !profile.user.emailVerified || profile.user.status !== "active") {
    notFound();
  }

  const accepted = await db.interestRequest.findFirst({
    where: { profileId: id, recruiterAccountId: account.id, status: "accepted" },
  });
  const interests = await db.interestRequest.findMany({
    where: { profileId: id, recruiterAccountId: account.id },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const latestInterest = interests[0] ?? null;
  const cooldown = await interestCooldownRemaining(account.id, id);
  const contactEmail = accepted ? profile.contactEmailPublic : null;

  return (
    <div className="shell">
      <PageHeader kicker="Candidate profile" title={profile.fullName} sub={profile.headline || "No headline yet"}>
        <Link className="btn" href="/recruiter">
          ← Back to search
        </Link>
        <form action={addToShortlistAction}>
          <input type="hidden" name="profileId" value={profile.id} />
          <input type="hidden" name="back" value={`/recruiter/candidates/${profile.id}`} />
          <button className="btn btn--primary" type="submit">
            Add to shortlist
          </button>
        </form>
      </PageHeader>

      <Flash error={search.error} success={search.success} />

      <div className="split">
        <ProfileView profile={profile} contactEmail={contactEmail} />

        <aside className="stack">
          <section className="card">
            <h2 className="card__title">Express interest</h2>
            <p className="card__hint">
              One 280-character note. The candidate can accept and share their contact email, or
              decline. No chat, no scheduling.
            </p>

            {latestInterest ? (
              <div style={{ marginTop: 12 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="faint" style={{ fontSize: 12 }}>Last request</span>
                  <Badge
                    status={
                      latestInterest.status === "accepted"
                        ? "verified"
                        : latestInterest.status === "sent"
                          ? "pending"
                          : "failed"
                    }
                    label={latestInterest.status}
                  />
                </div>
                <p className="muted" style={{ fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
                  “{latestInterest.message}” · sent {formatDate(latestInterest.createdAt)}
                </p>
              </div>
            ) : null}

            {contactEmail ? (
              <div className="flash flash--success" style={{ marginTop: 12, marginBottom: 0 }}>
                <span aria-hidden>✓</span>
                <span>
                  Contact shared: <strong>{contactEmail}</strong>
                </span>
              </div>
            ) : null}

            {cooldown > 0 ? (
              <p className="form-note" style={{ marginTop: 12 }}>
                You can contact this candidate again in {cooldown} day(s) (max one request per 30
                days).
              </p>
            ) : (
              <form action={sendInterestAction} className="stack" style={{ gap: 10, marginTop: 14 }}>
                <input type="hidden" name="profileId" value={profile.id} />
                <textarea
                  name="message"
                  required
                  maxLength={280}
                  placeholder="Short, specific, no recruiter spam…"
                  aria-label="Interest message"
                />
                <button className="btn btn--primary btn--wide" type="submit">
                  Send interest request
                </button>
                <span className="form-note">Expires after 14 days if unanswered.</span>
              </form>
            )}
          </section>

          <section className="card">
            <h2 className="card__title">Verification summary</h2>
            <dl style={{ margin: "8px 0 0" }}>
              <div className="kv">
                <dt>Verified skills</dt>
                <dd>{profile.skills.filter((s) => s.verificationStatus === "verified").length}</dd>
              </div>
              <div className="kv">
                <dt>Self-reported skills</dt>
                <dd>{profile.skills.filter((s) => s.verificationStatus === "unverified").length}</dd>
              </div>
              <div className="kv">
                <dt>Pending checks</dt>
                <dd>{profile.skills.filter((s) => s.verificationStatus === "pending").length}</dd>
              </div>
              <div className="kv">
                <dt>Credentials verified</dt>
                <dd>{profile.credentials.filter((c) => c.verificationStatus === "verified").length}</dd>
              </div>
              <div className="kv">
                <dt>Completeness</dt>
                <dd>{profile.completenessScore}/100</dd>
              </div>
            </dl>
            <Link className="btn btn--wide" href="/recruiter/shortlists" style={{ marginTop: 12 }}>
              View shortlists
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
