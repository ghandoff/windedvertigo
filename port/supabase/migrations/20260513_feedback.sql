-- Prompt 4 (post-strategy-playdate): persistent feedback log.
--
-- The /api/feedback route currently only posts to a Slack webhook. With this
-- table, every feedback submission is also stored in Supabase so nothing is
-- lost if the Slack message scrolls past or someone wants to query patterns
-- across submissions ("how many bugs about the kanban this week?").

CREATE TABLE IF NOT EXISTS feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- core fields
  category        TEXT NOT NULL CHECK (category IN ('bug', 'confusion', 'idea', 'praise', 'feature-request', 'other')),
  description     TEXT NOT NULL,
  -- automatic context
  page_url        TEXT,
  user_email      TEXT,
  user_name       TEXT,
  -- delivery + triage
  slack_posted_at TIMESTAMPTZ,
  slack_error     TEXT,
  resolved_at     TIMESTAMPTZ,
  resolved_by     TEXT,
  resolution_note TEXT,
  -- bookkeeping
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS feedback_unresolved_idx
  ON feedback (created_at DESC)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS feedback_category_idx ON feedback (category);

COMMENT ON TABLE feedback IS
  'Persistent log of in-app feedback submissions. Every row is also posted to Slack via SLACK_FEEDBACK_WEBHOOK_URL — `slack_posted_at` records when, `slack_error` captures any webhook failure (the row stays in the DB regardless).';
