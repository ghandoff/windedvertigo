-- Add proposal_step column to track granular progress during generation.
-- This powers the in-progress step tracker UI — the Inngest function writes
-- to this column at each phase transition so the client can poll fast
-- (Supabase, not Notion) and show real progress without waiting for Notion syncs.

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS proposal_step TEXT;

COMMENT ON COLUMN rfp_opportunities.proposal_step IS
  'Current Inngest phase during generation (fetching_rfp, gathering_context, '
  'reading_document, matching_citations, writing_draft, building_documents, '
  'cover_letter, team_cvs). Null when not generating.';
