-- Add proposal timing columns to rfp_opportunities.
--
-- proposal_started_at: set when a generation is atomically claimed.
-- proposal_completed_at: set when generation reaches any terminal state
--   (ready-for-review, failed, skipped).
--
-- Together these enable:
--   1. Detecting stuck jobs: WHERE proposal_status = 'generating'
--        AND proposal_started_at < NOW() - INTERVAL '10 minutes'
--   2. The UI "has been generating for X minutes" display.
--   3. An atomic claim guard (see lib/supabase/rfp-opportunities.ts).

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS proposal_started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS proposal_completed_at timestamptz;

-- Index for stuck-job sweep query.
CREATE INDEX IF NOT EXISTS rfp_opp_proposal_started_at_idx
  ON rfp_opportunities (proposal_started_at)
  WHERE proposal_status = 'generating';
