-- 032: add cover image columns to playdates_cache and packs_cache
--
-- cover_r2_key — the R2 storage key (for deletion / re-upload)
-- cover_url   — pre-computed public URL (for fast reads without calling R2)

ALTER TABLE playdates_cache
  ADD COLUMN IF NOT EXISTS cover_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;

ALTER TABLE packs_cache
  ADD COLUMN IF NOT EXISTS cover_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
