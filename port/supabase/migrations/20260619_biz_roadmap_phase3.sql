-- Phase 3 (Biz QC gate) shipped these roadmap features. Flip them to 'shipped'
-- so biz_briefing's "upgrades available" count drops — the reminder mechanism
-- reflecting real progress. Applies after 20260619_biz_agent.sql (which seeds
-- biz_roadmap). Safe to re-run.
UPDATE public.biz_roadmap
  SET status = 'shipped', updated_at = now()
  WHERE feature_id IN (
    'BIZ-D1',  -- biz_qc_review: red-team draft vs the funder's rubric
    'BIZ-D2',  -- cross-source conflict detection (via align-narrative-across-deliverables)
    'BIZ-D3',  -- requirements-coverage / materials checklist
    'BIZ-B1'   -- CV de-dup check
  );
