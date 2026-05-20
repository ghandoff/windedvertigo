-- Strategy timelines + distribution items tables
-- Applied 2026-05-19 via `npx supabase db push`
--
-- Moves CAMPAIGN_TIMELINES and DISTRIBUTION from strategy-data.ts hardcode
-- into Supabase so they can be updated without a redeploy.
--
-- strategy_campaign_timelines: 6 marketing campaigns across May–Sep 2026
-- strategy_distribution_items: 12 work-distribution assignments

-- ── strategy_campaign_timelines ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS strategy_campaign_timelines (
  id          TEXT PRIMARY KEY,
  label       TEXT        NOT NULL,
  colour      TEXT        NOT NULL,   -- hex colour, e.g. '#2d9c8a'
  dark_text   BOOLEAN     NOT NULL DEFAULT false,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  milestones  JSONB       NOT NULL DEFAULT '[]',  -- [{date, label}, ...]
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── strategy_distribution_items ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS strategy_distribution_items (
  id                TEXT        PRIMARY KEY,
  name              TEXT        NOT NULL,
  owner             TEXT        NOT NULL,   -- lower-case team member first name
  support           TEXT[]      NOT NULL DEFAULT '{}',
  next_action       TEXT        NOT NULL,
  deadline          TEXT        NOT NULL,   -- human-readable: "may 31", "weekly", etc.
  campaign_id       TEXT        REFERENCES strategy_campaign_timelines(id) ON DELETE SET NULL,
  linked_project_id TEXT,                   -- Supabase notion_page_id of a PM project, if any
  sort_order        INTEGER     NOT NULL DEFAULT 0,
  active            BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── seed: strategy_campaign_timelines ────────────────────────────────────────

INSERT INTO strategy_campaign_timelines (id, label, colour, dark_text, start_date, end_date, milestones, sort_order)
VALUES
  (
    'ppcs-harbour-funnel',
    'ppcs → harbour funnel',
    '#43b187',
    false,
    '2026-05-01', '2026-06-15',
    '[{"date":"2026-05-28","label":"harbour launch"},{"date":"2026-06-01","label":"first cohort"}]',
    1
  ),
  (
    'harbour-launch',
    'harbour launch',
    '#5872cb',
    false,
    '2026-05-15', '2026-07-15',
    '[{"date":"2026-05-28","label":"soft launch"},{"date":"2026-06-15","label":"public"},{"date":"2026-07-01","label":"first retention data"}]',
    2
  ),
  (
    'conference-injection',
    'conference injection',
    '#cb7858',
    false,
    '2026-05-01', '2026-09-30',
    '[{"date":"2026-06-15","label":"ISTE"},{"date":"2026-07-15","label":"learning impact"},{"date":"2026-08-15","label":"devlearn"}]',
    3
  ),
  (
    'warm-network-activation',
    'warm network activation',
    '#b15043',
    false,
    '2026-05-01', '2026-06-30',
    '[{"date":"2026-05-15","label":"first round"},{"date":"2026-06-01","label":"follow-up round"}]',
    4
  ),
  (
    'content-engine',
    'content engine',
    '#d5d2ff',
    false,
    '2026-05-01', '2026-09-30',
    '[{"date":"2026-05-15","label":"rhythm established"},{"date":"2026-06-30","label":"first viral target"},{"date":"2026-08-31","label":"1000 subscribers"}]',
    5
  ),
  (
    'cold-outreach-refresh',
    'cold outreach refresh',
    '#ffebd2',
    true,
    '2026-06-01', '2026-09-30',
    '[{"date":"2026-06-15","label":"new messaging live"},{"date":"2026-07-31","label":"A/B results"},{"date":"2026-08-31","label":"scale"}]',
    6
  )
ON CONFLICT (id) DO NOTHING;

-- ── seed: strategy_distribution_items ────────────────────────────────────────

INSERT INTO strategy_distribution_items (id, name, owner, support, next_action, deadline, campaign_id, sort_order)
VALUES
  (
    'warm-outreach-50',
    'warm network outreach (50 calls)',
    'garrett', ARRAY['lamis', 'maria'],
    'send first 25 emails this week',
    'may 31',
    'warm-network-activation',
    1
  ),
  (
    'harbour-launch-week',
    'harbour launch (may 28)',
    'payton', ARRAY['garrett', 'jamie'],
    'finalize launch-day social schedule + email',
    'may 28',
    'harbour-launch',
    2
  ),
  (
    'ppcs-curriculum-integration',
    'ppcs → harbour curriculum integration',
    'lamis', ARRAY['garrett'],
    'draft integration map for first cohort',
    'may 25',
    'ppcs-harbour-funnel',
    3
  ),
  (
    'conference-submissions',
    'conference submissions (PEDAL + ISTE + ASCD)',
    'garrett', ARRAY['payton', 'jamie'],
    'submit PEDAL abstract + ISTE rapid-fire',
    'may 12',
    'conference-injection',
    4
  ),
  (
    'iste-booth-design',
    'ISTE booth design + logistics',
    'payton', ARRAY['jamie'],
    'finalize booth quote ($3k) + travel',
    'june 14',
    'conference-injection',
    5
  ),
  (
    'substack-author-cadence',
    'substack author cadence (bi-weekly)',
    'jamie', ARRAY['lamis', 'garrett'],
    'publish post #1 + queue post #2',
    'may 15 (post #1)',
    'content-engine',
    6
  ),
  (
    'instagram-reels',
    'instagram + reels production',
    'payton', ARRAY[]::TEXT[],
    'produce 3 reels for harbour launch teaser',
    'may 21',
    'content-engine',
    7
  ),
  (
    'cold-batch-2',
    'cold outreach batch #2 (30 targets)',
    'garrett', ARRAY['payton'],
    'rebuild target list + draft new opener',
    'june 15',
    'cold-outreach-refresh',
    8
  ),
  (
    'guest-post-pitches',
    'guest post pitches (5 publications)',
    'jamie', ARRAY['payton'],
    'draft pitch templates + identify outlets',
    'june 30',
    'content-engine',
    9
  ),
  (
    'case-study-sourcing',
    'client testimonials + case studies',
    'maria', ARRAY['garrett'],
    'outreach to 3 PPCS leads + IDB Salvador team',
    'june 30',
    NULL,
    10
  ),
  (
    'weekly-cmo-review',
    'weekly CMO review (wed)',
    'garrett', ARRAY['payton'],
    'automated review runs wed 9am · review output',
    'weekly',
    NULL,
    11
  ),
  (
    'cultural-qa-gate',
    'cultural appropriateness QA gate (all deliverables)',
    'maria', ARRAY['garrett'],
    'review harbour launch copy + landing page',
    'rolling',
    NULL,
    12
  )
ON CONFLICT (id) DO NOTHING;
