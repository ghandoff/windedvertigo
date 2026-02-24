-- Migration 017: user notification preferences
--
-- Stores per-user digest/notification settings. Each user gets a row
-- on first interaction with the notification system (lazy-created).
-- digest_enabled defaults TRUE so existing users get the digest
-- unless they opt out.

BEGIN;

CREATE TABLE IF NOT EXISTS user_notification_prefs (
  user_id           UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  digest_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  digest_frequency  TEXT NOT NULL DEFAULT 'weekly'
                    CHECK (digest_frequency IN ('weekly', 'never')),
  last_digest_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
