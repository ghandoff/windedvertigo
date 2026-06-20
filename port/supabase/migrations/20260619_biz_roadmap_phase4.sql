-- Phase 4 (Biz go/no-go + cross-agent handoffs) shipped these roadmap features.
-- Apply in the Supabase SQL editor (wv-port-pilot) — `supabase db push` is
-- unreliable in this repo (duplicate same-date migration versions). Idempotent.
UPDATE public.biz_roadmap
  SET status = 'shipped', updated_at = now()
  WHERE feature_id IN (
    'BIZ-E1',  -- biz_go_no_go: eligibility pass/fail then weighted scorecard
    'BIZ-E2',  -- weighted P-win + auto-verdict bands
    'BIZ-I1',  -- structured win/loss + debrief -> rfp-postmortem-to-library
    'BIZ-K1'   -- defensible budget range via Fin (fin_briefing handoff, wired in the skill)
  );
