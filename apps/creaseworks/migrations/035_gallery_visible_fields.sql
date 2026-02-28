-- Migration 035: Add gallery_visible_fields to playdates_cache
-- Controls which properties render on PlaydateCard tiles (author-controlled via Notion)
ALTER TABLE playdates_cache
  ADD COLUMN IF NOT EXISTS gallery_visible_fields JSONB DEFAULT '[]'::jsonb;
