-- Migration 043: Vault activities cache table
--
-- Caches vertigo vault activities from Notion (DB 223e4ee7…) into
-- creaseworks Postgres so the /vault route can serve them without
-- hitting the Notion API at request time.
--
-- Tiers:
--   prme         — free forever (contractual PRME deliverable, 22 activities)
--   explorer     — paid basic ($9.99 pack)
--   practitioner — paid premium ($19.99 pack, includes facilitator notes + video)

CREATE TABLE IF NOT EXISTS vault_activities_cache (
  id              SERIAL PRIMARY KEY,
  notion_id       TEXT UNIQUE NOT NULL,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  headline        TEXT,
  headline_html   TEXT,
  duration        TEXT,
  format          JSONB NOT NULL DEFAULT '[]',
  type            JSONB NOT NULL DEFAULT '[]',
  skills_developed JSONB NOT NULL DEFAULT '[]',
  tags            JSONB NOT NULL DEFAULT '[]',
  tier            TEXT NOT NULL DEFAULT 'prme',
  age_range       TEXT,
  group_size      TEXT,
  facilitator_notes      TEXT,
  facilitator_notes_html TEXT,
  materials_needed JSONB NOT NULL DEFAULT '[]',
  video_url       TEXT,
  cover_r2_key    TEXT,
  cover_url       TEXT,
  body_html       TEXT,
  content_md      TEXT,
  notion_last_edited TIMESTAMPTZ NOT NULL,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tier constraint — only the three defined content tiers
ALTER TABLE vault_activities_cache
  ADD CONSTRAINT chk_vault_tier
  CHECK (tier IN ('prme', 'explorer', 'practitioner'));

-- Self-referencing many-to-many for "related activities" relation
CREATE TABLE IF NOT EXISTS vault_related_activities (
  vault_activity_id  INTEGER NOT NULL REFERENCES vault_activities_cache(id) ON DELETE CASCADE,
  related_activity_id INTEGER NOT NULL REFERENCES vault_activities_cache(id) ON DELETE CASCADE,
  PRIMARY KEY (vault_activity_id, related_activity_id),
  CHECK (vault_activity_id != related_activity_id)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_vault_activities_tier ON vault_activities_cache(tier);
CREATE INDEX IF NOT EXISTS idx_vault_activities_slug ON vault_activities_cache(slug);
