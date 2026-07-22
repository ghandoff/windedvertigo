-- R4: correlate a deferred-RFP Slack notification with its thread, so inbound
-- replies (once the Slack event subscription is enabled) can be routed back to
-- the right RFP. slack_thread_ts = the posted message ts (thread anchor).
-- Additive + non-destructive.

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS slack_thread_ts text,
  ADD COLUMN IF NOT EXISTS slack_channel_id text,
  ADD COLUMN IF NOT EXISTS slack_notified_at timestamptz;
