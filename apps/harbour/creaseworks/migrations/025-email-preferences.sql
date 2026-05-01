-- Migration 025: email preferences enhancement
--
-- Adds biweekly option to digest_frequency and extends
-- user_notification_prefs with support for nudge emails.
-- Also tracks inactivity for nudge emails.

BEGIN;

-- Update digest_frequency constraint to allow 'biweekly'
ALTER TABLE user_notification_prefs DROP CONSTRAINT IF EXISTS user_notification_prefs_digest_frequency_check;

ALTER TABLE user_notification_prefs
ADD CONSTRAINT user_notification_prefs_digest_frequency_check
CHECK (digest_frequency IN ('weekly', 'biweekly', 'never'));

-- Add nudge email tracking
ALTER TABLE user_notification_prefs
ADD COLUMN IF NOT EXISTS nudge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS last_nudge_sent_at TIMESTAMPTZ;

-- Add last activity timestamp for nudge eligibility
ALTER TABLE users
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for nudge eligibility queries
CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_nudge_eligible
ON user_notification_prefs(nudge_enabled)
WHERE nudge_enabled = TRUE;

CREATE INDEX IF NOT EXISTS idx_users_last_active_at
ON users(last_active_at);

COMMIT;
