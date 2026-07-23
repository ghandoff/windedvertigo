-- Minimal absence calendar backing PaM's absence-horizon pilot behavior
-- (docs/agents/executive-charters.md — PaM "an absence approaching … →
-- redistribution proposal two weeks out"). No table existed for this
-- (confirmed via migration grep — "time_off"/"absence" had zero prior hits).
--
-- Phase 1 scope is deliberately minimal: SQL-seeded rows only, no entry UI,
-- no calendar OOO-event parsing. A real UI/ingestion path is a natural
-- phase-2 follow-up once the pilot behavior proves out.
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

BEGIN;

CREATE TABLE IF NOT EXISTS time_off (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS time_off_dates_idx ON time_off (start_date, end_date);
CREATE INDEX IF NOT EXISTS time_off_owner_idx ON time_off (owner_email);

ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'time_off' ORDER BY ordinal_position;

-- ── ROLLBACK (run only to undo) ───────────────────────────────────────────────
-- DROP TABLE IF EXISTS time_off;
