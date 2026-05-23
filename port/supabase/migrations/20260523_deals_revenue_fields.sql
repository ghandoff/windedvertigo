-- Add revenue-tier columns to deals table so the StrategyHero progress bar
-- can read live confidence/payment data instead of hardcoded REVENUE_PROGRESS.
--
-- revenue_tier   — manual CMO classification: signed/advanced/negotiation/open
-- received_amount — cash already received for signed deals (enables paid-vs-signed split)
-- contracted_amount — override for the confidence-weighted value shown in the bar
--                    (falls back to the existing `value` column when NULL)

ALTER TABLE deals ADD COLUMN IF NOT EXISTS revenue_tier text
  CHECK (revenue_tier IN ('signed', 'advanced', 'negotiation', 'open'));

ALTER TABLE deals ADD COLUMN IF NOT EXISTS received_amount numeric DEFAULT 0 NOT NULL;

ALTER TABLE deals ADD COLUMN IF NOT EXISTS contracted_amount numeric;

COMMENT ON COLUMN deals.revenue_tier IS 'CMO-set confidence tier for the strategy hero bar. NULL = not in revenue pipeline.';
COMMENT ON COLUMN deals.received_amount IS 'Cash received to date for signed deals. Used to split paid vs signed in the bar.';
COMMENT ON COLUMN deals.contracted_amount IS 'Override value for the revenue bar. Falls back to deals.value when NULL.';
