/**
 * Purchase queries — create and look up purchase records.
 *
 * Post-MVP — Stripe integration.
 */

import { sql } from "@/lib/db";

/**
 * Create a purchase record.
 * Returns the new purchase ID.
 */
export async function createPurchase(opts: {
  orgId: string;
  packCatalogueId: string;
  purchaserId: string;
  amountCents: number;
  currency: string;
  paymentProvider: string;
  paymentRef: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
}): Promise<string> {
  const result = await sql.query(
    `INSERT INTO purchases
       (org_id, pack_catalogue_id, purchaser_id, amount_cents, currency,
        payment_provider, payment_ref, status,
        stripe_session_id, stripe_payment_intent_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, $9)
     RETURNING id`,
    [
      opts.orgId,
      opts.packCatalogueId,
      opts.purchaserId,
      opts.amountCents,
      opts.currency,
      opts.paymentProvider,
      opts.paymentRef,
      opts.stripeSessionId,
      opts.stripePaymentIntentId,
    ],
  );
  return result.rows[0].id;
}

/**
 * Look up a purchase by Stripe session ID.
 * Used for webhook idempotency — if a purchase already exists
 * for this session, don't create a duplicate.
 */
export async function getPurchaseByStripeSessionId(
  sessionId: string,
): Promise<{ id: string } | null> {
  const result = await sql.query(
    `SELECT id FROM purchases
     WHERE stripe_session_id = $1
     LIMIT 1`,
    [sessionId],
  );
  return result.rows[0] ?? null;
}
