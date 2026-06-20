-- Biz: business-development agent for winded.vertigo
-- Tables: biz_decisions, biz_memory, biz_roadmap
-- Opportunity data is NOT duplicated here — Biz reads the existing rfp_* tables
-- (rfp_opportunities, rfp_requirements, rfp_milestones, rfp_assignments, etc.).
-- All RLS-enabled with no public policies — service-role only (same as fin_*/opsy_*).

-- business-development decisions log (go/no-go calls, pursue/submit, outcomes)
CREATE TABLE IF NOT EXISTS public.biz_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decision TEXT NOT NULL,
  context TEXT,
  category TEXT,                       -- e.g. 'go-no-go','pursue','submit','outcome','qc'
  rfp_id TEXT,                         -- optional link to rfp_opportunities.notion_page_id
  logged_by TEXT NOT NULL DEFAULT 'garrett'
);
CREATE INDEX biz_decisions_created_idx ON public.biz_decisions (created_at DESC);
CREATE INDEX biz_decisions_category_idx ON public.biz_decisions (category);
CREATE INDEX biz_decisions_rfp_idx ON public.biz_decisions (rfp_id);

-- key-value working state (same pattern as fin_memory / opsy_memory / cmo_memory)
CREATE TABLE IF NOT EXISTS public.biz_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT NOT NULL
);

