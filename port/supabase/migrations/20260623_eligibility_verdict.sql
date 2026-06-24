-- BIZ-E1 eligibility verdict columns
--
-- Adds per-row verdict tracking to rfp_requirements for eligibility checks.
-- Prior to this migration, kind='eligibility' rows only had approved_at (a
-- human-acknowledgement timestamp) with no structured outcome. The bid-decision
-- gate now requires a recorded verdict before allowing a 'bid' decision.
--
-- Two new columns, both nullable and only semantically meaningful when
-- kind='eligibility'. NULL means "not yet assessed" — the gate treats this as
-- a blocking state.
--
--   eligibility_verdict:
--     'pass'    — requirement is satisfied by the team/entity as-is
--     'fail'    — requirement is NOT met AND no coverage is in place
--     'n-a'     — requirement does not apply to this specific call
--     'covered' — requirement is not natively met but IS covered (named partner
--                 under a team-composition clause, or a registered entity on
--                 file); evidence field must be populated
--
--   eligibility_evidence:
--     Free-text required when verdict = 'covered'. Names the covering entity
--     or arrangement (e.g. "ABC Consulting, registered in-country partner, see
--     teaming agreement 2026-05-01").

ALTER TABLE rfp_requirements
  ADD COLUMN IF NOT EXISTS eligibility_verdict  TEXT
    CHECK (eligibility_verdict IN ('pass', 'fail', 'n-a', 'covered')),
  ADD COLUMN IF NOT EXISTS eligibility_evidence TEXT;

-- Partial index to make "find unassessed eligibility rows" fast.
CREATE INDEX IF NOT EXISTS idx_rfp_requirements_eligibility_unassessed
  ON rfp_requirements(rfp_id)
  WHERE kind = 'eligibility' AND eligibility_verdict IS NULL;
