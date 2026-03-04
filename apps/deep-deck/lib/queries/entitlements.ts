import { sql } from "@/lib/db";
import type { PackId } from "@/lib/types";

/** Check if a user has an active (non-revoked) entitlement for a pack. */
export async function checkEntitlement(
  userId: string,
  pack: PackId,
): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM entitlements
    WHERE user_id = ${userId}
      AND pack = ${pack}
      AND revoked_at IS NULL
    LIMIT 1
  `;
  return (result.rowCount ?? 0) > 0;
}

/** Get all active packs for a user. Always includes "sampler". */
export async function getUserPacks(userId: string): Promise<PackId[]> {
  const result = await sql`
    SELECT DISTINCT pack FROM entitlements
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
  `;
  const packs = new Set<PackId>(["sampler"]);
  for (const row of result.rows) {
    packs.add(row.pack as PackId);
  }
  return Array.from(packs);
}

/** Grant a pack entitlement to a user. Upserts (re-grants if previously revoked). */
export async function grantEntitlement(
  userId: string,
  pack: PackId,
  purchaseId?: string,
): Promise<void> {
  await sql`
    INSERT INTO entitlements (user_id, pack, purchase_id, granted_at)
    VALUES (${userId}, ${pack}, ${purchaseId ?? null}, NOW())
    ON CONFLICT (user_id, pack)
    DO UPDATE SET
      revoked_at = NULL,
      purchase_id = COALESCE(${purchaseId ?? null}, entitlements.purchase_id),
      granted_at = NOW()
  `;
}

/** Record a purchase and grant the entitlement. Returns purchase ID. */
export async function recordPurchase(opts: {
  userId: string;
  pack: PackId;
  amountCents: number;
  currency: string;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
}): Promise<string> {
  // Idempotency: check if already processed
  const existing = await sql`
    SELECT id FROM purchases
    WHERE stripe_session_id = ${opts.stripeSessionId}
    LIMIT 1
  `;
  if ((existing.rowCount ?? 0) > 0) {
    return existing.rows[0].id;
  }

  const purchase = await sql`
    INSERT INTO purchases (
      user_id, pack, amount_cents, currency,
      stripe_session_id, stripe_payment_intent_id
    ) VALUES (
      ${opts.userId}, ${opts.pack}, ${opts.amountCents}, ${opts.currency},
      ${opts.stripeSessionId}, ${opts.stripePaymentIntentId ?? null}
    )
    RETURNING id
  `;

  const purchaseId = purchase.rows[0].id;

  await grantEntitlement(opts.userId, opts.pack, purchaseId);

  return purchaseId;
}
