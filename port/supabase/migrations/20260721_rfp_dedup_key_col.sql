-- F1 (prevent duplicate radar cards) — part 1 of 2: normalised dedup key.
--
-- Adds a generated, alphanumeric-only lowercased key derived from the
-- opportunity name. Collapses the punctuation/spacing variance that defeated
-- the old exact-match dedup (e.g. "… – Turkmenistan" vs "… (Turkmenistan)"
-- previously read as two different grants and produced duplicate cards).
--
-- Additive + non-destructive: safe to apply at any time — no cleanup required.
-- Keep the expression in lockstep with normaliseRfpDedupKey() in
-- lib/supabase/rfp-opportunities.ts.

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS dedup_key text
  GENERATED ALWAYS AS (regexp_replace(lower(opportunity_name), '[^a-z0-9]+', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS rfp_opportunities_dedup_key_idx
  ON rfp_opportunities (dedup_key);
