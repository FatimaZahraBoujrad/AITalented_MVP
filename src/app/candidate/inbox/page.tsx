import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { expireStaleInterests } from "@/lib/interests";
import { formatDate } from "@/lib/labels";
import { respondInterestAction } from "@/app/actions/candidate";
import { Flash, PageHeader, Empty } from "@/components/ui";

const STATUS_STYLE: Record<string, string> = {
  sent: "badge--pending",
  accepted: "badge--verified",
  declined: "badge--failed",
  expired: "badge--unverified",
};

export default async function CandidateInbox({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("candidate");
  const profile = await db.candidateProfile.findUnique({ where: { userId: user.id } });
  if (!profile) return null;

  await expireStaleInterests();
  const interests = await db.interestRequest.findMany({
    where: { profileId: profile.id },
    include: { recruiterAccount: true },
    orderBy: { createdAt: "desc" },
  });

  const accepted = interests.filter((i) => i.status === "accepted").length;

  return (
    <div className="shell">
      <PageHeader
        kicker="Candidate inbox"
        title="Interest requests"
        sub="Recruiters send one short note. You choose whether to share your contact email — there is no chat, and requests expire after 14 days."
      />
      <Flash error={params.error} success={params.success} />

      <div className="grid grid--3" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat__label">Total requests</div>
          <div className="stat__value">{interests.length}</div>
          <div className="stat__hint">No messaging, by design</div>
        </div>
        <div className="stat">
          <div className="stat__label">Accepted</div>
          <div className="stat__value">{accepted}</div>
          <div className="stat__hint">Contact email revealed</div>
        </div>
        <div className="stat">
          <div className="stat__label">Public contact</div>
          <div className="stat__value" style={{ fontSize: 14, wordBreak: "break-all" }}>
            {profile.contactEmailPublic || "Not set"}
          </div>
          <div className="stat__hint">Shared only on accept</div>
        </div>
      </div>

      {interests.length === 0 ? (
        <Empty title="No interest requests yet">
          Recruiters find you through search once your email is verified, your profile is visible and
          you have at least one skill and one project.
        </Empty>
      ) : (
        <div className="stack">
          {interests.map((interest) => (
            <article className="card" key={interest.id}>
              <div className="card__head">
                <div>
                  <div className="row">
                    <h2 className="card__title">{interest.recruiterAccount.orgName}</h2>
                    <span className={`badge badge--plain ${STATUS_STYLE[interest.status] ?? "badge--unverified"}`}>
                      {interest.status}
                    </span>
                  </div>
                  <p className="card__hint">
                    Received {formatDate(interest.createdAt)} ·{" "}
                    {interest.status === "sent"
                      ? `expires ${formatDate(interest.expiresAt)}`
                      : interest.respondedAt
                        ? `answered ${formatDate(interest.respondedAt)}`
                        : "closed"}
                  </p>
                </div>
              </div>
              <blockquote
                style={{
                  margin: 0,
                  borderLeft: "2px solid rgba(125,211,252,.45)",
                  padding: "6px 0 6px 12px",
                  color: "var(--muted)",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                }}
              >
                {interest.message}
              </blockquote>
              {interest.status === "sent" ? (
                <div className="actions" style={{ marginTop: 14 }}>
                  <form action={respondInterestAction}>
                    <input type="hidden" name="interestId" value={interest.id} />
                    <input type="hidden" name="decision" value="accept" />
                    <button className="btn btn--primary btn--sm" type="submit">
                      Accept &amp; share contact email
                    </button>
                  </form>
                  <form action={respondInterestAction}>
                    <input type="hidden" name="interestId" value={interest.id} />
                    <input type="hidden" name="decision" value="decline" />
                    <button className="btn btn--ghost btn--sm" type="submit">
                      Decline
                    </button>
                  </form>
                  <span className="form-note">Declining shares nothing.</span>
                </div>
              ) : interest.status === "accepted" ? (
                <p className="form-note" style={{ marginTop: 12 }}>
                  The recruiter can now see <strong>{profile.contactEmailPublic ?? "no public email set"}</strong>.
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
