-- Migration 031: Add tinkering tier column to playdates_cache
-- Synced from Notion "Tinkering Tier" select property.
-- Named tiers: guided | scaffolded | open-ended | free-form
-- Indicates how much creative freedom / tinkering a playdate supports.

ALTER TABLE playdates_cache
  ADD COLUMN IF NOT EXISTS tinkering_tier TEXT;

COMMENT ON COLUMN playdates_cache.tinkering_tier IS
  'How open-ended the playdate is: guided, scaffolded, open-ended, free-form';
