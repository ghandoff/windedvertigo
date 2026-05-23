-- Migration 013: pcs_applicability
-- Per-(study × claim) external-validity scoring. Separates applicability/
-- directness from internal bias.
--
-- Each row binds an evidence item to a PCS claim, captures 5 ordinal domain
-- selects (dose/form/duration/population/outcome match), an optional
-- multi-select of structural limitations, computed score (0-10) and
-- rating (Pending|Low|Moderate|High), plus assessor IDs + notes.

CREATE TABLE IF NOT EXISTS pcs_applicability (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id          TEXT UNIQUE,
  name                    TEXT,
  -- FK-style references; we keep them as TEXT to match the rest of the
  -- platform's notion_page_id convention. Joins happen application-side.
  evidence_item_id        TEXT,
  pcs_claim_id            TEXT,
  -- 5 ordinal applicability domains. Stored as TEXT (the same select-name
  -- values produced by computeApplicabilityScore in src/lib/applicability.js).
  dose_match              TEXT,
  form_match              TEXT,
  duration_match          TEXT,
  population_match        TEXT,
  outcome_relevance       TEXT,
  -- Multi-select tags (e.g. ["Small sample", "Industry sponsorship"]).
  structural_limitations  TEXT[] DEFAULT '{}',
  -- Computed by the lib whenever any ordinal domain is touched.
  applicability_score     NUMERIC,
  applicability_rating    TEXT,   -- Pending | Low | Moderate | High
  notes                   TEXT,
  -- Multi-user assessor list. Matches reviewers.notion_page_id format.
  assessor_ids            TEXT[] DEFAULT '{}',
  assessment_date         DATE,
  -- Notion-era timestamps (kept for sort stability post-migration).
  notion_created_at       TIMESTAMPTZ,
  notion_last_edited_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pcs_applicability_notion_page_id
  ON pcs_applicability(notion_page_id);

CREATE INDEX IF NOT EXISTS idx_pcs_applicability_pcs_claim_id
  ON pcs_applicability(pcs_claim_id);

CREATE INDEX IF NOT EXISTS idx_pcs_applicability_evidence_item_id
  ON pcs_applicability(evidence_item_id);

CREATE INDEX IF NOT EXISTS idx_pcs_applicability_rating
  ON pcs_applicability(applicability_rating);
