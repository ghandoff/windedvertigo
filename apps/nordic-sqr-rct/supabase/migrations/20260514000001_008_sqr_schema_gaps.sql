-- 008_sqr_schema_gaps.sql
-- 2026-05-14 — Path 3 pre-requisite.
-- Fills gaps between the 001 SQR-RCT schema and the current parsePage()
-- return shapes. ADDITIVE ONLY. All ADD COLUMN IF NOT EXISTS.

BEGIN;

-- reviewers: email confirmation marker (stamped by /api/auth/confirm-email)
ALTER TABLE reviewers
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
COMMENT ON COLUMN reviewers.email_confirmed_at IS
  'Path 3 2026-05-14 — stamped by /api/auth/confirm-email. Source: notion.js parseReviewerPage() emailConfirmedAt.';

-- intakes: fields present in parseIntakePage() but missing from 001 schema
ALTER TABLE intakes
  ADD COLUMN IF NOT EXISTS authors_conclusion  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS strengths           TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS limitations         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS potential_biases    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS submitted_by_alias  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pdf_url             TEXT;
COMMENT ON COLUMN intakes.authors_conclusion IS
  'Path 3 2026-05-14 — Notion: "Authors'' Conclusion". Source: notion.js parseIntakePage() authorsConclusion.';
COMMENT ON COLUMN intakes.pdf_url IS
  'Path 3 2026-05-14 — Notion file property "PDF". Column map: { pdf: "pdf_url" } (matches pcs_evidence convention).';
CREATE INDEX IF NOT EXISTS intakes_submitted_by_alias_idx ON intakes (submitted_by_alias);

-- scores: fields present in parseScorePage() but missing from 001 schema
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS rubric_version   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes            TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS scored_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS time_to_complete NUMERIC;
COMMENT ON COLUMN scores.rubric_version IS
  'Path 3 2026-05-14 — Notion: "Rubric version" select. Source: notion.js parseScorePage() rubricVersion.';
COMMENT ON COLUMN scores.scored_at IS
  'Path 3 2026-05-14 — Notion: "Timestamp" date. "timestamp" is a Postgres reserved word; column map: { timestamp: "scored_at" }.';
CREATE INDEX IF NOT EXISTS scores_scored_at_idx ON scores (scored_at DESC);
CREATE INDEX IF NOT EXISTS scores_rater_alias_idx ON scores (rater_alias);

COMMIT;
