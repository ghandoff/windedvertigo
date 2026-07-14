-- ttoc_gate: shared TToC alignment scoring tool (all six agents).
-- ttoc_scorecards logs every verdict issued — the auditability behind "a
-- 52/100 defer should say why in TToC terms". pam_commitments gets a
-- survival_or_mission tag so PaM intake can carry the same label.
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

BEGIN;

CREATE TABLE IF NOT EXISTS ttoc_scorecards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  kind         text NOT NULL
    CONSTRAINT ttoc_scorecards_kind_check
      CHECK (kind IN ('opportunity', 'commitment', 'campaign')),
  subject_id   text,
  title        text NOT NULL,
  verdict      jsonb NOT NULL,
  tag          text NOT NULL
    CONSTRAINT ttoc_scorecards_tag_check
      CHECK (tag IN ('survival', 'mission', 'mixed')),
  requested_by text NOT NULL
);

CREATE INDEX IF NOT EXISTS ttoc_scorecards_subject_idx ON ttoc_scorecards (kind, subject_id);
CREATE INDEX IF NOT EXISTS ttoc_scorecards_created_idx ON ttoc_scorecards (created_at DESC);

-- Service-role-only — same pattern as biz_decisions/biz_memory/biz_roadmap
-- (20260619_biz_agent.sql): RLS enabled, no policies. Only lib/supabase/client.ts's
-- service-role client (which bypasses RLS) touches this table.
ALTER TABLE public.ttoc_scorecards ENABLE ROW LEVEL SECURITY;

ALTER TABLE pam_commitments
  ADD COLUMN IF NOT EXISTS survival_or_mission text
    CONSTRAINT pam_commitments_survival_mission_check
      CHECK (survival_or_mission IN ('survival', 'mission', 'mixed'));

COMMIT;

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_name IN ('ttoc_scorecards', 'pam_commitments')
-- ORDER BY table_name, ordinal_position;

-- ── ROLLBACK (run only to undo) ───────────────────────────────────────────────
-- ALTER TABLE pam_commitments DROP COLUMN IF EXISTS survival_or_mission;
-- DROP TABLE IF EXISTS ttoc_scorecards;
