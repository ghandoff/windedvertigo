-- Migration 023: Add age_range and energy_level columns to playdates_cache
--
-- Supports displaying age-appropriate playdate recommendations and energy level indicators.
-- age_range: string like "3-5", "5-8", "all ages" (sourced from Notion if available)
-- energy_level: computed from friction_dial for parent-friendly UI display

ALTER TABLE playdates_cache
  ADD COLUMN IF NOT EXISTS age_range TEXT,
  ADD COLUMN IF NOT EXISTS energy_level TEXT;

COMMENT ON COLUMN playdates_cache.age_range IS
  'Age range for the playdate (e.g. "3-5", "5-8", "all ages") — sourced from Notion';

COMMENT ON COLUMN playdates_cache.energy_level IS
  'Parent-friendly energy level label computed from friction_dial: "calm" (1-2), "moderate" (3), "active" (4-5)';
