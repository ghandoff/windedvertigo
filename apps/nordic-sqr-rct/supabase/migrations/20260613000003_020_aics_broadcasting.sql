-- Migration 020: AICS Broadcasting System (2026-06-13)
--
-- Adds columns for:
--   1. demographic field on aics_documents (document-level label for filtering)
--   2. assigned_reviewer_ids on aics_documents (contractor assignment)
--   3. source_aics_claim_id on pcs_claims (propagation provenance)
--   4. aics_claim_reviews table (inter-rater analytics)

-- 1. Demographic label on AICS documents
ALTER TABLE aics_documents
  ADD COLUMN IF NOT EXISTS demographic TEXT;

-- 2. Assigned reviewer IDs on AICS documents (array of Notion reviewer page IDs)
ALTER TABLE aics_documents
  ADD COLUMN IF NOT EXISTS assigned_reviewer_ids TEXT[];

-- 3. Provenance link on PCS claims: which AICS claim originated this PCS claim
ALTER TABLE pcs_claims
  ADD COLUMN IF NOT EXISTS source_aics_claim_id TEXT;

CREATE INDEX IF NOT EXISTS idx_pcs_claims_source_aics
  ON pcs_claims(source_aics_claim_id)
  WHERE source_aics_claim_id IS NOT NULL;

-- 4. AICS claim review records (contractor + internal RA decisions)
CREATE TABLE IF NOT EXISTS aics_claim_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aics_claim_id   TEXT NOT NULL,
  reviewer_id     TEXT NOT NULL,
  reviewer_type   TEXT NOT NULL CHECK (reviewer_type IN ('internal', 'contractor')),
  decision        TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  notes           TEXT,
  reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aics_reviews_claim
  ON aics_claim_reviews(aics_claim_id);

CREATE INDEX IF NOT EXISTS idx_aics_reviews_reviewer
  ON aics_claim_reviews(reviewer_id);
