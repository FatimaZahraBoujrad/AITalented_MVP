import Link from "next/link";
import { db } from "@/lib/db";
import { unsubscribeDigestAction } from "@/app/actions/digest";
import { Flash } from "@/components/ui";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; success?: string; error?: string }>;
}) {
  const params = await searchParams;
  const search = params.token
    ? await db.savedSearch.findUnique({
        where: { digestToken: params.token },
        include: { recruiterAccount: true },
      })
    : null;

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="card">
          <div className="kicker">Email preferences</div>
          <h1 style={{ marginTop: 8 }}>{search ? "Digest settings" : "Link not recognised"}</h1>
          <Flash error={params.error} success={params.success ? "Weekly digest turned off for this search." : undefined} />
          {search ? (
            <>
              <p className="page-sub" style={{ textAlign: "left", margin: "10px 0 18px" }}>
                Search <strong>{search.name}</strong> for {search.recruiterAccount.orgName}. Weekly
                digest is currently {search.digestEnabled ? "on" : "off"}.
              </p>
              {search.digestEnabled ? (
                <form action={unsubscribeDigestAction}>
                  <input type="hidden" name="token" value={params.token} />
                  <button className="btn btn--danger" type="submit">
                    Turn off weekly digest
                  </button>
                </form>
              ) : (
                <p className="muted">You are unsubscribed. You can re-enable it from Saved searches.</p>
              )}
            </>
          ) : (
            <p className="page-sub" style={{ textAlign: "left", margin: "10px 0 18px" }}>
              This unsubscribe link is invalid. Manage digests from your saved searches instead.
            </p>
          )}
          <p className="form-note" style={{ marginTop: 16 }}>
            <Link className="link" href="/">
              AITalented home
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
