import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { daysLeft, formatDate } from "@/lib/labels";
import { createRecruiterAction, updateRecruiterAction } from "@/app/actions/admin";
import { Flash, PageHeader } from "@/components/ui";

export default async function RecruitersAdmin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  await requireRole("admin");

  const accounts = await db.recruiterAccount.findMany({
    include: {
      user: true,
      _count: { select: { savedSearches: true, interests: true, shortlists: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="shell">
      <PageHeader
        kicker="Admin"
        title="Recruiter accounts"
        sub="Invite-only in the MVP. Create seats, extend trials, comp accounts, suspend access."
      />
      <Flash error={params.error} success={params.success} />

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="card__head">
          <div>
            <h2 className="card__title">Invite a recruiter</h2>
            <p className="card__hint">The invite email is captured in the outbox with a set-password link.</p>
          </div>
        </div>
        <form action={createRecruiterAction} className="form-grid">
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" name="email" required placeholder="hiring@company.com" />
          </div>
          <div className="field">
            <label htmlFor="orgName">Organisation</label>
            <input id="orgName" className="input" name="orgName" required placeholder="Acme AI" />
          </div>
          <div className="field">
            <label htmlFor="seats">Seats</label>
            <input id="seats" className="input" type="number" name="seats" min={1} max={50} defaultValue={1} />
          </div>
          <div className="field">
            <label htmlFor="trialDays">Trial days</label>
            <input id="trialDays" className="input" type="number" name="trialDays" min={0} max={90} defaultValue={14} />
          </div>
          <div className="field field--full">
            <button className="btn btn--primary" type="submit">
              Create seat and send invite
            </button>
          </div>
        </form>
      </section>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Organisation</th>
              <th>Recruiter</th>
              <th>Seats</th>
              <th>Status</th>
              <th>Trial ends</th>
              <th>Usage</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td><strong>{account.orgName}</strong></td>
                <td>
                  {account.user.email}
                  <div className="faint" style={{ fontSize: 11.5 }}>
                    {account.user.status}
                    {account.user.inviteToken ? " · invite pending" : ""}
                  </div>
                </td>
                <td className="mono">{account.seatCount}</td>
                <td>
                  <span
                    className={`badge ${
                      account.billingStatus === "active"
                        ? "badge--verified"
                        : account.billingStatus === "trial"
                          ? "badge--pending"
                          : "badge--failed"
                    }`}
                  >
                    {account.billingStatus}
                  </span>
                </td>
                <td className="faint">
                  {formatDate(account.trialEndsAt)}
                  {account.billingStatus === "trial" ? ` · ${daysLeft(account.trialEndsAt)}d` : ""}
                </td>
                <td className="faint" style={{ fontSize: 11.5 }}>
                  {account._count.interests} outreach · {account._count.savedSearches} searches ·{" "}
                  {account._count.shortlists} lists
                </td>
                <td>
                  <div className="row" style={{ gap: 4 }}>
                    {[
                      { action: "extend_trial", label: "+14d trial" },
                      { action: "comp", label: "Comp" },
                      account.user.status === "active"
                        ? { action: "suspend", label: "Suspend" }
                        : { action: "resume", label: "Resume" },
                    ].map((item) => (
                      <form action={updateRecruiterAction} key={item.action}>
                        <input type="hidden" name="accountId" value={account.id} />
                        <input type="hidden" name="action" value={item.action} />
                        <button className="btn btn--ghost btn--sm" type="submit">
                          {item.label}
                        </button>
                      </form>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
