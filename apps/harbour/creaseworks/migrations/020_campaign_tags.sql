-- Migration 020: Add campaign_tags to playdates_cache
--
-- Supports scavenger-hunt campaigns and promotional landing pages.
-- A playdate can belong to multiple campaigns (e.g. 'acetate', 'summer-2026').
-- The /campaign/[slug] route filters on this array.

ALTER TABLE playdates_cache
  ADD COLUMN IF NOT EXISTS campaign_tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_playdates_campaign_tags
  ON playdates_cache USING GIN (campaign_tags);

COMMENT ON COLUMN playdates_cache.campaign_tags IS
  'Array of campaign slugs this playdate belongs to (e.g. acetate, summer-2026)';
