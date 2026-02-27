/**
 * Stripe Checkout Session helpers.
 *
 * Creates hosted checkout sessions for one-time pack purchases.
 * Manages Stripe customer records per organisation.
 *
 * Post-MVP — Stripe integration.
 */

import { getStripe } from "./client";
import {
  getOrgStripeCustomerId,
  setOrgStripeCustomerId,
} from "@/lib/queries/organisations";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://creaseworks.windedvertigo.com";

/**
 * Get or create a Stripe customer for an organisation.
 * Stores the customer ID in the organisations table for reuse.
 */
export async function getOrCreateStripeCustomer(
  orgId: string,
  orgName: string,
  email: string,
): Promise<string> {
  // Check for existing Stripe customer
  const existingId = await getOrgStripeCustomerId(orgId);
  if (existingId) return existingId;

  // Create new Stripe customer
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: orgName,
    email,
    metadata: { orgId },
  });

  // Persist for future purchases
  await setOrgStripeCustomerId(orgId, customer.id);

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for a pack purchase.
 *
 * Returns the session URL to redirect the user to.
 */
export async function createCheckoutSession(opts: {
  orgId: string;
  orgName: string;
  email: string;
  packCacheId: string;
  catalogueId: string;
  packTitle: string;
  priceCents: number;
  currency: string;
  userId: string;
  stripePriceId?: string;
}): Promise<string> {
  const stripe = getStripe();

  const customerId = await getOrCreateStripeCustomer(
    opts.orgId,
    opts.orgName,
    opts.email,
  );

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      opts.stripePriceId
        ? { price: opts.stripePriceId, quantity: 1 }
        : {
            price_data: {
              currency: opts.currency.toLowerCase(),
              product_data: {
                name: opts.packTitle,
                description: `creaseworks playdate pack — perpetual access for ${opts.orgName}`,
              },
              unit_amount: opts.priceCents,
            },
            quantity: 1,
          },
    ],
    metadata: {
      orgId: opts.orgId,
      packCacheId: opts.packCacheId,
      catalogueId: opts.catalogueId,
      userId: opts.userId,
    },
    // Session 11: enable Stripe-hosted promo code UI on checkout page.
    // Create coupon codes in the Stripe dashboard (e.g. LAUNCH40, FRIEND20).
    allow_promotion_codes: true,
    success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&pack=${encodeURIComponent(opts.packTitle)}`,
    cancel_url: `${APP_URL}/packs`,
  });

  if (!session.url) {
    throw new Error("stripe did not return a checkout URL");
  }

  return session.url;
}
