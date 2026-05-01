-- Migration 018: add Notion sync columns to collections
--
-- Brings collections in line with the other cache tables
-- (playdates_cache, materials_cache, packs_cache, runs_cache)
-- so the daily Notion sync can manage them.

BEGIN;

ALTER TABLE collections ADD COLUMN IF NOT EXISTS notion_id TEXT UNIQUE;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS notion_last_edited TEXT;
ALTER TABLE collections ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ;

COMMIT;
