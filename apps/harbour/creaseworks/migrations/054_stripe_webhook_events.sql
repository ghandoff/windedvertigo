-- 054: stripe webhook event-id idempotency cache
--
-- Records every Stripe webhook event we've successfully processed, keyed by
-- the Stripe event.id. The webhook handler short-circuits with 200 if a
-- duplicate event arrives (Stripe occasionally re-delivers).
--
-- This is a SECOND layer of dedup on top of the existing session-id check
-- in lib/queries/purchases.ts (getPurchaseByStripeSessionId). The session-id
-- check only catches scenarios that would create the same Purchase row;
-- this catches every duplicate event before any DB write happens.
--
-- Track C of the macro stack-migration plan
-- (~/.claude/plans/just-ran-into-an-refactored-spark.md). Also a precursor
-- for the eventual creaseworks → CF Workers migration: CF Workers don't
-- auto-retry on 5xx like Vercel does, so event-level dedup becomes
-- load-bearing once that migration lands.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id    TEXT PRIMARY KEY,
  seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

-- Index for the periodic purge of expired rows. Stripe retries up to 3 days;
-- we hold rows for 7 days as a safety margin. A cron job (or weekly manual
-- sweep) can DELETE WHERE expires_at < NOW().
CREATE INDEX IF NOT EXISTS stripe_webhook_events_expires_at_idx
  ON stripe_webhook_events (expires_at);
