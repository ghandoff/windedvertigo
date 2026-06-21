-- Proposal lifecycle tracking — separate from proposal_status (generation state).
--
-- proposal_review_stage  tracks the HUMAN review lifecycle after a doc is generated:
--   v1-generated → biz-review → human-review → approved → exported
--
-- proposal_review_gates  is the event log: one row per stage transition.
-- Apply in Supabase SQL editor (wv-port-pilot). Idempotent.

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS proposal_review_stage TEXT
    CHECK (proposal_review_stage IN (
      'v1-generated','biz-review','human-review','approved','exported','submitted'
    ));

-- Backfill: proposals already generated but not yet staged
UPDATE rfp_opportunities
  SET proposal_review_stage = 'v1-generated'
  WHERE proposal_status = 'ready-for-review'
    AND proposal_review_stage IS NULL;

CREATE TABLE IF NOT EXISTS proposal_review_gates (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id     TEXT        NOT NULL,
  stage_from TEXT,
  stage_to   TEXT        NOT NULL,
  action     TEXT        NOT NULL,
  by         TEXT,
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_review_gates_rfp_id
  ON proposal_review_gates (rfp_id);
