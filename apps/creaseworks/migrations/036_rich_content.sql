-- 036: rich content columns for tier 3+4 image sync and rich text
--
-- Adds:
--   body_html        — full page body content rendered as HTML (from Notion blocks)
--   find_html        — formatted version of "find" phase text
--   fold_html        — formatted version of "fold" phase text
--   unfold_html      — formatted version of "unfold" phase text
--   illustration_r2_key / illustration_url — file-property images (beyond covers)
--
-- Tier 3: file property extraction (illustration images)
-- Tier 4: block content as HTML

-- playdates: body content + rich text phases + illustration
ALTER TABLE playdates_cache
  ADD COLUMN IF NOT EXISTS body_html TEXT,
  ADD COLUMN IF NOT EXISTS find_html TEXT,
  ADD COLUMN IF NOT EXISTS fold_html TEXT,
  ADD COLUMN IF NOT EXISTS unfold_html TEXT,
  ADD COLUMN IF NOT EXISTS illustration_r2_key TEXT,
  ADD COLUMN IF NOT EXISTS illustration_url TEXT;

-- collections: body content for collection descriptions
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS body_html TEXT;

-- packs: body content for pack detail pages
ALTER TABLE packs_cache
  ADD COLUMN IF NOT EXISTS body_html TEXT;

-- cms_pages: new table for Notion-as-CMS static page content
-- Used to sync /we/ and /do/ page text from Notion to avoid hardcoding
CREATE TABLE IF NOT EXISTS cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  notion_page_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body_html TEXT,
  meta_description TEXT,
  notion_last_edited TEXT,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_pages_slug ON cms_pages (slug);
