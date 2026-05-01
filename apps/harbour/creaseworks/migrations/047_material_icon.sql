-- Add icon column to materials_cache for CMS-managed PNG icon filenames.
-- Stores the filename without extension (e.g. "chalk" → /icons/materials/chalk.png).
ALTER TABLE materials_cache ADD COLUMN IF NOT EXISTS icon TEXT;
