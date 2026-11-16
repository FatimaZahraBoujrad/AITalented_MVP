import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { homeForRole } from "@/lib/auth";
import { signupAction } from "@/app/actions/auth";
import { Flash } from "@/components/ui";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(homeForRole(user.role));

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand">
          <span className="brand-mark">AT</span>
          <span>
            AITalented
            <small>Verified ML index</small>
          </span>
        </div>
        <div className="card">
          <h1>Build a verified profile</h1>
          <p className="page-sub">
            Structured, evidence-checked, free for candidates. Recruiters only see what you make
            visible.
          </p>
          <Flash error={params.error} />
          <form action={signupAction} className="stack" style={{ gap: 14 }}>
            <div className="field">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" className="input" name="fullName" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" className="input" type="email" name="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
              <span className="hint">At least 8 characters.</span>
            </div>
            <label className="check">
              <input type="checkbox" name="consent" />
              <span>
                My verified profile is searchable by recruiters. I can hide it at any time and it
                will never appear in search, digests or exports while hidden.
              </span>
            </label>
            <button className="btn btn--primary btn--wide" type="submit">
              Create candidate account
            </button>
          </form>
          <p className="form-note" style={{ marginTop: 14, textAlign: "center" }}>
            Recruiters are invited by the AITalented team.{" "}
            <Link className="link" href="/login">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
