-- RFP Pipeline v2 — Phase 1 schema
--
-- Adds the structured spine that makes proposal generation reliable:
--   - rfp_requirements: row-level structured requirements extracted from each TOR
--   - rfp_milestones: working-backward milestone schedule per RFP
--   - rfp_assignments: per-contributor task tracking + Slack notification state
--   - collective_cv: CV currency tracking (whitespace differentiator)
--   - rfp_coverage: SQL view computing per-requirement coverage status
--
-- Plus 8 new columns on rfp_opportunities for the verification gate + bid/no-bid
-- decision capture + the 2 missing deliverable URLs (EOI + Financial Proposal)
-- that already land in Notion but had nowhere to live in Supabase.
--
-- All FK references target rfp_opportunities.notion_page_id (UNIQUE TEXT) —
-- matches how every other module identifies RFPs (canonical ID flowing from
-- Notion). PostgreSQL permits FKs to UNIQUE columns, not just PKs.

-- ============================================================================
-- 1. rfp_requirements — the spine of every RFP
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfp_requirements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id                TEXT NOT NULL REFERENCES rfp_opportunities(notion_page_id) ON DELETE CASCADE,

  -- Classification
  kind                  TEXT NOT NULL,
  CONSTRAINT rfp_requirements_kind_check CHECK (kind IN
    ('deliverable', 'eligibility', 'evaluation_criterion', 'admin', 'submission')),
  label                 TEXT NOT NULL,
  description           TEXT,

  -- Per-deliverable parameters (NULL for non-deliverable kinds)
  page_limit            INTEGER,
  word_limit            INTEGER,
  format                TEXT,           -- 'pdf' | 'docx' | 'either' | NULL
  required_sections     TEXT[],         -- e.g. ['Track record', 'Summary of evidence', 'Profile']

  -- Per-evaluation-criterion (NULL for non-criterion kinds)
  weight_pct            NUMERIC,

  -- Coverage / gating
  required              BOOLEAN NOT NULL DEFAULT TRUE,
  approved_by           TEXT,           -- email of human who approved this row
  approved_at           TIMESTAMPTZ,

  -- Provenance
  extracted_by          TEXT,           -- 'claude:haiku-4-5-20251001' | 'human' | etc.
  extraction_confidence NUMERIC,        -- 0.0 to 1.0
  source_quote          TEXT,           -- quoted snippet from TOR — verification anchor

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rfp_requirements_rfp_id      ON rfp_requirements(rfp_id);
CREATE INDEX IF NOT EXISTS idx_rfp_requirements_rfp_kind    ON rfp_requirements(rfp_id, kind);
CREATE INDEX IF NOT EXISTS idx_rfp_requirements_unapproved  ON rfp_requirements(rfp_id) WHERE approved_at IS NULL;

