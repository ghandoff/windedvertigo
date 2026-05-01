/**
 * Shared Stripe Checkout Session creation for all harbour apps.
 *
 * Supports both org-level and individual user purchases.
 * Each app calls createHarbourCheckout() with its app name,
 * and the session metadata tracks which app initiated the purchase.
 */

import { getStripe } from "./client";
import {
  getUserStripeCustomerId,
  setUserStripeCustomerId,
  getOrgStripeCustomerId,
  setOrgStripeCustomerId,
} from "./queries";

/**
 * Get or create a Stripe customer — user-level by default,
 * org-level if the user has an org.
 */
export async function getOrCreateStripeCustomer(opts: {
  userId: string;
  email: string;
  name?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  app: string;
}): Promise<string> {
  // If user has an org, prefer org-level customer
  if (opts.orgId && opts.orgName) {
    const existingOrgId = await getOrgStripeCustomerId(opts.orgId);
    if (existingOrgId) return existingOrgId;

    const stripe = getStripe();
    const customer = await stripe.customers.create({
      name: opts.orgName,
      email: opts.email,
      metadata: { orgId: opts.orgId, source: opts.app },
    });

    await setOrgStripeCustomerId(opts.orgId, customer.id);
    return customer.id;
  }

  // Individual user customer
  const existingUserId = await getUserStripeCustomerId(opts.userId);
  if (existingUserId) return existingUserId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: opts.name ?? opts.email,
    email: opts.email,
    metadata: { userId: opts.userId, source: opts.app },
  });

  await setUserStripeCustomerId(opts.userId, customer.id);
  return customer.id;
}

/**
 * Create a Stripe Checkout Session for a harbour app purchase.
 * Returns the checkout URL to redirect the user to.
 */
export async function createHarbourCheckout(opts: {
  app: string;
  appUrl: string;
  userId: string;
  email: string;
  userName?: string | null;
  orgId?: string | null;
  orgName?: string | null;
  packCacheId: string;
  catalogueId: string;
  packTitle: string;
  priceCents: number;
  currency: string;
  stripePriceId?: string;
  successPath?: string;
  cancelPath?: string;
}): Promise<string> {
  const stripe = getStripe();

  const customerId = await getOrCreateStripeCustomer({
    userId: opts.userId,
    email: opts.email,
    name: opts.userName,
    orgId: opts.orgId,
    orgName: opts.orgName,
    app: opts.app,
  });

  const description = opts.orgId
    ? `${opts.app} — perpetual access for ${opts.orgName}`
    : `${opts.app} — perpetual individual access`;

  const successPath = opts.successPath ?? "/checkout/success";
  const cancelPath = opts.cancelPath ?? "/";

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
                description,
              },
              unit_amount: opts.priceCents,
            },
            quantity: 1,
          },
    ],
    metadata: {
      orgId: opts.orgId ?? "",
      packCacheId: opts.packCacheId,
      catalogueId: opts.catalogueId,
      userId: opts.userId,
      packTitle: opts.packTitle,
      app: opts.app,
    },
    allow_promotion_codes: true,
    success_url: `${opts.appUrl}${successPath}?session_id={CHECKOUT_SESSION_ID}&pack=${encodeURIComponent(opts.packTitle)}`,
    cancel_url: `${opts.appUrl}${cancelPath}`,
  });

  if (!session.url) {
    throw new Error("stripe did not return a checkout URL");
  }

  return session.url;
}
