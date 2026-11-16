import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { expireStaleInterests } from "@/lib/interests";
import { formatDate } from "@/lib/labels";
import { expireInterestsAction } from "@/app/actions/recruiter";
import { Badge, Empty, Flash, PageHeader } from "@/components/ui";

export default async function OutreachPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("recruiter");
  const account = user.recruiter;
  if (!account) return null;

  await expireStaleInterests();
  const interests = await db.interestRequest.findMany({
    where: { recruiterAccountId: account.id },
    include: { profile: true },
    orderBy: { createdAt: "desc" },
  });

  const count = (status: string) => interests.filter((i) => i.status === status).length;

  return (
    <div className="shell">
      <PageHeader
        kicker="Recruiter workspace"
        title="Outreach"
        sub="Every interest request and its state. Accepted requests reveal the candidate's public contact email on their profile."
      >
        <form action={expireInterestsAction}>
          <button className="btn btn--sm" type="submit">
            Refresh expired
          </button>
        </form>
      </PageHeader>
      <Flash error={params.error} success={params.success} />

      <div className="grid grid--4" style={{ marginBottom: 18 }}>
        <div className="stat">
          <div className="stat__label">Sent</div>
          <div className="stat__value">{count("sent")}</div>
          <div className="stat__hint">Awaiting candidate</div>
        </div>
        <div className="stat">
          <div className="stat__label">Accepted</div>
          <div className="stat__value">{count("accepted")}</div>
          <div className="stat__hint">Contact revealed</div>
        </div>
        <div className="stat">
          <div className="stat__label">Declined</div>
          <div className="stat__value">{count("declined")}</div>
          <div className="stat__hint">No contact shared</div>
        </div>
        <div className="stat">
          <div className="stat__label">Expired</div>
          <div className="stat__value">{count("expired")}</div>
          <div className="stat__hint">14-day window</div>
        </div>
      </div>

      {interests.length === 0 ? (
        <Empty title="No outreach yet">
          Send an interest request from a candidate profile. One per candidate per 30 days.
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Message</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Answered</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {interests.map((interest) => (
                <tr key={interest.id}>
                  <td>
                    <Link className="link" href={`/recruiter/candidates/${interest.profileId}`}>
                      {interest.profile.fullName}
                    </Link>
                    <div className="faint" style={{ fontSize: 11.5 }}>{interest.profile.headline}</div>
                  </td>
                  <td style={{ maxWidth: 320 }}>“{interest.message}”</td>
                  <td>
                    <Badge
                      status={
                        interest.status === "accepted"
                          ? "verified"
                          : interest.status === "sent"
                            ? "pending"
                            : "failed"
                      }
                      label={interest.status}
                    />
                  </td>
                  <td className="faint">{formatDate(interest.createdAt)}</td>
                  <td className="faint">{interest.respondedAt ? formatDate(interest.respondedAt) : "—"}</td>
                  <td>
                    <Link className="btn btn--ghost btn--sm" href={`/recruiter/candidates/${interest.profileId}`}>
                      Open
                    </Link>
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
