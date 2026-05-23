-- Migration 016: pcs_benefit_categories
-- Hierarchical taxonomy of benefit categories (Brain / cognition / mood,
-- Cardiovascular, Sleep, etc.). Self-referential parent_category_id via
-- notion_page_id supports nested subcategories.

CREATE TABLE IF NOT EXISTS pcs_benefit_categories (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id          TEXT UNIQUE,
  name                    TEXT NOT NULL,
  parent_category_id      TEXT,         -- → pcs_benefit_categories.notion_page_id
  display_order           INTEGER,
  icon                    TEXT,
  notes                   TEXT,
  notion_created_at       TIMESTAMPTZ,
  notion_last_edited_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pcs_benefit_categories_notion_page_id
  ON pcs_benefit_categories(notion_page_id);

CREATE INDEX IF NOT EXISTS idx_pcs_benefit_categories_parent
  ON pcs_benefit_categories(parent_category_id);

CREATE INDEX IF NOT EXISTS idx_pcs_benefit_categories_display_order
  ON pcs_benefit_categories(display_order ASC NULLS LAST);
