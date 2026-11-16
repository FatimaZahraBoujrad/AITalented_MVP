import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { changePasswordAction, deleteAccountAction } from "@/app/actions/auth";
import { Flash, PageHeader } from "@/components/ui";

export default async function CandidateSettings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("candidate");

  return (
    <div className="shell shell--narrow">
      <PageHeader
        kicker="Account"
        title="Settings"
        sub="Your data, your controls. Export is JSON; deletion is a hard delete of the account and its profile."
      />
      <Flash error={params.error} success={params.success} />

      <div className="stack">
        <section className="card">
          <h2 className="card__title">Account</h2>
          <dl style={{ margin: "10px 0 0" }}>
            <div className="kv">
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="kv">
              <dt>Email verified</dt>
              <dd>{user.emailVerified ? "Yes" : "No — profile not searchable"}</dd>
            </div>
            <div className="kv">
              <dt>Role</dt>
              <dd>{user.role}</dd>
            </div>
            <div className="kv">
              <dt>Joined</dt>
              <dd>{user.createdAt.toLocaleDateString("en-GB")}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2 className="card__title">Change password</h2>
          <p className="card__hint">Passwords are stored with bcrypt and never logged.</p>
          <form action={changePasswordAction} className="stack" style={{ gap: 12, marginTop: 12 }}>
            <div className="field">
              <label htmlFor="current">Current password</label>
              <input id="current" className="input" type="password" name="current" required autoComplete="current-password" />
            </div>
            <div className="field">
              <label htmlFor="next">New password</label>
              <input id="next" className="input" type="password" name="next" required minLength={8} autoComplete="new-password" />
            </div>
            <div className="row">
              <button className="btn btn--primary" type="submit">
                Update password
              </button>
            </div>
          </form>
        </section>

        <section className="card">
          <h2 className="card__title">Your data</h2>
          <p className="card__hint">
            GDPR: download a JSON export of your profile, skills, projects, credentials and inbox.
          </p>
          <div className="actions" style={{ marginTop: 12 }}>
            <a className="btn" href="/api/candidate/export" download>
              Download JSON export
            </a>
            <Link className="btn btn--ghost" href="/candidate/preview">
              Recruiter preview
            </Link>
          </div>
        </section>

        <section className="card" style={{ borderColor: "rgba(248,113,113,.25)" }}>
          <h2 className="card__title" style={{ color: "#fca5a5" }}>Delete account</h2>
          <p className="card__hint">
            Hard delete: profile, claims, evidence links and inbox requests are removed. Download
            your export first. This cannot be undone.
          </p>
          <form action={deleteAccountAction} className="row" style={{ marginTop: 12, gap: 8 }}>
            <input className="input" style={{ maxWidth: 180 }} name="confirm" placeholder="Type DELETE" aria-label="Type DELETE to confirm" />
            <button className="btn btn--danger" type="submit">
              Delete my account
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
