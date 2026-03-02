-- 037: Add emoji column to materials_cache
--
-- Supports the CMS-managed emoji system: each material gets a visual emoji
-- set in Notion and synced through the standard pipeline.
-- The hard-coded MATERIAL_TITLE_EMOJI map remains as a fallback for materials
-- that don't yet have a Notion emoji.

ALTER TABLE materials_cache ADD COLUMN IF NOT EXISTS emoji TEXT;
