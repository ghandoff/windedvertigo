-- Shared escalation ladder (docs/human-agent-collaboration-review-2026-07-14.md
-- §7, "the operating rhythm") — one table backing lib/escalation.ts's
-- escalate() / resolveEscalation() for all six agents.
--
-- level: 1 fyi (no row written), 2 digest marker (row only, no Slack post —
-- folded into collective-digest's "decisions needed" line), 3 channel post
-- (threaded resolve via slack_ts), 4 DM to shepherd, 5 DM + urgency marker.
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

BEGIN;

CREATE TABLE IF NOT EXISTS agent_escalations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent           text NOT NULL CHECK (agent IN ('opsy', 'biz', 'pam', 'mo', 'carl', 'fin')),
  level           smallint NOT NULL CHECK (level BETWEEN 1 AND 5),
  message         text NOT NULL,
  channel         text,             -- slack channel (name or resolved id) — set for level 3+
  slack_ts        text,             -- root message ts, for the threaded resolve-note reply (level 3)
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution_note text,
  context         jsonb,            -- free-form context for future shepherd/RACI routing
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz
);

CREATE INDEX IF NOT EXISTS agent_escalations_created_idx ON agent_escalations (created_at DESC);
CREATE INDEX IF NOT EXISTS agent_escalations_status_level_idx ON agent_escalations (status, level);
CREATE INDEX IF NOT EXISTS agent_escalations_agent_idx ON agent_escalations (agent);

-- Same pattern as every other agent table (biz_decisions, cmo_strategy_brief,
-- rfp_proposal_traceability, …): RLS enabled, no policies — service-role-only
-- access via lib/supabase/client.ts's client, gated by the API routes/crons
-- that call it.
ALTER TABLE public.agent_escalations ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'agent_escalations' ORDER BY ordinal_position;

-- ── ROLLBACK (run only to undo) ───────────────────────────────────────────────
-- DROP TABLE IF EXISTS agent_escalations;
