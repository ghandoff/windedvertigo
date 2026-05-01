-- Phase G.1.3 continuation: cycles, competitors, blueprints tables
-- Applied via: supabase db query --linked -f <this file>   (from port/ directory)
-- All DDL uses IF NOT EXISTS — safe to re-apply.

-- ── cycles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cycles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  cycle          text NOT NULL DEFAULT '',
  start_date     date,
  end_date       date,
  project_ids    text[] NOT NULL DEFAULT '{}',
  status         text,
  goal           text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cycles_notion_page_id_idx ON cycles (notion_page_id);
CREATE INDEX IF NOT EXISTS cycles_status_idx         ON cycles (status);
CREATE INDEX IF NOT EXISTS cycles_project_ids_idx    ON cycles USING gin(project_ids);

-- ── competitors ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS competitors (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id   text UNIQUE NOT NULL,
  organisation     text NOT NULL DEFAULT '',
  type             text,
  threat_level     text,
  quadrant_overlap text[] NOT NULL DEFAULT '{}',
  geography        text[] NOT NULL DEFAULT '{}',
  what_they_offer  text,
  where_wv_wins    text,
  relevance_to_wv  text,
  notes            text,
  url              text,
  organization_ids text[] NOT NULL DEFAULT '{}',
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS competitors_notion_page_id_idx  ON competitors (notion_page_id);
CREATE INDEX IF NOT EXISTS competitors_type_idx            ON competitors (type);
CREATE INDEX IF NOT EXISTS competitors_threat_level_idx    ON competitors (threat_level);
CREATE INDEX IF NOT EXISTS competitors_quadrant_overlap_idx ON competitors USING gin(quadrant_overlap);
CREATE INDEX IF NOT EXISTS competitors_geography_idx       ON competitors USING gin(geography);

-- ── blueprints ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blueprints (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  name           text NOT NULL DEFAULT '',
  description    text,
  channels       text[] NOT NULL DEFAULT '{}',
  category       text,
  step_count     integer NOT NULL DEFAULT 0,
  total_days     integer NOT NULL DEFAULT 0,
  notes          text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blueprints_notion_page_id_idx ON blueprints (notion_page_id);
CREATE INDEX IF NOT EXISTS blueprints_category_idx       ON blueprints (category);
CREATE INDEX IF NOT EXISTS blueprints_channels_idx       ON blueprints USING gin(channels);
