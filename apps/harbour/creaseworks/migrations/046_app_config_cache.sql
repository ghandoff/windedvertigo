-- app config cache: stores structured option sets from the Notion "app config"
-- database — onboarding options, pack finder situations, seasonal themes,
-- UI disclosure tiers, and other config that the collective can author.

CREATE TABLE IF NOT EXISTS app_config_cache (
  id            SERIAL PRIMARY KEY,
  notion_id     TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  key           TEXT,
  grp       TEXT,
  sort_order    INTEGER DEFAULT 0,
  metadata      TEXT,
  notion_last_edited TEXT,
  synced_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_config_group ON app_config_cache (grp);
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_config_cache (key);
