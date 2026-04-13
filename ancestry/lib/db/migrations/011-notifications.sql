-- 011: notification preferences, queue, and send tracking
-- supports immediate (debounced) and weekly digest email notifications

-- per-member notification preferences
CREATE TABLE IF NOT EXISTS notification_prefs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id     UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  immediate   BOOLEAN NOT NULL DEFAULT true,
  digest      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tree_id, email)
);

-- one row per tree with pending activity (upserted on every edit, cleared after send)
CREATE TABLE IF NOT EXISTS notification_queue (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id           UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE UNIQUE,
  first_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_actor_email  TEXT,
  activity_count    INT NOT NULL DEFAULT 1
);

-- tracks sent notifications to prevent duplicates (especially weekly digest)
CREATE TABLE IF NOT EXISTS notification_sends (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id    UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  send_type  TEXT NOT NULL,  -- 'immediate' | 'digest'
  week_start DATE,           -- iso week start, for digest dedup
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notification_sends_dedup
  ON notification_sends (tree_id, email, send_type, week_start);
