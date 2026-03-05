/**
 * Stripe Checkout Session helpers — adapted for vault.
 *
 * Supports both org-level and individual (no-org) purchases.
 * When a user has an org, we create/reuse a Stripe customer per org.
 * When a user has no org, we create a Stripe customer per user.
 */

import { getStripe } from "./client";
import {
  getOrgStripeCustomerId,
  setOrgStripeCustomerId,
} from "@/lib/queries/organisations";
import { sql } from "@/lib/db";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://windedvertigo.com/harbor/vertigo-vault";

/**
 * Get or create a Stripe customer for an org.
 */
async function getOrCreateOrgStripeCustomer(
  orgId: string,
  orgName: string,
  email: string,
): Promise<string> {
  const existingId = await getOrgStripeCustomerId(orgId);
  if (existingId) return existingId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: orgName,
    email,
    metadata: { orgId, source: "vertigo-vault" },
  });

  await setOrgStripeCustomerId(orgId, customer.id);
  return customer.id;
}

/**
 * Get or create a Stripe customer for an individual user (no org).
 */
async function getOrCreateUserStripeCustomer(
  userId: string,
  email: string,
  name?: string | null,
): Promise<string> {
  // Check for existing Stripe customer on the user
  const r = await sql.query(
    "SELECT stripe_customer_id FROM users WHERE id = $1 LIMIT 1",
    [userId],
  );
  const existingId = r.rows[0]?.stripe_customer_id;
  if (existingId) return existingId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    name: name ?? email,
    email,
    metadata: { userId, source: "vertigo-vault" },
  });

  await sql.query(
    "UPDATE users SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2",
    [customer.id, userId],
  );

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for a vault pack purchase.
 * Returns the session URL to redirect the user to.
 */
export async function createCheckoutSession(opts: {
  orgId: string | null;
  orgName: string | null;
  email: string;
  userName: string | null;
  packCacheId: string;
  catalogueId: string;
  packTitle: string;
  priceCents: number;
  currency: string;
  userId: string;
  stripePriceId?: string;
}): Promise<string> {
  const stripe = getStripe();

  // Get/create Stripe customer: org-level if user has an org, user-level otherwise
  const customerId = opts.orgId && opts.orgName
    ? await getOrCreateOrgStripeCustomer(opts.orgId, opts.orgName, opts.email)
    : await getOrCreateUserStripeCustomer(opts.userId, opts.email, opts.userName);

  const description = opts.orgId
    ? `vertigo vault pack — perpetual access for ${opts.orgName}`
    : `vertigo vault pack — perpetual individual access`;

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
      source: "vertigo-vault",
    },
    allow_promotion_codes: true,
    success_url: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}&pack=${encodeURIComponent(opts.packTitle)}`,
    cancel_url: APP_URL,
  });

  if (!session.url) {
    throw new Error("stripe did not return a checkout URL");
  }

  return session.url;
}
