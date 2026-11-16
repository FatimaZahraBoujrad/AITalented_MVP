import Stripe from "stripe";

export const PLAN_LABEL = "Pilot — per seat, monthly";

/** Billing is optional at boot: without keys the trial still works and the UI says so. */
export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);
}

export function stripeClient(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    // Pin nothing beyond the SDK's own default to keep webhook payloads stable.
    typescript: true,
  });
}

export function priceId(): string {
  return process.env.STRIPE_PRICE_ID ?? "";
}
