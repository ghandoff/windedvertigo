-- creaseworks migration: add Stripe integration fields
-- version: 003
-- date: 2026-02-19
-- description: add stripe_customer_id to organisations, stripe fields to purchases

-- Stripe customer ID per organisation (one customer = one org)
ALTER TABLE organisations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Stripe session and payment intent IDs on purchases for webhook lookup
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Index for fast webhook idempotency check
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session ON purchases(stripe_session_id);

-- Index for Stripe customer lookup
CREATE INDEX IF NOT EXISTS idx_orgs_stripe_customer ON organisations(stripe_customer_id);
