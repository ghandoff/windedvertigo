-- Catch-up migration: 7 tables that existed in production before migration tracking
-- Applied 2026-04-27. Use: supabase migration repair --status applied <timestamp> to mark applied.

-- members
CREATE TABLE IF NOT EXISTS members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  name          text NOT NULL,
  email         text,
  company_role  text,
  active        bool NOT NULL DEFAULT true,
  capacity      text,
  hourly_rate   numeric,
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS members_notion_page_id_idx ON members (notion_page_id);
CREATE INDEX IF NOT EXISTS members_email_idx ON members (email);
CREATE INDEX IF NOT EXISTS members_active_idx ON members (active);

-- allowances
CREATE TABLE IF NOT EXISTS allowances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  description    text NOT NULL,
  category       text NOT NULL,
  amount         numeric,
  active         bool DEFAULT false,
  notes          text,
  member_ids     uuid[] DEFAULT '{}'::uuid[],
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS allowances_notion_page_id_idx ON allowances (notion_page_id);
CREATE INDEX IF NOT EXISTS allowances_category_idx ON allowances (category);
CREATE INDEX IF NOT EXISTS allowances_active_idx ON allowances (active);

-- activities
CREATE TABLE IF NOT EXISTS activities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id   text UNIQUE NOT NULL,
  activity         text NOT NULL,
  type             text,
  date             date,
  outcome          text,
  notes            text,
  logged_by        text,
  organization_ids text[],
  contact_ids      text[],
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_notion_page_id_idx ON activities (notion_page_id);
CREATE INDEX IF NOT EXISTS activities_date_idx ON activities (date);
CREATE INDEX IF NOT EXISTS activities_type_idx ON activities (type);

-- deals
CREATE TABLE IF NOT EXISTS deals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  deal           text NOT NULL,
  stage          text,
  value          numeric,
  org_ids        text[],
  rfp_ids        text[],
  notes          text,
  loss_reason    text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deals_notion_page_id_idx ON deals (notion_page_id);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals (stage);

-- email_templates
CREATE TABLE IF NOT EXISTS email_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  name           text NOT NULL,
  subject        text,
  body           text,
  category       text,
  channel        text,
  notes          text,
  times_used     int DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_templates_notion_page_id_idx ON email_templates (notion_page_id);
CREATE INDEX IF NOT EXISTS email_templates_category_idx ON email_templates (category);

-- social_drafts
CREATE TABLE IF NOT EXISTS social_drafts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  content        text NOT NULL,
  platform       text,
  status         text,
  org_id         text,
  scheduled_for  timestamptz,
  published_url  text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS social_drafts_notion_page_id_idx ON social_drafts (notion_page_id);
CREATE INDEX IF NOT EXISTS social_drafts_platform_idx ON social_drafts (platform);
CREATE INDEX IF NOT EXISTS social_drafts_status_idx ON social_drafts (status);

-- rfp_feeds
CREATE TABLE IF NOT EXISTS rfp_feeds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id text UNIQUE NOT NULL,
  name           text NOT NULL,
  feed_type      text,
  source_label   text,
  url            text,
  keywords       text,
  notes          text,
  enabled        bool DEFAULT true,
  last_polled    timestamptz,
  items_last_run int,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rfp_feeds_notion_page_id_idx ON rfp_feeds (notion_page_id);
CREATE INDEX IF NOT EXISTS rfp_feeds_enabled_idx ON rfp_feeds (enabled);
