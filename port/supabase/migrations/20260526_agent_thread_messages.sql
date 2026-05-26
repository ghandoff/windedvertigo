-- wv-claw conversation memory (W0.2).
--
-- Per-thread message history so wv-claw remembers context across sequential
-- DMs in the same Slack thread/channel. Without this, every DM is a fresh
-- agent turn with no awareness that the user just asked "what about IDB?"
-- thirty seconds ago.
--
-- Key model:
--   thread_key = Slack thread_ts when the message is in a thread,
--                otherwise the channel ID (DM channel — all messages
--                between a user and the bot share one channel).
--
-- TTL: 7 days. After that, conversation continuity is unlikely and prompt
-- cost outweighs context value. A future cron can prune; for now reads are
-- already filtered to the last 1 hour by default so storage grows slowly.
--
-- Stores plain text only — we deliberately do NOT replay full assistant
-- content blocks (tool_use ids would be stale across turns). Just the final
-- text the user said + the final text the agent said.

CREATE TABLE IF NOT EXISTS agent_thread_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Slack thread_ts when present, else channel id. Anchors a conversation.
  thread_key  TEXT NOT NULL,
  -- Slack user id of the human party (for per-user filtering, e.g. when
  -- multiple humans share a channel with the bot). Null = bot turn.
  slack_user_id TEXT,
  role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL
);

-- Recent-messages-for-thread is the dominant read.
CREATE INDEX IF NOT EXISTS agent_thread_messages_thread_idx
  ON agent_thread_messages (thread_key, created_at DESC);

COMMENT ON TABLE agent_thread_messages IS 'wv-claw per-thread conversation memory. Loaded into messages[] before each Anthropic call.';
COMMENT ON COLUMN agent_thread_messages.thread_key IS 'Slack thread_ts if present, else channel id. Same DM thread = same key.';
