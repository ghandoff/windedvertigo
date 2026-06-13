-- Migration 018: Expert-in-the-loop review gate tables.
--
-- Three append-only / low-row-count tables that back the shared gate library
-- (src/lib/review-gate.js). All three are additive with no deps on existing
-- tables. Deploy order doesn't matter relative to other migrations.
--
-- Spec: docs/expert-in-the-loop-gates-build-prompt.md

-- ─── pcs_review_events ────────────────────────────────────────────────────────
-- Append-only audit log. One row per gate event (approve/correct/reject/etc.).
-- NEVER DELETE OR UPDATE rows in this table — the audit guarantee is that
-- any past state is reconstructable from the log.

CREATE TABLE IF NOT EXISTS pcs_review_events (
  id                    TEXT        PRIMARY KEY,
  record_id             TEXT        NOT NULL,
  record_type           TEXT        NOT NULL, -- 'pcs-document' | 'claim' | 'evidence' | 'canonical-claim' | 'dossier'
  action                TEXT        NOT NULL, -- AUDIT_ACTION.* constant value
  actor_id              TEXT        NOT NULL,
  actor_email           TEXT        NOT NULL,
  actor_name            TEXT,
  actor_roles           TEXT[]      NOT NULL DEFAULT '{}',
  mode                  TEXT        NOT NULL, -- GATE_MODES.* constant value
  automation_suggestion JSONB,               -- snapshot of what AI/automation produced
  expert_value          JSONB,               -- what the expert submitted
  diff                  JSONB,               -- structured diff when action=corrected
  review_duration_ms    INTEGER,             -- ms the expert had the record open
  confidence_score      NUMERIC(5,4),        -- 0.0–1.0, from automation output
  notes                 TEXT,
  rule_id               TEXT,                -- which gate rule applied, if any
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Never allow UPDATE or DELETE — this table is append-only by design.
-- The application enforces this in code; add a Postgres rule as a belt-and-
-- suspenders guard.
CREATE RULE pcs_review_events_no_update AS ON UPDATE TO pcs_review_events DO INSTEAD NOTHING;
CREATE RULE pcs_review_events_no_delete AS ON DELETE TO pcs_review_events DO INSTEAD NOTHING;

-- Indexes for the review queue and governance dashboard queries.
CREATE INDEX IF NOT EXISTS pcs_review_events_record_idx
  ON pcs_review_events (record_id, record_type);

CREATE INDEX IF NOT EXISTS pcs_review_events_actor_idx
  ON pcs_review_events (actor_email);

CREATE INDEX IF NOT EXISTS pcs_review_events_created_idx
  ON pcs_review_events (created_at DESC);

CREATE INDEX IF NOT EXISTS pcs_review_events_action_idx
  ON pcs_review_events (action, record_type);


-- ─── pcs_governance_config ─────────────────────────────────────────────────
-- Single-row config table: one row holds the current governance layer state.
-- Only a super-user can update it (enforced in application code via
-- requireCapability('pcs.governance:manage') + live Notion re-verify).

CREATE TABLE IF NOT EXISTS pcs_governance_config (
  id                               TEXT        PRIMARY KEY DEFAULT 'singleton',
  governance_enabled               BOOLEAN     NOT NULL DEFAULT false,
  capture_history_when_off         BOOLEAN     NOT NULL DEFAULT true,
  auto_approve_confidence_threshold NUMERIC(5,4) NOT NULL DEFAULT 0.90,
  default_mode                     TEXT        NOT NULL DEFAULT 'human-first-ai-verify',
  toggled_at                       TIMESTAMPTZ,
  toggled_by                       TEXT,
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the singleton row so the app can always SELECT it without INSERT.
INSERT INTO pcs_governance_config (id) VALUES ('singleton')
  ON CONFLICT (id) DO NOTHING;


-- ─── pcs_governance_rules ──────────────────────────────────────────────────
-- Gate rules that admins/RA define: which mode applies per record type,
-- dual-review requirements, auto-approve thresholds, etc.

CREATE TABLE IF NOT EXISTS pcs_governance_rules (
  id                             TEXT        PRIMARY KEY,
  record_type                    TEXT        NOT NULL,
  required_mode                  TEXT,       -- GATE_MODES.* or NULL (any mode allowed)
  require_dual_review            BOOLEAN     NOT NULL DEFAULT false,
  min_confidence_for_auto_approve NUMERIC(5,4),
  block_auto_approve_below       NUMERIC(5,4),
  description                    TEXT        NOT NULL,
  active                         BOOLEAN     NOT NULL DEFAULT true,
  created_by                     TEXT        NOT NULL,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pcs_governance_rules_record_type_idx
  ON pcs_governance_rules (record_type)
  WHERE active = true;

-- Seed Sharon's stated default rules. These match DEFAULT_RULES in the
-- in-memory stub in src/app/api/pcs/governance/rules/route.js.
INSERT INTO pcs_governance_rules (id, record_type, required_mode, description, created_by)
VALUES
  ('rule_default_pcs_document',
   'pcs-document',
   'human-first-ai-verify',
   'Articles must be read and entered by a human first; AI verifies alignment afterward. (Sharon''s preference for PCS document entry.)',
   'system'),
  ('rule_default_canonical_claim',
   'canonical-claim',
   NULL,
   'Canonical claims require RA sign-off before publish.',
   'system')
ON CONFLICT (id) DO NOTHING;
