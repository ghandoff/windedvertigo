-- campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id   text UNIQUE NOT NULL,
  name             text NOT NULL,
  type             text,
  status           text,
  event_ids        text[],
  audience_filters jsonb,
  owner            text,
  start_date       date,
  end_date         date,
  notes            text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_notion_page_id_idx ON campaigns (notion_page_id);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

-- campaign_steps
CREATE TABLE IF NOT EXISTS campaign_steps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id   text UNIQUE NOT NULL,
  name             text NOT NULL,
  campaign_ids     text[],
  step_number      integer,
  channel          text,
  subject          text,
  body             text,
  delay_days       integer,
  send_date        date,
  status           text,
  sent_count       integer,
  skipped_count    integer,
  failed_count     integer,
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_steps_notion_page_id_idx ON campaign_steps (notion_page_id);
CREATE INDEX IF NOT EXISTS campaign_steps_campaign_ids_idx ON campaign_steps USING GIN (campaign_ids);
