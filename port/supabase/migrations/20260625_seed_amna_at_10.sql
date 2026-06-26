-- seed: "amna at 10" desk-review — programme lane + inception reading-sprint commitments
--
-- Run AFTER 20260625_pam_commitment_programme.sql, in the Supabase SQL editor
-- (wv-port-pilot project). One clean run is idempotent-guarded by name/programme;
-- re-runs only insert rows that don't already exist.
--
-- What it creates:
--   1. project  'amna at 10'  (type 'contract' → sorts with LEAP/PRME, gets a lane colour)
--   2. milestone 'inception note' parented to it (PROVISIONAL dates — see note)
--   3. eight pam_commitments (programme = 'amna at 10'):
--        carl (upstream) → the four human reads depend on it → biz gate depends on
--        the reads → finn depends on the biz gate; mo depends on maria's read.
--
-- NOTE on dates: the timeline lane only renders a milestone that has a start OR
-- end date (project-timeline.ts skips date-less milestones), so the inception
-- milestone carries PROVISIONAL dates (2026-06-22 → 2026-07-15) to make the lane
-- appear now. Re-baseline end_date once the kickoff (~1 Jul) is booked. The
-- COMMITMENT due-dates are intentionally left NULL until the kickoff is booked,
-- so no commitment shows a fake deadline.

BEGIN;

