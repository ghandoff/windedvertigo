-- wv-claw agent audit table.
--
-- Replaces the Notion `agent actions` DB (id f2f48a99…) that wv-claw has
-- written to since launch. Migration W0.1 of the Q2/Q3 portfolio expansion
-- plan — gives us SQL queryability over agent behavior (cost per turn,
-- error rates, tool-use distribution, per-user activity).
--
-- Notion writes continue in parallel for ~1 week as a safety net; this
-- table becomes the primary source of truth after that.
--
-- Read path: lib/supabase/agent-actions.ts
-- Write path: lib/agent/audit.ts (dual-writes to Notion + this table)

CREATE TABLE IF NOT EXISTS agent_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Slack event_id — used for idempotency. Slack delivers events at-least-once
  -- and the agent dedupes by checking for an existing row before re-processing.
  event_id        TEXT NOT NULL,
  user_email      TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('success', 'error', 'timeout', 'rejected')),
  -- Tools the agent called during the turn. Empty array for rejections.
  tools_called    TEXT[] NOT NULL DEFAULT '{}',
  turn_count      INTEGER,
  duration_ms     INTEGER,
  -- First 1800 chars of the final reply (Notion-compatibility cap kept for parity).
  reply_preview   TEXT,
  error_message   TEXT,
  -- Token economics. Summed across all turns in the loop.
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  cost_usd        NUMERIC(10, 6),
  model_id        TEXT
);

-- Idempotency lookup: hasAuditedEvent(eventId) queries this index.
CREATE INDEX IF NOT EXISTS agent_actions_event_idx
  ON agent_actions (event_id);

-- Time-ordered scans (recent activity, dashboards).
CREATE INDEX IF NOT EXISTS agent_actions_created_idx
  ON agent_actions (created_at DESC);

-- Per-user history (per-user cost roll-ups, error rates).
CREATE INDEX IF NOT EXISTS agent_actions_user_idx
  ON agent_actions (user_email, created_at DESC);

COMMENT ON TABLE agent_actions IS 'wv-claw per-turn audit log. One row per Slack event the agent processes (or rejects).';
COMMENT ON COLUMN agent_actions.event_id IS 'Slack event_id from the Events API payload. Used as idempotency key.';
COMMENT ON COLUMN agent_actions.cost_usd IS 'Total USD cost for the turn computed from MODEL_PRICING (lib/ai/types.ts).';
COMMENT ON COLUMN agent_actions.tools_called IS 'Ordered list of tool names invoked during the agent loop. Duplicates allowed (same tool called twice = two entries).';
