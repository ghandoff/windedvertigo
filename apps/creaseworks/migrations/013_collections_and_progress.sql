-- creaseworks migration: collections, badges & playbook
-- version: 013
-- date: 2026-02-23
-- description: adds topical collections for gamification, per-user pattern
--   progress tracking (badges), and is_find_again flag on runs

-- =============================================================================
-- COLLECTIONS — topical groupings (puddle scientists, cardboard architects…)
-- Separate from packs: packs = commerce, collections = exploration.
-- =============================================================================

CREATE TABLE IF NOT EXISTS collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  icon_emoji  TEXT,
  status      TEXT DEFAULT 'draft',
  slug        TEXT UNIQUE,
  sort_order  SMALLINT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collections_status ON collections(status);

-- Many-to-many: which patterns belong to which collections.
-- A pattern can be in multiple collections AND multiple packs.
CREATE TABLE IF NOT EXISTS collection_patterns (
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  pattern_id    UUID NOT NULL REFERENCES patterns_cache(id) ON DELETE CASCADE,
  display_order SMALLINT DEFAULT 0,
  PRIMARY KEY (collection_id, pattern_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_patterns_coll
  ON collection_patterns(collection_id);

-- =============================================================================
-- PATTERN PROGRESS — per-user, per-pattern badge progression
-- Derived from runs_cache, not a separate state machine.
-- =============================================================================

CREATE TABLE IF NOT EXISTS pattern_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_id      UUID NOT NULL REFERENCES patterns_cache(id) ON DELETE CASCADE,
  -- Tier: tried_it | found_something | folded_unfolded | found_again
  progress_tier   TEXT,
  tried_at        TIMESTAMPTZ,
  found_at        TIMESTAMPTZ,
  folded_at       TIMESTAMPTZ,
  found_again_at  TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, pattern_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON pattern_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_tier ON pattern_progress(progress_tier);

-- =============================================================================
-- RUNS: add is_find_again flag for explicit "find again" moments
-- =============================================================================

ALTER TABLE runs_cache
  ADD COLUMN IF NOT EXISTS is_find_again BOOLEAN DEFAULT false;
