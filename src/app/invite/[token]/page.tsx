import Link from "next/link";
import { db } from "@/lib/db";
import { acceptInviteAction } from "@/app/actions/auth";
import { Flash } from "@/components/ui";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const search = await searchParams;
  const user = await db.user.findUnique({ where: { inviteToken: token } });

  if (!user) {
    return (
      <div className="auth">
        <div className="auth-card">
          <div className="card">
            <div className="kicker">Invitation</div>
            <h1 style={{ marginTop: 8 }}>This invite is not usable.</h1>
            <p className="page-sub" style={{ textAlign: "left", margin: "10px 0 18px" }}>
              The link is invalid or has already been used. Ask the AITalented team for a fresh
              invitation, or log in if you already set a password.
            </p>
            <div className="actions">
              <Link className="btn btn--primary" href="/login">
                Log in
              </Link>
              <Link className="btn" href="/">
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isCandidate = user.role === "candidate";
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
          <div className="kicker">{isCandidate ? "Candidate invitation" : "Recruiter invitation"}</div>
          <h1 style={{ marginTop: 8 }}>Set your password</h1>
          <p className="page-sub" style={{ textAlign: "left", margin: "10px 0 18px" }}>
            {user.email} has been invited{isCandidate ? " to build a verified ML portfolio" : " to the verified ML talent index"}.
          </p>
          <Flash error={search.error} />
          <form action={acceptInviteAction} className="stack" style={{ gap: 14 }}>
            <input type="hidden" name="token" value={token} />
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
            {isCandidate ? (
              <label className="check">
                <input type="checkbox" name="consent" />
                <span>
                  My verified profile is searchable by recruiters. I can hide it at any time.
                </span>
              </label>
            ) : null}
            <button className="btn btn--primary btn--wide" type="submit">
              Set password &amp; continue
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
