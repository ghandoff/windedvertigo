-- 038: Add rich-text HTML columns for formatted Notion content.
--
-- The sync pipeline already extracts HTML from Notion's rich text
-- annotations (bold, italic, links, colors) via extractRichTextHtml().
-- These columns store the formatted HTML alongside the existing plain-text
-- columns so the UI can progressively enhance rendering when formatting
-- is present. Null means "no formatting — use the plain-text column".
--
-- playdates_cache: headline, find_again_prompt, substitutions_notes
-- packs_cache:     description
-- collections:     description

ALTER TABLE playdates_cache ADD COLUMN IF NOT EXISTS headline_html TEXT;
ALTER TABLE playdates_cache ADD COLUMN IF NOT EXISTS find_again_prompt_html TEXT;
ALTER TABLE playdates_cache ADD COLUMN IF NOT EXISTS substitutions_notes_html TEXT;

ALTER TABLE packs_cache ADD COLUMN IF NOT EXISTS description_html TEXT;

ALTER TABLE collections ADD COLUMN IF NOT EXISTS description_html TEXT;
