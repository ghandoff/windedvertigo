CREATE TABLE IF NOT EXISTS email_drafts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id    TEXT UNIQUE NOT NULL,
  org_id            TEXT,   -- FK to organizations.notion_page_id
  contact_id        TEXT,   -- nullable FK to contacts.notion_page_id
  campaign_id       TEXT,   -- nullable FK to campaigns.notion_page_id
  step_id           TEXT,   -- nullable FK to campaign_steps.notion_page_id
  subject           TEXT    NOT NULL DEFAULT '',
  body              TEXT    NOT NULL DEFAULT '',
  status            TEXT    NOT NULL DEFAULT 'draft',
  sent_at           TIMESTAMPTZ,
  sent_to           TEXT    NOT NULL DEFAULT '',
  resend_message_id TEXT    NOT NULL DEFAULT '',
  opens             INTEGER NOT NULL DEFAULT 0,
  clicks            INTEGER NOT NULL DEFAULT 0,
  machine_opens     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_org_id      ON email_drafts(org_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_campaign_id ON email_drafts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_step_id     ON email_drafts(step_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status      ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_sent_at     ON email_drafts(sent_at);
