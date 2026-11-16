import Link from "next/link";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { Flash } from "@/components/ui";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  let state: "missing" | "invalid" | "verified" = params.token ? "invalid" : "missing";

  if (params.token) {
    const user = await db.user.findUnique({ where: { emailVerifyToken: params.token } });
    if (user) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: true, emailVerifyToken: null },
      });
      await audit({
        actorUserId: user.id,
        action: "candidate.email_verified",
        entityType: "user",
        entityId: user.id,
      });
      state = "verified";
    }
  }

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="card">
          <div className="kicker">Email verification</div>
          <h1 style={{ marginTop: 8 }}>
            {state === "verified"
              ? "You're verified."
              : state === "invalid"
                ? "That link is not valid."
                : "Check your inbox."}
          </h1>
          <p className="page-sub" style={{ textAlign: "left", margin: "10px 0 18px" }}>
            {state === "verified"
              ? "Your email is confirmed. Your profile is now eligible to appear in recruiter search (as long as it is visible)."
              : state === "invalid"
                ? "The verification link has expired or has already been used. Request a fresh one from your dashboard."
                : "Open the verification link we emailed you to make your profile searchable. In this pilot environment, verification emails are captured in the admin outbox."}
          </p>
          <Flash error={params.error} />
          <div className="actions">
            {state === "verified" ? (
              <Link className="btn btn--primary" href="/candidate">
                Continue to profile
              </Link>
            ) : (
              <>
                <Link className="btn" href="/candidate">
                  Back to dashboard
                </Link>
                <Link className="btn btn--primary" href="/login">
                  Log in
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
