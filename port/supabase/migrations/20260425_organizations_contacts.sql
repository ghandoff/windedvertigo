-- organizations
CREATE TABLE IF NOT EXISTS organizations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id   text UNIQUE NOT NULL,
  name             text NOT NULL,
  type             text,
  category         text,
  market_segment   text,
  website          text,
  email            text,
  connection       text,
  outreach_status  text,
  friendship       text,
  fit_rating       text,
  notes            text,
  derived_priority text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS organizations_notion_page_id_idx ON organizations (notion_page_id);
CREATE INDEX IF NOT EXISTS organizations_outreach_status_idx ON organizations (outreach_status);
CREATE INDEX IF NOT EXISTS organizations_market_segment_idx ON organizations (market_segment);

-- contacts
CREATE TABLE IF NOT EXISTS contacts (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id     text UNIQUE NOT NULL,
  name               text NOT NULL,
  email              text,
  role               text,
  org_id             text,
  contact_type       text,
  relationship_stage text,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contacts_notion_page_id_idx ON contacts (notion_page_id);
CREATE INDEX IF NOT EXISTS contacts_org_id_idx ON contacts (org_id);
