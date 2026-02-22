-- Migration 010: Add missing indexes identified in audit.
--
-- runs_cache.created_by and runs_cache.org_id are used in the
-- visibility WHERE clause on every runs query and export.
-- purchases.stripe_session_id is used for idempotency in the
-- Stripe webhook handler.

CREATE INDEX IF NOT EXISTS idx_runs_cache_created_by ON runs_cache (created_by);
CREATE INDEX IF NOT EXISTS idx_runs_cache_org_id ON runs_cache (org_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session_id ON purchases (stripe_session_id);
