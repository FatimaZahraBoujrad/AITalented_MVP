import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { recruiterHasAccess } from "@/lib/access";
import { billingConfigured, PLAN_LABEL } from "@/lib/stripe";
import { daysLeft, formatDate } from "@/lib/labels";
import { openPortalAction, startCheckoutAction } from "@/app/actions/billing";
import { Flash, PageHeader } from "@/components/ui";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string; locked?: string }>;
}) {
  const params = await searchParams;
  const user = await requireRole("recruiter");
  const account = user.recruiter;
  if (!account) return null;

  const access = recruiterHasAccess(account);
  const configured = billingConfigured();

  return (
    <div className="shell shell--narrow">
      <PageHeader
        kicker="Pilot billing"
        title="Subscription"
        sub="One plan, one price, per seat monthly. Trials run 14 days with full access; a card is required to continue."
      />
      <Flash
        error={params.error}
        success={params.success}
        warn={
          params.locked
            ? "Access is locked until the subscription is active. Shortlists and saved searches are preserved."
            : undefined
        }
      />

      <div className="stack">
        <section className="card">
          <div className="card__head">
            <div>
              <h2 className="card__title">{PLAN_LABEL}</h2>
              <p className="card__hint">{account.orgName}</p>
            </div>
            <span className={`badge ${access ? "badge--verified" : "badge--failed"}`}>
              {account.billingStatus === "trial" ? "Trial" : account.billingStatus}
            </span>
          </div>
          <dl style={{ margin: "4px 0 0" }}>
            <div className="kv">
              <dt>Seats</dt>
              <dd>{account.seatCount}</dd>
            </div>
            <div className="kv">
              <dt>Price</dt>
              <dd>$199 / seat / month</dd>
            </div>
            <div className="kv">
              <dt>Trial ends</dt>
              <dd>
                {formatDate(account.trialEndsAt)}{" "}
                {account.billingStatus === "trial" ? `· ${daysLeft(account.trialEndsAt)} day(s) left` : ""}
              </dd>
            </div>
            <div className="kv">
              <dt>Stripe customer</dt>
              <dd className="mono">{account.stripeCustomerId ?? "not linked yet"}</dd>
            </div>
            <div className="kv">
              <dt>Access</dt>
              <dd>{access ? "Active" : "Locked"}</dd>
            </div>
          </dl>

          <div className="actions" style={{ marginTop: 16 }}>
            {account.stripeCustomerId ? (
              <form action={openPortalAction}>
                <button className="btn" type="submit" disabled={!configured}>
                  Manage seats in Stripe Portal
                </button>
              </form>
            ) : null}
            <form action={startCheckoutAction}>
              <button className="btn btn--primary" type="submit" disabled={!configured}>
                {account.billingStatus === "active" ? "Update payment method" : "Subscribe with Stripe"}
              </button>
            </form>
            <Link className="btn btn--ghost" href="/recruiter">
              Back to search
            </Link>
          </div>

          {!configured ? (
            <div className="flash flash--warn" style={{ marginTop: 14, marginBottom: 0 }}>
              <span aria-hidden>!</span>
              <span>
                Stripe is not configured in this environment. Add <code>STRIPE_SECRET_KEY</code>,{" "}
                <code>STRIPE_PRICE_ID</code> and <code>STRIPE_WEBHOOK_SECRET</code> to enable
                checkout, portal and webhooks. The trial works without them, but no payment can be
                taken.
              </span>
            </div>
          ) : (
            <p className="form-note" style={{ marginTop: 12 }}>
              Seat changes go through the Stripe Customer Portal; webhooks update the seat count and
              subscription status. Webhook events are processed idempotently.
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="card__title">What the pilot includes</h2>
          <ul className="muted" style={{ fontSize: 13, lineHeight: 1.8, paddingLeft: 18, margin: "10px 0 0" }}>
            <li>Full search with all ML filters, ranking and verification badges.</li>
            <li>Profile detail, shortlists with CSV export, saved searches and weekly digests.</li>
            <li>Express interest with candidate-controlled contact reveal.</li>
            <li>No messaging, no ATS, no job postings — deliberately.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
