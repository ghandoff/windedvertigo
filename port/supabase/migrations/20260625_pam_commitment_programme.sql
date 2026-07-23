-- pam_commitments: optional programme label.
--
-- Groups commitments under a timeline programme (e.g. 'amna at 10') so the
-- commitments board + whirlpool can filter/tag by engagement, mirroring how the
-- project-timeline groups milestones by their parent project.
--
-- Free-text by design — it matches the projects.project name string, with NO
-- foreign key. This mirrors how the rest of port links by loose id/label
-- (projectIds, work_item_id) rather than enforced keys, and keeps agent-created
-- commitments from failing on a missing project row.
--
-- Apply via the Supabase SQL editor (wv-port-pilot project — no remote migration
-- ledger, never `supabase db push`). Preview with the DRY-RUN before COMMIT.

BEGIN;

ALTER TABLE pam_commitments
  ADD COLUMN IF NOT EXISTS programme text NULL;

-- fast lookup for the programme filter on the commitments board
CREATE INDEX IF NOT EXISTS pam_commitments_programme_idx ON pam_commitments (programme);

COMMIT;

-- ── DRY-RUN (run before COMMIT to preview the column) ───────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'pam_commitments' ORDER BY ordinal_position;

-- ── ROLLBACK (run only to undo — additive + nullable, no data loss risk) ─────
-- DROP INDEX IF EXISTS pam_commitments_programme_idx;
-- ALTER TABLE pam_commitments DROP COLUMN IF EXISTS programme;
