-- Migration 019: user onboarding + play preferences
-- Tracks whether a user has completed the quick-start wizard
-- and stores their responses for personalized recommendations.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS play_preferences     JSONB;

-- play_preferences shape:
-- {
--   "age_groups":    ["toddler", "preschool", "school-age"],
--   "contexts":      ["home", "classroom"],
--   "energy":        "chill" | "medium" | "active" | "any"
-- }

COMMENT ON COLUMN users.play_preferences IS
  'JSON blob from the quick-start onboarding wizard';
