-- Raw, replayable event ledger for the ambient-agent spine
-- (docs/prompts/executive-agents-phase1-build.md §2.1). Slack channel-message
-- events land here immediately from the events webhook; the
-- agent-ambient-sweep cron (every 5 min) reads unprocessed rows grouped by
-- channel, applies the quiet-window/high-signal debounce, and marks rows
-- processed_at once folded into an agent run.
--
-- Phase 1 source is Slack only. Other sources (calendar, GitHub) are
-- deliberately NOT wired into this table yet — see the phase-1 build plan's
-- "GitHub webhooks cut from phase 1" note; add a `source` value when a real
-- consumer needs one, don't pre-build unused ingestion paths.
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

BEGIN;

CREATE TABLE IF NOT EXISTS event_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source        text NOT NULL DEFAULT 'slack' CHECK (source IN ('slack')),
  type          text NOT NULL,      -- e.g. 'message', 'reaction_added'
  channel       text NOT NULL,      -- slack channel id
  payload       jsonb NOT NULL,     -- raw (trimmed) Slack event payload
  ts            timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

CREATE INDEX IF NOT EXISTS event_log_channel_processed_idx ON event_log (channel, processed_at);
CREATE INDEX IF NOT EXISTS event_log_ts_idx ON event_log (ts DESC);

ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'event_log' ORDER BY ordinal_position;

-- ── ROLLBACK (run only to undo) ───────────────────────────────────────────────
-- DROP TABLE IF EXISTS event_log;
