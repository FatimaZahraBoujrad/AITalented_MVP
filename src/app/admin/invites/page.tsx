import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/labels";
import { inviteCandidatesAction } from "@/app/actions/admin";
import { Flash, PageHeader } from "@/components/ui";

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  await requireRole("admin");

  const recent = await db.user.findMany({
    where: { role: "candidate" },
    orderBy: { createdAt: "desc" },
    take: 12,
    include: { profile: { select: { fullName: true, completenessScore: true } } },
  });

  return (
    <div className="shell">
      <PageHeader
        kicker="Admin"
        title="Candidate seeding"
        sub="Bulk invite by CSV. Each invite creates a pre-seeded profile shell and a set-password link captured in the outbox."
      />
      <Flash error={params.error} success={params.success} />

      <div className="grid grid--2" style={{ alignItems: "start" }}>
        <section className="card">
          <h2 className="card__title">Bulk invite</h2>
          <p className="card__hint">One per line: <code>email,full name</code>. Max 200 per upload. Existing users are skipped.</p>
          <form action={inviteCandidatesAction} className="stack" style={{ gap: 12, marginTop: 12 }}>
            <div className="field">
              <label htmlFor="csv">CSV</label>
              <textarea
                id="csv"
                name="csv"
                rows={8}
                placeholder={"lea@example.com,Léa Moreau\nsam@example.com,Sam Okafor"}
                required
              />
            </div>
            <div className="row">
              <button className="btn btn--primary" type="submit">
                Create invites
              </button>
              <Link className="btn btn--ghost" href="/admin/outbox">
                Open outbox for links
              </Link>
            </div>
          </form>
        </section>

        <section className="card">
          <h2 className="card__title">Recent candidates</h2>
          <div className="stack" style={{ gap: 0, marginTop: 8 }}>
            {recent.map((user) => (
              <div className="kv" key={user.id}>
                <dt>
                  {user.profile?.fullName ?? user.email}
                  <div className="faint" style={{ fontSize: 11.5 }}>
                    {user.email} · joined {formatDate(user.createdAt)}
                  </div>
                </dt>
                <dd>
                  <span className="faint" style={{ fontSize: 11.5 }}>
                    {user.inviteToken ? "invite pending" : user.emailVerified ? "verified" : "unverified"} ·{" "}
                    {user.profile?.completenessScore ?? 0}%
                  </span>
                </dd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