-- ============================================================================
-- 2. rfp_milestones — working-backward schedule per RFP
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfp_milestones (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id            TEXT NOT NULL REFERENCES rfp_opportunities(notion_page_id) ON DELETE CASCADE,
  label             TEXT NOT NULL,
  due_at            TIMESTAMPTZ NOT NULL,
  owner_email       TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT rfp_milestones_status_check CHECK (status IN
    ('pending', 'in-progress', 'done', 'slipped', 'cancelled')),
  reminder_sent_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rfp_milestones_due           ON rfp_milestones(rfp_id, due_at);
CREATE INDEX IF NOT EXISTS idx_rfp_milestones_owner_pending ON rfp_milestones(owner_email, status, due_at)
  WHERE status = 'pending';

-- ============================================================================
-- 3. rfp_assignments — per-contributor task tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS rfp_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id            TEXT NOT NULL REFERENCES rfp_opportunities(notion_page_id) ON DELETE CASCADE,
  -- requirement_id may be NULL for cross-cutting tasks (CV verify, "review the proposal")
  requirement_id    UUID REFERENCES rfp_requirements(id) ON DELETE CASCADE,
  task_label        TEXT NOT NULL,           -- e.g. "Verify CV is current", "Review proposed approach"
  assignee_email    TEXT NOT NULL,
  due_at            TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'pending',
  CONSTRAINT rfp_assignments_status_check CHECK (status IN
    ('pending', 'in-progress', 'done', 'declined', 'cancelled')),
  notified_at       TIMESTAMPTZ,
  acked_at          TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rfp_assignments_rfp_assignee ON rfp_assignments(rfp_id, assignee_email);
CREATE INDEX IF NOT EXISTS idx_rfp_assignments_assignee_pending ON rfp_assignments(assignee_email, status)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_rfp_assignments_requirement ON rfp_assignments(requirement_id);

-- ============================================================================
-- 4. collective_cv — CV currency tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS collective_cv (
  member_email          TEXT PRIMARY KEY,
  member_name           TEXT NOT NULL,
  bio                   TEXT NOT NULL,
  last_verified_at      TIMESTAMPTZ,
  notion_page_id        TEXT,                -- if the CV has its own Notion page
  expires_after_days    INTEGER NOT NULL DEFAULT 90,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. rfp_opportunities — new columns for verification gate + bid decision + URLs
-- ============================================================================
-- All ADD COLUMN with no DEFAULT so they're NULL-safe for existing rows
-- (no table rewrite, no read disruption on the live kanban).

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS tor_verified_by             TEXT,
  ADD COLUMN IF NOT EXISTS tor_verified_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bid_decision                TEXT,
  ADD COLUMN IF NOT EXISTS bid_decision_at             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bid_decision_by             TEXT,
  ADD COLUMN IF NOT EXISTS bid_decision_reason         TEXT,
  ADD COLUMN IF NOT EXISTS bid_decision_score          NUMERIC,
  ADD COLUMN IF NOT EXISTS expression_of_interest_url  TEXT,
  ADD COLUMN IF NOT EXISTS financial_proposal_url      TEXT;

-- Constrain bid_decision to known values (NULL allowed = not yet decided)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rfp_opportunities_bid_decision_check'
  ) THEN
    ALTER TABLE rfp_opportunities
      ADD CONSTRAINT rfp_opportunities_bid_decision_check
      CHECK (bid_decision IS NULL OR bid_decision IN ('bid', 'no-bid', 'deferred'));
  END IF;
END $$;

-- ============================================================================
-- 6. rfp_coverage — SQL view (compliance matrix)
-- ============================================================================
-- Per-requirement view answering "is this row covered?".
--   - kind='deliverable': covered when at least one assignment for it is 'done'
--   - kind='evaluation_criterion': covered when manually flagged via notes
--     (Phase 2; for now treats criterion as covered if the RFP itself is in
--     pursuing+ status, since drafting addresses criteria implicitly)
--   - kind='eligibility' / 'admin' / 'submission': always covered (these are
--     informational; no separate "complete" state)
--
-- Drop and recreate so rerunning this migration cleanly updates the definition.

DROP VIEW IF EXISTS rfp_coverage;
CREATE VIEW rfp_coverage AS
SELECT
  r.rfp_id,
  r.id              AS requirement_id,
  r.kind,
  r.label,
  r.required,
  r.approved_at     IS NOT NULL AS approved,
  CASE
    WHEN r.kind = 'deliverable'
      THEN EXISTS (
        SELECT 1 FROM rfp_assignments a
        WHERE a.requirement_id = r.id AND a.status = 'done'
      )
    -- For non-deliverable kinds, "covered" simply means "approved" — once a
    -- human approves the row, the requirement is acknowledged. Phase 2 may add
    -- per-kind coverage rules.
    ELSE r.approved_at IS NOT NULL
  END               AS covered
FROM rfp_requirements r;

-- ============================================================================
-- 7. Touch trigger for updated_at on rfp_requirements
-- ============================================================================
-- Keeps updated_at fresh whenever a requirement row is changed (approval, edit).

CREATE OR REPLACE FUNCTION rfp_requirements_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rfp_requirements_set_updated_at ON rfp_requirements;
CREATE TRIGGER rfp_requirements_set_updated_at
  BEFORE UPDATE ON rfp_requirements
  FOR EACH ROW
  EXECUTE FUNCTION rfp_requirements_touch_updated_at();
