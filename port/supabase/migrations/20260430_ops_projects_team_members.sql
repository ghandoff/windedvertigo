-- ops_projects and ops_team_members — ops dashboard data, managed in Supabase.
-- These are ops-specific tables in the wv-port-pilot pool.
-- ops_projects mirrors the Notion projects database as a cache/fallback.
-- ops_team_members is the authoritative source for team roster display.

-- ops_projects
CREATE TABLE IF NOT EXISTS ops_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'green',
  deadline    text,
  owner       text,
  description text,
  archived    bool NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_projects_slug_idx ON ops_projects (slug);
CREATE INDEX IF NOT EXISTS ops_projects_archived_idx ON ops_projects (archived);
CREATE INDEX IF NOT EXISTS ops_projects_status_idx ON ops_projects (status);

-- ops_team_members
CREATE TABLE IF NOT EXISTS ops_team_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text UNIQUE NOT NULL,
  name       text NOT NULL,
  role       text,
  focus      text[] NOT NULL DEFAULT '{}',
  active     bool NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ops_team_members_slug_idx ON ops_team_members (slug);
CREATE INDEX IF NOT EXISTS ops_team_members_active_idx ON ops_team_members (active);
