-- Migration 009: Add explicit source column to runs_cache.
--
-- Previously app-created runs used notion_id = 'app:<uuid>' as a workaround
-- to distinguish from Notion-synced runs. This was fragile — the sync's
-- DELETE WHERE notion_id != ALL(...) relied on string prefix matching, and
-- the notion_id UNIQUE constraint was overloaded.
--
-- This adds a source enum column so the sync can explicitly skip app rows,
-- and queries can filter by source without parsing notion_id strings.

-- 1. Add the column with a default of 'notion' (existing rows are all from
--    either Notion sync or app; we'll backfill app rows next).
ALTER TABLE runs_cache
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'notion';

-- 2. Backfill: any row whose notion_id starts with 'app:' is app-created.
UPDATE runs_cache SET source = 'app' WHERE notion_id LIKE 'app:%';

-- 3. Index for queries that filter by source + org.
CREATE INDEX IF NOT EXISTS idx_runs_cache_source ON runs_cache (source);
