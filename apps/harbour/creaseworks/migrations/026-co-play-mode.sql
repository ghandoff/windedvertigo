-- Migration 026: co-play mode for shared session reflections
--
-- Adds support for two parents/caregivers to participate in the same playdate
-- session and share reflections. Includes invite code generation and storage
-- of co-play partner's reflections.

BEGIN;

-- Add co-play columns to runs_cache
ALTER TABLE runs_cache
  ADD COLUMN IF NOT EXISTS co_play_invite_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS co_play_parent_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS co_play_reflections JSONB;

-- Index for efficient invite code lookups
CREATE INDEX IF NOT EXISTS idx_runs_co_play_invite_code
  ON runs_cache(co_play_invite_code)
  WHERE co_play_invite_code IS NOT NULL;

-- Index for finding runs where a user is the co-play partner
CREATE INDEX IF NOT EXISTS idx_runs_co_play_parent
  ON runs_cache(co_play_parent_id)
  WHERE co_play_parent_id IS NOT NULL;

COMMIT;