WITH
-- 1. programme/project row (skip if one already exists)
proj AS (
  INSERT INTO projects (notion_page_id, project, status, priority, type, timeline_start, timeline_end, archive)
  SELECT gen_random_uuid()::text, 'amna at 10', 'active', 'high', 'contract', '2026-06-22', '2026-09-30', false
  WHERE NOT EXISTS (SELECT 1 FROM projects WHERE project = 'amna at 10')
  RETURNING notion_page_id
),
-- 2. inception-note milestone, parented to the project (PROVISIONAL dates)
ms AS (
  INSERT INTO milestones (notion_page_id, milestone, kind, milestone_status, project_ids, start_date, end_date, client_visible, archive)
  SELECT gen_random_uuid()::text, 'inception note', 'milestone', 'not started',
         ARRAY[(SELECT notion_page_id FROM proj)], '2026-06-22', '2026-07-15', false, false
  WHERE EXISTS (SELECT 1 FROM proj)
  RETURNING notion_page_id
),
-- 3a. cARL thematic pass — UPSTREAM, feeds the human deep-reads
carl AS (
  INSERT INTO pam_commitments (who, what, source, programme, commitment_type, cycle, start_date, visibility)
  SELECT 'carl',
         'llm-assisted thematic pass on the long-tail partner-MEAL files (the files no human reads); maintain the evidence map + library findings; support the OSF prereg — docs/carl/amna/2026-06-25-amna-at-10-desk-review-plan.md',
         'amna at 10 · desk-review plan',
         'amna at 10', 'learning', '2026-06-22', '2026-06-22', 'public'
  WHERE NOT EXISTS (SELECT 1 FROM pam_commitments WHERE programme = 'amna at 10' AND who = 'carl')
  RETURNING id
),
-- 3b. the four human reads — each depends on the cARL pass
humans AS (
  INSERT INTO pam_commitments (who, what, source, programme, commitment_type, cycle, if_then_plan, depends_on, visibility)
  SELECT v.who, v.what, v.source, 'amna at 10', 'learning', '2026-06-29', v.if_then,
         (SELECT array_agg(id) FROM carl), 'public'
  FROM (VALUES
    ('garrett',
     'read the ~15 strategy/spine docs (healing-ecosystems evolution, internal narrative 2026, MEL ToC, cumulative-reach workbook) + the 2022 six-year evaluation; log key points to the evidence register — https://app.notion.com/p/38ae4ee74ba481a29aa0f72fda76e218',
     'amna at 10 · START HERE',
     'if it''s a pre-kickoff prep block, then skim the headline docs and note 3 framing questions before the kickoff'),
    ('jamie',
     'read the external academic evals (UVA Baytna final, Chapin Hall Afghanistan final, Nexus CP Afghanistan) + a methods/evidence-quality pass; owns the OSF prereg — https://app.notion.com/p/38ae4ee74ba481088a42e35b9573fda5',
     'amna at 10 · v2 inception package',
     'if it''s a pre-kickoff prep block, then skim the eval executive summaries and note method/quality flags before the kickoff'),
    ('lamis',
     'read the Arabic/MENA materials (UVA Jordan & Lebanon incl. transcripts, Baytna Lebanon, CP Afghanistan partner docs, Palestine emergency response); trans-adaptation checks — https://app.notion.com/p/38ae4ee74ba481dd8b8cef99843c6054',
     'amna at 10 · raw-data plan',
     'if it''s a pre-kickoff prep block, then skim the MENA materials and flag trans-adaptation questions before the kickoff'),
    ('maria',
     'read Baytna/ECD + Dinami/youth + public-facing impact narratives; owns the evidence map + inception workshop — https://windedvertigo.com/tools/amna-evidence-map/',
     'amna at 10 · evidence map',
     'if it''s a pre-kickoff prep block, then skim the impact narratives and draft the inception-workshop shape before the kickoff')
  ) AS v(who, what, source, if_then)
  WHERE NOT EXISTS (SELECT 1 FROM pam_commitments WHERE programme = 'amna at 10' AND who = v.who)
  RETURNING id, who
),
-- 3c. biz QC / go-no-go gate — depends on the human reads
biz AS (
  INSERT INTO pam_commitments (who, what, source, programme, commitment_type, cycle, start_date, depends_on, visibility)
  SELECT 'biz',
         'qc / go-no-go gate on decisions A1–A5, then a quality-review gate on each deliverable before it goes to amna — https://app.notion.com/p/38ae4ee74ba481a29aa0f72fda76e218',
         'amna at 10 · START HERE (A1–A5)',
         'amna at 10', 'action', '2026-06-22', '2026-06-22',
         (SELECT array_agg(id) FROM humans), 'public'
  WHERE NOT EXISTS (SELECT 1 FROM pam_commitments WHERE programme = 'amna at 10' AND who = 'biz')
  RETURNING id
),
-- 3d. mo positioning — depends on maria's read (impact narratives)
mo AS (
  INSERT INTO pam_commitments (who, what, source, programme, commitment_type, depends_on, visibility)
  SELECT 'mo',
         'public impact-brief positioning, the september "activated outputs", dissemination strategy — https://app.notion.com/p/38ae4ee74ba481a29aa0f72fda76e218',
         'amna at 10 · START HERE (A5)',
         'amna at 10', 'action',
         (SELECT array_agg(id) FROM humans WHERE who = 'maria'), 'public'
  WHERE NOT EXISTS (SELECT 1 FROM pam_commitments WHERE programme = 'amna at 10' AND who = 'mo')
  RETURNING id
)
-- 3e. finn milestone invoicing — depends on the biz gate
INSERT INTO pam_commitments (who, what, source, programme, commitment_type, start_date, due_date, depends_on, visibility)
SELECT 'finn',
       'track the 30/30/40 milestone invoicing against deliverable approval (30% signed ✓ · 30% inception-note approval · 40% finals)',
       'amna at 10 · contract Annex B',
       'amna at 10', 'action', '2026-06-22', '2026-09-30',
       (SELECT array_agg(id) FROM biz), 'public'
WHERE NOT EXISTS (SELECT 1 FROM pam_commitments WHERE programme = 'amna at 10' AND who = 'finn');

COMMIT;

-- ── DRY-RUN (preview what will exist) ────────────────────────────────────────
-- SELECT who, commitment_type, cycle, due_date, programme FROM pam_commitments
-- WHERE programme = 'amna at 10' ORDER BY created_at;
-- SELECT project, type, timeline_start, timeline_end FROM projects WHERE project = 'amna at 10';
-- SELECT milestone, start_date, end_date FROM milestones WHERE milestone = 'inception note';

-- ── ROLLBACK (run only to undo the entire seed) ──────────────────────────────
-- DELETE FROM pam_commitments WHERE programme = 'amna at 10';
-- DELETE FROM milestones WHERE notion_page_id IN (
--   SELECT m.notion_page_id FROM milestones m
--   WHERE m.milestone = 'inception note'
--     AND m.project_ids && (SELECT array_agg(notion_page_id) FROM projects WHERE project = 'amna at 10'));
-- DELETE FROM projects WHERE project = 'amna at 10';
