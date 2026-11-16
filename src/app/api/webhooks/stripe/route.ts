import type Stripe from "stripe";
import { db } from "@/lib/db";
import { stripeClient } from "@/lib/stripe";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook (§7.9, §10.4). Signature-verified and idempotent: every event id is stored
 * before the side effect is applied, so retries never double-apply.
 */
export async function POST(request: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return Response.json({ error: "Billing is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing signature" }, { status: 400 });

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  const seen = await db.processedStripeEvent.findUnique({ where: { id: event.id } });
  if (seen) return Response.json({ received: true, duplicate: true });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const accountId = session.client_reference_id ?? session.metadata?.recruiterAccountId;
        if (accountId) {
          await db.recruiterAccount.update({
            where: { id: accountId },
            data: {
              billingStatus: "active",
              stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
              stripeSubscriptionId:
                typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null,
            },
          });
        }
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const accountId = subscription.metadata?.recruiterAccountId;
        const status = subscription.status;
        const billingStatus =
          status === "active" || status === "trialing"
            ? "active"
            : status === "past_due" || status === "unpaid"
              ? "past_due"
              : "canceled";
        const data = {
          billingStatus: billingStatus as "active" | "past_due" | "canceled",
          seatCount: subscription.items.data[0]?.quantity ?? 1,
          stripeSubscriptionId: subscription.id,
          stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
        };
        if (accountId) {
          await db.recruiterAccount.update({ where: { id: accountId }, data });
        } else {
          await db.recruiterAccount.updateMany({
            where: {
              OR: [
                { stripeSubscriptionId: subscription.id },
                { stripeCustomerId: data.stripeCustomerId },
              ],
            },
            data,
          });
        }
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customer) {
          await db.recruiterAccount.updateMany({
            where: { stripeCustomerId: customer },
            data: { billingStatus: "past_due" },
          });
        }
        break;
      }
      default:
        break;
    }

    await db.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
    await audit({
      actorUserId: null,
      action: "billing.webhook",
      entityType: "recruiterAccount",
      metadata: { eventId: event.id, type: event.type },
    });
    return Response.json({ received: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Webhook handling failed" },
      { status: 500 },
    );
  }
}
