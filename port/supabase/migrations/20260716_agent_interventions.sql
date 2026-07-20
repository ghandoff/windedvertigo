-- Ambient-agent spine — the decision/preview-card queue for proactive
-- agent interventions (docs/prompts/executive-agents-phase1-build.md).
--
-- Deliberately NOT named `agent_actions` — that table already exists as
-- wv-claw's per-Slack-turn audit/cost log (lib/supabase/agent-actions.ts,
-- backs the per-user $ budget guard) and means something different.
--
-- risk_tier follows the charters' 3-tier model (docs/agents/executive-charters.md
-- "shared rules"): low = act, no gate · medium = act + notify, reversible ·
-- high = preview card + explicit approval, default-deny on timeout.
-- status: proposed (awaiting/queued) → approved | edited | redirected | ignored
-- (human decisions) | expired (high-tier default-deny) | executed (low/medium
-- auto-applied, or high after approval).
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

BEGIN;

CREATE TABLE IF NOT EXISTS agent_interventions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent               text NOT NULL CHECK (agent IN ('opsy', 'biz', 'pam', 'mo', 'carl', 'fin')),
  trigger_event_id    uuid,             -- references event_log(id); no FK (event_log rows may be pruned later)
  decision            text NOT NULL CHECK (decision IN ('silent', 'act_low', 'act_notify', 'preview')),
  risk_tier           text NOT NULL CHECK (risk_tier IN ('low', 'medium', 'high')),
  trigger             text NOT NULL,    -- human-readable "I'm here because X happened" — every intervention names it
  artifact            jsonb,            -- the drafted content / proposed change, shape varies by action-type
  rationale           text,
  channel             text,             -- slack channel or "dm:<email>" the card was (or would be) posted to
  preview_message_ts  text,             -- slack ts of the posted card, for response_url-less updates / audit
  status              text NOT NULL DEFAULT 'proposed'
                        CHECK (status IN ('proposed', 'approved', 'edited', 'redirected', 'ignored', 'expired', 'executed')),
  expires_at          timestamptz,      -- set for risk_tier='high'; default-deny past this if still 'proposed'
  target_human        text,             -- email of whoever the intervention notifies — the ≤5/human/day budget counts this, not `human`
  human               text,             -- email of whoever resolved it (approve/edit/redirect/ignore)
  resolved_at         timestamptz,
  outcome_notes       text,
  cost_usd            numeric(10, 6),
  model_id            text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_interventions_agent_created_idx ON agent_interventions (agent, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_interventions_status_tier_idx ON agent_interventions (status, risk_tier);
CREATE INDEX IF NOT EXISTS agent_interventions_target_human_idx ON agent_interventions (target_human, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_interventions_expires_idx ON agent_interventions (expires_at) WHERE status = 'proposed';

-- Same pattern as every other agent table: RLS enabled, no policies —
-- service-role-only access via lib/supabase/client.ts, gated by the API
-- routes/crons that call it.
ALTER TABLE public.agent_interventions ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'agent_interventions' ORDER BY ordinal_position;

-- ── ROLLBACK (run only to undo) ───────────────────────────────────────────────
-- DROP TABLE IF EXISTS agent_interventions;
