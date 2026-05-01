-- Tier 2 image sync: add cover columns to collections
-- Mirrors 032_cover_images.sql pattern for playdates_cache & packs_cache.
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS cover_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
