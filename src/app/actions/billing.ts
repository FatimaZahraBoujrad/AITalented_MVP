"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { appUrl } from "@/lib/url";
import { billingConfigured, priceId, stripeClient } from "@/lib/stripe";

export async function startCheckoutAction(): Promise<void> {
  const user = await requireRole("recruiter");
  if (!user.recruiter) redirect("/recruiter/billing");
  if (!billingConfigured()) {
    redirect("/recruiter/billing?error=Stripe is not configured for this environment");
  }
  const stripe = stripeClient();
  if (!stripe) redirect("/recruiter/billing?error=Stripe is not configured for this environment");

  const account = user.recruiter;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId(), quantity: Math.max(1, account.seatCount) }],
    customer: account.stripeCustomerId ?? undefined,
    customer_email: account.stripeCustomerId ? undefined : user.email,
    client_reference_id: account.id,
    subscription_data: { metadata: { recruiterAccountId: account.id } },
    metadata: { recruiterAccountId: account.id },
    success_url: `${appUrl()}/recruiter/billing?success=Subscription%20active`,
    cancel_url: `${appUrl()}/recruiter/billing?error=Checkout%20canceled`,
    allow_promotion_codes: true,
  });

  if (!session.url) redirect("/recruiter/billing?error=Stripe did not return a checkout URL");
  redirect(session.url);
}

export async function openPortalAction(): Promise<void> {
  const user = await requireRole("recruiter");
  if (!user.recruiter) redirect("/recruiter/billing");
  if (!billingConfigured()) {
    redirect("/recruiter/billing?error=Stripe is not configured for this environment");
  }
  const stripe = stripeClient();
  if (!stripe || !user.recruiter.stripeCustomerId) {
    redirect("/recruiter/billing?error=No billing account yet — start a subscription first");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: user.recruiter.stripeCustomerId,
    return_url: `${appUrl()}/recruiter/billing`,
  });
  redirect(session.url);
}

export async function refreshBillingAction(): Promise<void> {
  const user = await requireRole("recruiter");
  if (!user.recruiter) redirect("/recruiter/billing");
  const account = await db.recruiterAccount.findUnique({ where: { id: user.recruiter.id } });
  if (!account) redirect("/recruiter/billing");
  redirect(
    account.billingStatus === "active"
      ? "/recruiter/billing?success=Subscription%20active"
      : "/recruiter/billing",
  );
}
