-- whirlpool commitments — cycle tracking, visibility, if_then_plan, commitment_type
-- Apply via Supabase SQL editor (wv-port-pilot project)
-- Preview with the DRY-RUN SELECT at the bottom before committing

BEGIN;

ALTER TABLE pam_commitments
  ADD COLUMN IF NOT EXISTS cycle            date    NULL,
  ADD COLUMN IF NOT EXISTS if_then_plan     text    NULL,
  ADD COLUMN IF NOT EXISTS commitment_type  text    NULL
    CONSTRAINT pam_commitments_type_check
      CHECK (commitment_type IN ('action','learning','connection','ritual')),
  ADD COLUMN IF NOT EXISTS visibility       text    NOT NULL DEFAULT 'public'
    CONSTRAINT pam_commitments_visibility_check
      CHECK (visibility IN ('public','private'));

-- fast lookup for the whirlpool board (current week = current cycle)
CREATE INDEX IF NOT EXISTS pam_commitments_cycle_idx ON pam_commitments (cycle);

-- fast lookup for the by-owner lane view
CREATE INDEX IF NOT EXISTS pam_commitments_who_cycle_idx ON pam_commitments (who, cycle);

COMMIT;

-- ── DRY-RUN SELECT (run before COMMIT to preview column additions) ──────────
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'pam_commitments'
-- ORDER BY ordinal_position;

-- ── ROLLBACK (run only to undo) ──────────────────────────────────────────────
-- ALTER TABLE pam_commitments
--   DROP COLUMN IF EXISTS cycle,
--   DROP COLUMN IF EXISTS if_then_plan,
--   DROP COLUMN IF EXISTS commitment_type,
--   DROP COLUMN IF EXISTS visibility;
-- DROP INDEX IF EXISTS pam_commitments_cycle_idx;
-- DROP INDEX IF EXISTS pam_commitments_who_cycle_idx;
