-- Migration 019: authority_regions column on pcs_claims
--
-- Adds a TEXT[] column to track which regulatory authorities a PCS claim
-- is valid under (FDA, EFSA, Health Canada, TGA, FSANZ, Japan MHLW, etc.).
--
-- Design notes:
--   - TEXT[] because a single claim can be permissible under multiple
--     jurisdictions. Use the Postgres @> operator to filter by region.
--   - Defaults to empty array (not NULL) so isEmpty checks are consistent
--     and the column can be treated as a set in all contexts.
--   - Data is intentionally NOT backfilled here — this is schema-only.
--     TASKS.md tracks the manual backfill effort.
--   - Column is part of the pcs_claims SELECT * read-path; no view changes
--     needed since parsePostgresRow in pcs-claims.js reads it explicitly.

ALTER TABLE pcs_claims
  ADD COLUMN IF NOT EXISTS authority_regions TEXT[] DEFAULT '{}' NOT NULL;

-- GIN index for fast containment queries (@> operator).
-- Useful once backfill lands and region-filtered reports are run.
CREATE INDEX IF NOT EXISTS idx_pcs_claims_authority_regions
  ON pcs_claims USING GIN (authority_regions);

COMMENT ON COLUMN pcs_claims.authority_regions IS
  'Regulatory authorities under which this claim is permissible '
  '(FDA, EFSA, Health Canada, TGA, FSANZ, Japan MHLW, etc.). '
  'Empty array = not yet assessed. Populated via manual research team review.';
