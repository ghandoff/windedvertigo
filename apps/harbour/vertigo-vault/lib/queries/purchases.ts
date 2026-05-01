/**
 * Purchase queries — adapted for vault (supports individual + org purchases).
 */

import { sql } from "@/lib/db";

/** Queryable interface shared by the pool-level `sql` and a dedicated client. */
type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }> };

/**
 * Create a purchase record.
 * orgId is optional — null for individual (no-org) purchases.
 * Pass a `client` when running inside a transaction.
 */
export async function createPurchase(
  opts: {
    orgId: string | null;
    packCatalogueId: string;
    purchaserId: string;
    amountCents: number;
    currency: string;
    paymentProvider: string;
    paymentRef: string | null;
    stripeSessionId: string | null;
    stripePaymentIntentId: string | null;
  },
  client: Queryable = sql,
): Promise<string> {
  const result = await client.query(
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
 * Used for webhook idempotency — prevents duplicate purchases.
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
