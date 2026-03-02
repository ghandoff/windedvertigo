-- Migration 041: In-app notification center
--
-- Adds a notifications table for the in-app notification bell.
-- Separate from the email digest system (user_notification_prefs / cron).
-- Each row is a discrete event that renders in the dropdown.

CREATE TABLE IF NOT EXISTS in_app_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,                   -- e.g. gallery_approved, invite_accepted, ...
  title       TEXT NOT NULL,                   -- short summary shown in dropdown
  body        TEXT,                            -- optional longer description
  href        TEXT,                            -- link to navigate on click
  actor_id    UUID REFERENCES users(id),       -- who triggered the notification (nullable for system events)
  read_at     TIMESTAMPTZ,                     -- null = unread
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup: user's unread notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_in_app_notif_user_unread
  ON in_app_notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- General lookup: user's recent notifications (read + unread)
CREATE INDEX IF NOT EXISTS idx_in_app_notif_user_recent
  ON in_app_notifications (user_id, created_at DESC);

-- Prevent duplicate notifications for the same event
-- (e.g. don't notify twice about the same gallery approval)
CREATE UNIQUE INDEX IF NOT EXISTS idx_in_app_notif_dedup
  ON in_app_notifications (user_id, event_type, href)
  WHERE href IS NOT NULL;
