-- Migration 017: label_intake_queue
-- Durable job queue for Wave 5.3 label imports. Rows flow:
--   Pending → Extracting → (Needs Validation | Committed | Failed | Cancelled)
-- Mirrors pcs_import_jobs but trimmed to fields the label-extraction path needs.
--
-- Note: the Notion version chunked the extraction_data JSON across rich_text
-- runs (2000-char Notion limit). Postgres has no such constraint, so we
-- store the full payload as plain TEXT.

CREATE TABLE IF NOT EXISTS label_intake_queue (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id          TEXT UNIQUE,

  -- Identification
  sku                     TEXT NOT NULL,
  pcs_id                  TEXT,
  product_name            TEXT,

  -- Source label
  files                   JSONB DEFAULT '[]'::jsonb,  -- [{ name, url }]
  date_received           DATE,
  market                  TEXT,
  regulatory              TEXT,

  -- Workflow state
  status                  TEXT,                       -- Pending|Extracting|Needs Validation|Committed|Failed|Cancelled
  retry_count             INTEGER DEFAULT 0,
  prompt_version          TEXT,
  batch_id                TEXT,
  owner_email             TEXT,

  -- Result
  ingested                BOOLEAN DEFAULT false,
  ingested_label_id       TEXT,
  content_hash            TEXT,
  extraction_data         TEXT,
  error                   TEXT,
  confidence_overall      NUMERIC,
  notes                   TEXT,

  -- Timestamps
  notion_created_at       TIMESTAMPTZ,
  notion_last_edited_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_label_intake_queue_notion_page_id
  ON label_intake_queue(notion_page_id);

CREATE INDEX IF NOT EXISTS idx_label_intake_queue_status
  ON label_intake_queue(status);

CREATE INDEX IF NOT EXISTS idx_label_intake_queue_batch_id
  ON label_intake_queue(batch_id);

CREATE INDEX IF NOT EXISTS idx_label_intake_queue_content_hash
  ON label_intake_queue(content_hash);

CREATE INDEX IF NOT EXISTS idx_label_intake_queue_created_at
  ON label_intake_queue(notion_created_at DESC NULLS LAST);
