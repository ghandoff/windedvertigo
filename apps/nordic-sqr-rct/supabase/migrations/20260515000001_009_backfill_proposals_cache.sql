-- 009_backfill_proposals_cache.sql
-- 2026-05-15 — Phase 4.6 Bundle B persistent cache.
--
-- Stores the canonical-claim matcher output (getMatchingProposals()) as a
-- single JSONB row so serverless cold-starts read from Postgres instead of
-- triggering 4× Notion scans (~15-25s each).
--
-- Singleton-row pattern: only one row ever exists (id = 'singleton').
-- The route upserts on every rebuild and DELETEs on manual cache clear.

BEGIN;

CREATE TABLE IF NOT EXISTS pcs_backfill_proposals_cache (
  id            TEXT        PRIMARY KEY DEFAULT 'singleton',
  proposals     JSONB       NOT NULL,
  built_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  notion_count  INTEGER     NOT NULL DEFAULT 0
);

COMMENT ON TABLE pcs_backfill_proposals_cache IS
  'Phase 4.6 2026-05-15 — Singleton cache for canonical-claim matcher output. '
  'Populated by /api/pcs/canonical-claims/backfill-review on each Notion rebuild. '
  'Cold-start reads land here instead of re-running 4x Notion scans.';

COMMIT;
