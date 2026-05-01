/**
 * Stripe webhook event-id idempotency cache.
 *
 * Two-function helper used by /api/stripe/webhook to short-circuit duplicate
 * event deliveries from Stripe BEFORE any DB write happens.
 *
 * Storage: Postgres (stripe_webhook_events table — see migration 054). The
 * monorepo doesn't ship Upstash/Vercel-KV, so we reuse the existing Neon
 * connection rather than introduce a new dependency + secret pair. An atomic
 * INSERT…ON CONFLICT DO NOTHING gives the same idempotency guarantee a
 * SETNX-with-TTL would in Redis. Expired rows are swept by a periodic cleanup
 * (key prefix in the table is implicit — every row IS a webhook event).
 *
 * TTL: 7 days (Stripe retries up to 3 days; this is comfortable margin).
 *
 * Graceful degradation: if the DB read in seenEvent() throws, we return
 * FALSE (let the event through). The inner handler's session-id dedup
 * (getPurchaseByStripeSessionId) catches actual duplicates as second-layer
 * protection. A DB outage must NOT block payment processing — but if the DB
 * is down we'd fail to write the purchase row anyway, so this is mostly
 * defensive against transient read errors.
 *
 * Track C of the macro stack-migration plan.
 */

import { sql } from "@/lib/db";

/**
 * Returns true if we've already processed this Stripe event id.
 *
 * Returns FALSE on read failure (graceful degradation — see module docstring).
 * Also returns FALSE if the row exists but has expired (treats expired rows
 * as if they were never seen, matching Redis TTL semantics).
 */
export async function seenEvent(eventId: string): Promise<boolean> {
  try {
    const result = await sql.query(
      `SELECT 1
         FROM stripe_webhook_events
        WHERE event_id = $1
          AND expires_at > NOW()
        LIMIT 1`,
      [eventId],
    );
    return result.rows.length > 0;
  } catch (err) {
    console.error(
      `webhook-event-cache: seenEvent read failed for ${eventId}, defaulting to false:`,
      err,
    );
    return false;
  }
}

/**
 * Record that we've successfully processed this Stripe event id.
 *
 * Sets a 7-day TTL via the expires_at column (default in the schema).
 * Uses ON CONFLICT DO NOTHING — if the row already exists we leave the
 * existing TTL alone (don't extend it on a duplicate-mark call).
 *
 * Errors are logged and swallowed: failing to mark seen is non-fatal
 * because the inner handler's session-id dedup is still in place.
 */
export async function markEventSeen(eventId: string): Promise<void> {
  try {
    await sql.query(
      `INSERT INTO stripe_webhook_events (event_id)
         VALUES ($1)
         ON CONFLICT (event_id) DO NOTHING`,
      [eventId],
    );
  } catch (err) {
    console.error(
      `webhook-event-cache: markEventSeen failed for ${eventId}:`,
      err,
    );
  }
}
