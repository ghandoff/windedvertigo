-- Migration 021: play contexts — revisitable onboarding with context switching
--
-- Instead of a single set of play_preferences, users can save multiple
-- named contexts (e.g. "at home", "school time", "road trip") and switch
-- between them. The active context drives matcher recommendations.
--
-- play_contexts shape:
-- [
--   {
--     "name":       "at home",
--     "age_groups": ["preschool", "school-age"],
--     "contexts":   ["home"],
--     "energy":     "chill",
--     "created_at": "2026-02-26T…"
--   },
--   { … }
-- ]

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS play_contexts       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active_context_name TEXT;

-- Migrate existing play_preferences into play_contexts as a "default" context
UPDATE users
SET play_contexts = jsonb_build_array(
      play_preferences || jsonb_build_object(
        'name', 'default',
        'created_at', NOW()::text
      )
    ),
    active_context_name = 'default'
WHERE play_preferences IS NOT NULL
  AND play_preferences != 'null'::jsonb;

COMMENT ON COLUMN users.play_contexts IS
  'Array of named play-preference sets; each has name, age_groups, contexts, energy';
COMMENT ON COLUMN users.active_context_name IS
  'Name of the currently active play context — drives matcher recommendations';
