-- Migration 022: AICS-scoped claim backfill
--
-- Adds two columns to pcs_claims for the redesigned backfill review:
--
--   matched_aics_claim_id  — the AICS claim a researcher confirmed this
--                            PCS claim corresponds to, via the AICS-scoped
--                            backfill review UI. Distinct from
--                            source_aics_claim_id (which means the PCS claim
--                            was auto-created by the AICS broadcasting engine).
--
--   aics_match_confidence  — the fuzzy-match confidence score (0–1) the
--                            matcher proposed at review time. Stored for audit:
--                            lets us later measure how often the algorithm was
--                            overridden vs. accepted.
--
-- Also creates the singleton cache table used by the new
-- /api/pcs/aics-backfill endpoint.

ALTER TABLE pcs_claims
  ADD COLUMN IF NOT EXISTS matched_aics_claim_id  TEXT,
  ADD COLUMN IF NOT EXISTS aics_match_confidence  NUMERIC;

CREATE INDEX IF NOT EXISTS idx_pcs_claims_matched_aics
  ON pcs_claims(matched_aics_claim_id);

-- Cache table for /api/pcs/aics-backfill (singleton row, same pattern as
-- pcs_backfill_proposals_cache used by the legacy backfill endpoint).
CREATE TABLE IF NOT EXISTS pcs_aics_backfill_cache (
  id           TEXT        PRIMARY KEY DEFAULT 'singleton',
  groups       JSONB       NOT NULL,
  built_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  claim_count  INTEGER     NOT NULL DEFAULT 0
);
