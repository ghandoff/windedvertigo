-- creaseworks migration: add app-created run support
-- version: 002
-- date: 2026-02-19
-- description: add created_by and org_id columns to runs_cache for app-created runs

-- App-created runs use notion_id = 'app:<uuid>' to distinguish from synced runs.
-- created_by is NULL for Notion-synced runs, set for app-created runs.
-- org_id tracks which organisation the run belongs to.

ALTER TABLE runs_cache
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organisations(id);

-- Index for visibility queries: list runs by org
CREATE INDEX IF NOT EXISTS idx_runs_org ON runs_cache(org_id);

-- Index for "my runs" queries
CREATE INDEX IF NOT EXISTS idx_runs_created_by ON runs_cache(created_by);
