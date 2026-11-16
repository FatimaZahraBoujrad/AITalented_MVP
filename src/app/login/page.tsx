import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { homeForRole } from "@/lib/auth";
import { loginAction } from "@/app/actions/auth";
import { Flash } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
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
          <h1>Welcome back</h1>
          <p className="page-sub">Log in to your candidate, recruiter or admin workspace.</p>
          <Flash error={params.error} />
          <form action={loginAction} className="stack" style={{ gap: 14 }}>
            <input type="hidden" name="next" value={params.next ?? ""} />
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
                autoComplete="current-password"
              />
            </div>
            <button className="btn btn--primary btn--wide" type="submit">
              Log in
            </button>
          </form>
          <div className="demo-box">
            <strong style={{ color: "var(--ink)" }}>Pilot demo accounts</strong>
            <br />
            Recruiter — <code>recruiter@aitalented.dev</code> / <code>recruiter123</code>
            <br />
            Candidate — <code>candidate@aitalented.dev</code> / <code>candidate123</code>
            <br />
            Admin — <code>admin@aitalented.dev</code> / <code>admin12345</code>
          </div>
          <p className="form-note" style={{ marginTop: 14, textAlign: "center" }}>
            Candidate without an account?{" "}
            <Link className="link" href="/signup">
              Build your profile
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
