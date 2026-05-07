-- 007_pcs_pending_writes.sql
-- 2026-05-06 — Path-2 Phase B Bundle 1 — strong-consistency retry queue.
--
-- When a Notion write succeeds but the Postgres mirror fails (network
-- blip, rate limit, transient error), enqueue the row here so the
-- retry worker can re-attempt the mirror. Idempotent on (table, notion_page_id).

CREATE TABLE IF NOT EXISTS pcs_pending_writes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pg_table                 TEXT NOT NULL,                   -- e.g. 'pcs_evidence'
  notion_page_id           TEXT NOT NULL,
  payload                  JSONB NOT NULL,                  -- the parsed Notion-shape row
  attempts                 INTEGER NOT NULL DEFAULT 0,
  last_attempt_at          TIMESTAMPTZ,
  last_error               TEXT,
  enqueued_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  succeeded_at             TIMESTAMPTZ,
  UNIQUE (pg_table, notion_page_id)
);
CREATE INDEX IF NOT EXISTS pcs_pending_writes_unfinished_idx
  ON pcs_pending_writes (enqueued_at) WHERE succeeded_at IS NULL;
