-- Phase G.1.3 supplemental: milestones, events, projects tables.
-- All three are Notion-sourced; these tables serve as the Supabase read cache.
-- Sync crons will populate them on the next scheduled run after this migration applies.

-- milestones
-- Maps the "Phases & Milestones" Notion DB. A row is either a phase (duration-bearing)
-- or a milestone (zero-duration checkpoint).
CREATE TABLE IF NOT EXISTS milestones (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id   text UNIQUE NOT NULL,
  milestone        text NOT NULL,
  kind             text DEFAULT 'milestone',             -- 'phase' | 'milestone'
  milestone_status text DEFAULT 'not started',
  project_ids      text[] DEFAULT '{}',
  task_ids         text[] DEFAULT '{}',
  owner_ids        text[] DEFAULT '{}',
  start_date       date,
  end_date         date,
  client_visible   bool DEFAULT false,
  description      text,
  brief            text,
  billing_total    numeric,
  archive          bool DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS milestones_notion_page_id_idx ON milestones (notion_page_id);
CREATE INDEX IF NOT EXISTS milestones_kind_idx ON milestones (kind);
CREATE INDEX IF NOT EXISTS milestones_status_idx ON milestones (milestone_status);
CREATE INDEX IF NOT EXISTS milestones_archive_idx ON milestones (archive);
CREATE INDEX IF NOT EXISTS milestones_project_ids_idx ON milestones USING gin(project_ids);

-- crm_events
-- Maps the "Events & Conferences" Notion DB (CrmEvent type).
-- Named crm_events to avoid conflict with the ancestry.events table (person lifecycle events).
CREATE TABLE IF NOT EXISTS crm_events (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id     text UNIQUE NOT NULL,
  event              text NOT NULL,
  type               text,
  event_start        date,
  event_end          date,
  proposal_deadline  date,
  frequency          text,
  location           text,
  est_attendance     text,
  registration_cost  text,
  quadrant_relevance text[] DEFAULT '{}',
  bd_segments        text,
  who_should_attend  text[] DEFAULT '{}',
  why_it_matters     text,
  notes              text,
  url                text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_events_notion_page_id_idx ON crm_events (notion_page_id);
CREATE INDEX IF NOT EXISTS crm_events_type_idx ON crm_events (type);
CREATE INDEX IF NOT EXISTS crm_events_event_start_idx ON crm_events (event_start);
CREATE INDEX IF NOT EXISTS crm_events_quadrant_relevance_idx ON crm_events USING gin(quadrant_relevance);
CREATE INDEX IF NOT EXISTS crm_events_who_should_attend_idx ON crm_events USING gin(who_should_attend);

-- projects
-- Maps the "Projects" Notion DB. Note: distinct from ops_projects (a Supabase-only
-- ops-dashboard table). This table mirrors the CRM projects that link to milestones and
-- work items.
CREATE TABLE IF NOT EXISTS projects (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id   text UNIQUE NOT NULL,
  project          text NOT NULL,
  status           text,
  priority         text,
  type             text,
  budget_hours     numeric,
  event_type       text,
  timeline_start   date,
  timeline_end     date,
  project_lead_ids text[] DEFAULT '{}',
  organization_ids text[] DEFAULT '{}',
  milestone_ids    text[] DEFAULT '{}',
  task_ids         text[] DEFAULT '{}',
  cycle_ids        text[] DEFAULT '{}',
  archive          bool DEFAULT false,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS projects_notion_page_id_idx ON projects (notion_page_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);
CREATE INDEX IF NOT EXISTS projects_priority_idx ON projects (priority);
CREATE INDEX IF NOT EXISTS projects_archive_idx ON projects (archive);
CREATE INDEX IF NOT EXISTS projects_organization_ids_idx ON projects USING gin(organization_ids);

-- bd_assets
-- Maps the "BD Assets" Notion DB — portfolio assets, deliverables, presentation materials.
CREATE TABLE IF NOT EXISTS bd_assets (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id          text UNIQUE NOT NULL,
  asset                   text NOT NULL,
  asset_type              text,
  readiness               text,
  description             text,
  slug                    text,
  tags                    text[] DEFAULT '{}',
  url                     text,
  thumbnail_url           text,
  icon                    text,
  featured                bool DEFAULT false,
  show_in_portfolio       bool DEFAULT false,
  show_in_package_builder bool DEFAULT false,
  password_protected      bool DEFAULT false,
  organization_ids        text[] DEFAULT '{}',
  times_used              int,
  updated_at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bd_assets_notion_page_id_idx ON bd_assets (notion_page_id);
CREATE INDEX IF NOT EXISTS bd_assets_asset_type_idx ON bd_assets (asset_type);
CREATE INDEX IF NOT EXISTS bd_assets_readiness_idx ON bd_assets (readiness);
CREATE INDEX IF NOT EXISTS bd_assets_featured_idx ON bd_assets (featured);
CREATE INDEX IF NOT EXISTS bd_assets_tags_idx ON bd_assets USING gin(tags);
