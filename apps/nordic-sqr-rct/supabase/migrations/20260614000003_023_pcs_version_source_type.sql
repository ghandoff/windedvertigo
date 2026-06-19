-- Migration 023: Add source_type to pcs_versions
-- Distinguishes how a version was created:
--   'pdf-import'   — created by the PDF extraction pipeline (commitExtraction)
--   'fuzzy-match'  — the post-fuzzy-matching version (v1 after import)
--   'user-created' — created manually by a researcher in the platform
-- NULL is treated as 'user-created' in the UI (all historical versions).
-- The Word view tab is only shown for pdf-import and fuzzy-match versions.

ALTER TABLE pcs_versions
  ADD COLUMN IF NOT EXISTS source_type TEXT
    CHECK (source_type IN ('pdf-import', 'fuzzy-match', 'user-created'));

CREATE INDEX IF NOT EXISTS idx_pcs_versions_source_type
  ON pcs_versions(source_type);
