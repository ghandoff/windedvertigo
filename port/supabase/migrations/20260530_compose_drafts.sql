-- Port social-authoring drafts (W3 MVP) — table name = compose_drafts.
--
-- Distinct from the existing `social_drafts` table (Notion mirror for the
-- social cron). This one backs the new /compose surface — human-authored
-- drafts that route through any of the lib/social/ + lib/email/ clients.
--
-- MVP scope: drafts persist + are editable. Publishing + AI-assist sidebar
-- land in follow-up commits.

CREATE TABLE IF NOT EXISTS compose_drafts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  author_email          TEXT NOT NULL,
  -- channel discriminator. allowed values aligned with lib/social/ clients.
  channel               TEXT NOT NULL CHECK (channel IN (
                          'linkedin', 'bluesky', 'substack', 'meta-facebook', 'meta-instagram', 'email'
                        )),
  status                TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                          'draft', 'scheduled', 'published', 'failed'
                        )),
  title                 TEXT,
  content_text          TEXT NOT NULL DEFAULT '',
  attached_image_urls   TEXT[] NOT NULL DEFAULT '{}',
  scheduled_for         TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,
  published_id          TEXT,
  last_error            TEXT
);

CREATE INDEX IF NOT EXISTS compose_drafts_author_status_idx
  ON compose_drafts (author_email, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS compose_drafts_updated_idx
  ON compose_drafts (updated_at DESC);

CREATE INDEX IF NOT EXISTS compose_drafts_scheduled_idx
  ON compose_drafts (scheduled_for) WHERE status = 'scheduled';

COMMENT ON TABLE compose_drafts IS 'Human-authored drafts from /compose (W3). Routes to LinkedIn/Bluesky/Substack/Meta/Email at publish time.';
