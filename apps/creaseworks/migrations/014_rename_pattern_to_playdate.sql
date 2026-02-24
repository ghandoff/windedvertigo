-- Migration 014: rename "pattern" to "playdate" across all tables, columns, and indexes.
--
-- This is a full rename from the internal concept "pattern" to the user-facing "playdate".
-- All foreign key constraints, indexes, and dependent columns are updated.

BEGIN;

-- ── 1. Rename tables ────────────────────────────────────────────────────

ALTER TABLE patterns_cache       RENAME TO playdates_cache;
ALTER TABLE pattern_materials    RENAME TO playdate_materials;
ALTER TABLE pack_patterns        RENAME TO pack_playdates;
ALTER TABLE collection_patterns  RENAME TO collection_playdates;
ALTER TABLE pattern_progress     RENAME TO playdate_progress;

-- ── 2. Rename columns in junction/referencing tables ────────────────────

-- playdate_materials (was pattern_materials)
ALTER TABLE playdate_materials   RENAME COLUMN pattern_id TO playdate_id;

-- pack_playdates (was pack_patterns)
ALTER TABLE pack_playdates       RENAME COLUMN pattern_id TO playdate_id;

-- collection_playdates (was collection_patterns)
ALTER TABLE collection_playdates RENAME COLUMN pattern_id TO playdate_id;

-- playdate_progress (was pattern_progress)
ALTER TABLE playdate_progress    RENAME COLUMN pattern_id TO playdate_id;

-- runs_cache — the foreign key column
ALTER TABLE runs_cache           RENAME COLUMN pattern_notion_id TO playdate_notion_id;

-- access_audit_logs — the optional reference column
ALTER TABLE access_audit_logs    RENAME COLUMN pattern_id TO playdate_id;

-- ── 3. Rename indexes ──────────────────────────────────────────────────

-- patterns_cache indexes (from migration 001)
ALTER INDEX IF EXISTS idx_patterns_release  RENAME TO idx_playdates_release;
ALTER INDEX IF EXISTS idx_patterns_status   RENAME TO idx_playdates_status;
ALTER INDEX IF EXISTS idx_patterns_slug     RENAME TO idx_playdates_slug;

-- collection_patterns indexes (from migration 013)
ALTER INDEX IF EXISTS idx_collection_patterns_coll RENAME TO idx_collection_playdates_coll;

-- pattern_progress indexes (from migration 013)
ALTER INDEX IF EXISTS idx_progress_user  RENAME TO idx_playdate_progress_user;
ALTER INDEX IF EXISTS idx_progress_tier  RENAME TO idx_playdate_progress_tier;

COMMIT;
