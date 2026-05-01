-- site copy cache: stores user-facing text from the Notion "site copy" database.
-- keyed by a dotted identifier (e.g. "landing.hero.headline") so components
-- can look up specific copy blocks without hard-coding strings.

CREATE TABLE IF NOT EXISTS site_copy_cache (
  id            SERIAL PRIMARY KEY,
  notion_id     TEXT UNIQUE NOT NULL,
  key           TEXT UNIQUE NOT NULL,
  copy          TEXT,
  copy_html     TEXT,
  page          TEXT,
  section       TEXT,
  status        TEXT DEFAULT 'draft',
  sort_order    INTEGER DEFAULT 0,
  notes         TEXT,
  notion_last_edited TEXT,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_copy_page ON site_copy_cache (page);
CREATE INDEX IF NOT EXISTS idx_site_copy_key ON site_copy_cache (key);
CREATE INDEX IF NOT EXISTS idx_site_copy_status ON site_copy_cache (status);