-- machine-readable mirror of docs/biz/feature-catalog.md. Biz reads this to
-- surface `upgrades_available` in its briefing and remind the collective of
-- features that aren't built yet. When a phase ships, flip rows to 'shipped'
-- (here AND in the catalog doc).
CREATE TABLE IF NOT EXISTS public.biz_roadmap (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_id TEXT UNIQUE NOT NULL,     -- e.g. 'BIZ-D1'
  title TEXT NOT NULL,
  theme TEXT NOT NULL,                 -- catalog group letter A..L
  status TEXT NOT NULL DEFAULT 'backlog' CHECK (status IN ('shipped','planned','backlog')),
  priority TEXT CHECK (priority IN ('P1','P2','P3')),
  surface TEXT,                        -- 'biz' | 'dashboard' | 'pipeline' (or combos)
  fixes TEXT,                          -- the pain point it addresses
  notes TEXT,                          -- phase hint / source
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX biz_roadmap_status_idx ON public.biz_roadmap (status);
CREATE INDEX biz_roadmap_priority_idx ON public.biz_roadmap (priority);

ALTER TABLE public.biz_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biz_memory   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biz_roadmap  ENABLE ROW LEVEL SECURITY;

-- seed working state
INSERT INTO public.biz_memory (key, value, updated_by) VALUES
  ('posture-version', 'docs/biz/SKILL.md, established 2026-06-19', 'garrett'),
  ('pipeline-note',   'Biz drives the existing RFP Lighthouse scaffolding (rfp_requirements, rfp_coverage, rfp_milestones, collective_cv, bid_decision, win probability). QC gate + conflict detection land in phase 3.', 'garrett')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;

-- seed the roadmap from docs/biz/feature-catalog.md
INSERT INTO public.biz_roadmap (feature_id, title, theme, status, priority, surface, fixes, notes) VALUES
  ('BIZ-A1', 'auto-shred TOR into structured rfp_requirements rows',          'A', 'planned', 'P1', 'pipeline,dashboard', 'coverage blind spots',            'phase 5; table+view exist'),
  ('BIZ-A2', 'compliance/requirements matrix UI with click-to-traceback',     'A', 'planned', 'P1', 'dashboard',           'is every requirement answered',   'phase 5; rfp_coverage view exists'),
  ('BIZ-A3', 'auto-built submission checklist (kind=submission)',             'A', 'planned', 'P2', 'dashboard',           'missed admin items',              'phase 5'),
  ('BIZ-A4', 'smartfill into procurement portals',                            'A', 'backlog', 'P3', 'dashboard',           'portal re-keying',                'unscheduled'),
  ('BIZ-B1', 'CV de-dup — block copy-pasted experience entries',              'B', 'planned', 'P1', 'biz,pipeline',        'maria''s #1 credibility issue',   'phase 3'),
  ('BIZ-B2', 'CV/content freshness + review cycles',                          'B', 'shipped',  'P2', 'dashboard',          'stale bios',                      'collective_cv + isCvCurrent() already live'),
  ('BIZ-B3', 'per-person, role-specific CV selection',                        'B', 'backlog', 'P2', 'pipeline',            'generic CVs',                     'teamMembersForCvs partial'),
  ('BIZ-C1', 'inline per-claim source citations',                             'C', 'backlog', 'P2', 'pipeline',            'hallucination risk',              'relevantCitations exist, not traced'),
  ('BIZ-C2', 'traceability/confidence score on AI sections',                  'C', 'backlog', 'P2', 'biz,dashboard',       'trust on institutional bids',     'phase 6'),
  ('BIZ-C3', 'draft-strictly-from-source guardrail',                          'C', 'planned', 'P2', 'pipeline',            'fabricated facts',                'phase 3; prompt-level today'),
  ('BIZ-D1', 'biz_qc_review: red-team draft vs the funder''s rubric',         'D', 'planned', 'P1', 'biz',                 'no QC gate',                      'phase 3 flagship'),
  ('BIZ-D2', 'cross-source conflict detection (deal-page/docs/draft)',        'D', 'planned', 'P1', 'biz,dashboard',       'deal-page vs proposal drift',     'phase 3 flagship; market whitespace'),
  ('BIZ-D3', 'requirements-coverage check (every requirement answered)',      'D', 'planned', 'P1', 'biz,dashboard',       'incomplete bids',                 'phase 3; rfp_coverage exists'),
  ('BIZ-D4', 'self-score draft vs award criteria pre-submission',             'D', 'planned', 'P2', 'biz',                 'weak sections ship',              'phase 3/4'),
  ('BIZ-E1', 'biz_go_no_go: eligibility pass/fail then weighted scorecard',   'E', 'planned', 'P1', 'biz,dashboard',       'should-we-bid, fuzzy ownership',  'phase 4; bid_decision cols exist'),
  ('BIZ-E2', 'weighted P-win + auto-verdict bands',                           'E', 'planned', 'P1', 'biz,dashboard',       'gut-feel bids',                   'phase 4; computeWinProbability exists'),
  ('BIZ-E3', 'explainable fit-score breakdown',                               'E', 'planned', 'P2', 'dashboard',           'opaque high fit',                 'phase 5'),
  ('BIZ-F1', 'value-weighted forecast (value x P-win)',                       'F', 'planned', 'P2', 'dashboard',           'no honest pipeline number',       'phase 5'),
  ('BIZ-F2', 'portfolio analytics (win-rate, ask vs awarded, cycle time)',    'F', 'backlog', 'P2', 'dashboard',           'no learning signal',              'phase 6'),
  ('BIZ-F3', 'named-stage pipeline board',                                    'F', 'shipped',  'P2', 'dashboard',          '-',                               'kanban already live'),
  ('BIZ-G1', 'typed deadlines + multi-touch reminders + calendar sync',       'G', 'planned', 'P1', 'dashboard,biz',       'deadlines slip',                  'phase 4/5; rfp_milestones exist'),
  ('BIZ-G2', 'funder-portal registration tracker that gates a bid',           'G', 'planned', 'P1', 'dashboard',           'ungm/unicef dead-ends',           'phase 5; market whitespace'),
  ('BIZ-G3', 'real-time slack alert on new high-fit RFP',                     'G', 'planned', 'P2', 'pipeline',            'missed early window',             'phase 5; notifyNewRfps batched today'),
  ('BIZ-G4', 'delta alerts when a tracked opp''s date/status changes',        'G', 'backlog', 'P2', 'pipeline',            'silent slippage',                 'phase 6'),
  ('BIZ-H1', 'funder profile (awardees, award size, prior bids, contact)',    'H', 'planned', 'P2', 'dashboard',           'cold each time',                  'phase 5; organizations exist'),
  ('BIZ-I1', 'structured win/loss + pick-list reasons to library',            'I', 'planned', 'P2', 'biz',                 'lessons not queryable',           'phase 4; debrief cols + postmortem skill'),
  ('BIZ-I2', 'P-win calibration check',                                       'I', 'backlog', 'P3', 'biz',                 'uncalibrated scoring',            'phase 6'),
  ('BIZ-J1', 'persistent partner/teaming db',                                 'J', 'backlog', 'P2', 'dashboard,biz',       'local-partner vetting',           'phase 6'),
  ('BIZ-J2', 'capability-gap to partner recommendation',                      'J', 'backlog', 'P3', 'biz',                 'consortium gaps',                 'phase 6'),
  ('BIZ-K1', 'defensible budget range from real rates (via Fin)',             'K', 'planned', 'P1', 'biz',                 '74% spread',                      'phase 4; rateRefs exist'),
  ('BIZ-L1', 'UNGM Pro (~$158/yr) push feed',                                 'L', 'backlog', 'P3', 'pipeline',            'discovery latency',               'business case in drive; decide separately')
ON CONFLICT (feature_id) DO UPDATE
  SET title = EXCLUDED.title, theme = EXCLUDED.theme, status = EXCLUDED.status,
      priority = EXCLUDED.priority, surface = EXCLUDED.surface, fixes = EXCLUDED.fixes,
      notes = EXCLUDED.notes, updated_at = now();
