-- cARL domains vocabulary — controlled taxonomy migration
-- 2026-06-23
--
-- APPLY VIA: Supabase SQL editor (NOT wrangler / NOT auto-applied).
-- SEQUENCE:
--   1. Run the whole file once to create structures + backups.
--   2. Run the dry-run SELECT (step 4) and review the output.
--   3. Uncomment the UPDATE block (step 5) and run it.
--   4. Verify with the post-merge SELECT at the bottom.
-- ROLLBACK: see bottom of file.

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: back up affected tables before any writes
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carl_findings_backup_20260623   AS SELECT * FROM carl_findings;
CREATE TABLE IF NOT EXISTS carl_curriculum_backup_20260623 AS SELECT * FROM carl_curriculum;
CREATE TABLE IF NOT EXISTS bibliography_backup_20260623    AS SELECT * FROM bibliography;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: create controlled domain vocabulary table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS carl_domains (
  id           uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text    UNIQUE NOT NULL,
  label        text    UNIQUE NOT NULL,
  section      text    NOT NULL CHECK (section IN (
                 'learning & pedagogy',
                 'marketing & growth',
                 'delivery & ops',
                 'mission research'
               )),
  -- agent_owner: who primarily benefits from / stewards this domain.
  -- can be an agent slug ('mo','pam','biz','carl') or a person slug
  -- ('jamie','payton','garrett','lamis') — or 'shared' for cross-team domains.
  agent_owner  text    NOT NULL DEFAULT 'carl',
  sort_order   int     NOT NULL DEFAULT 0,
  -- depth_target: aim for this many findings per domain before considering it
  -- well-covered. cARL uses this to prioritise the daily research queue.
  depth_target int     NOT NULL DEFAULT 10,
  created_at   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO carl_domains (slug, label, section, agent_owner, sort_order, depth_target) VALUES
  -- learning & pedagogy — cARL's own research canon
  ('threshold-concepts',        'threshold concepts',                  'learning & pedagogy', 'carl',    10, 12),
  ('play-based-pedagogy',       'play-based & experiential pedagogy',  'learning & pedagogy', 'carl',    20, 12),
  ('learning-design-udl',       'learning design & UDL',               'learning & pedagogy', 'carl',    30, 12),
  ('ai-in-education',           'ai in education',                     'learning & pedagogy', 'carl',    40, 10),
  ('cognitive-psychology',      'cognitive psychology',                 'learning & pedagogy', 'carl',    50, 10),
  ('critical-cultural-pedagogy','critical & cultural pedagogy',        'learning & pedagogy', 'jamie',   60, 10),
  ('motivation-remote-teams',   'motivation & remote teams',           'learning & pedagogy', 'garrett', 70, 10),
  -- marketing & growth — Mo's territory
  ('mo-strategy',               'mo · strategy',                       'marketing & growth',  'mo',      10, 12),
  ('mo-audience',               'mo · audience & behaviour',           'marketing & growth',  'mo',      20, 12),
  ('mo-digital-growth',         'mo · digital & growth',               'marketing & growth',  'mo',      30, 10),
  ('mo-communications',         'mo · communications',                 'marketing & growth',  'mo',      40, 10),
  -- delivery & ops — PaM's territory
  ('pam-project-management',    'pam · project management',            'delivery & ops',      'pam',     10, 10),
  ('pam-team-momentum',         'pam · team momentum',                 'delivery & ops',      'pam',     20, 10),
  -- mission research — shared / cARL + jamie
  ('mhpss-mission',             'mhpss & mission',                     'mission research',    'jamie',   10, 12)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3: schema additions to existing tables
-- ─────────────────────────────────────────────────────────────────────────────

-- carl_findings: add subtopic for fine-grain context within a canonical domain
ALTER TABLE carl_findings ADD COLUMN IF NOT EXISTS subtopic text;

-- carl_curriculum: track who requested a topic (agent slug or person slug)
ALTER TABLE carl_curriculum ADD COLUMN IF NOT EXISTS requested_by text;

-- bibliography: link a source row to the cARL finding it grounded
ALTER TABLE bibliography ADD COLUMN IF NOT EXISTS carl_finding_id uuid
  REFERENCES carl_findings(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bibliography_carl_finding_id_idx
  ON bibliography(carl_finding_id);

-- carl_domains: add depth_target if it was missed above (idempotent)
ALTER TABLE carl_domains ADD COLUMN IF NOT EXISTS depth_target int NOT NULL DEFAULT 10;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 4: DRY-RUN — review current domain distribution BEFORE merging
-- Run this SELECT first; check the output, then proceed to step 5.
-- ─────────────────────────────────────────────────────────────────────────────
SELECT domain, COUNT(*) AS n
FROM carl_findings
GROUP BY domain
ORDER BY n DESC, domain;

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 5: merge duplicate domains
-- Review step 4 output first. Then uncomment and run the UPDATEs below.
-- Each UPDATE is safe to re-run (idempotent after the first run).
-- ─────────────────────────────────────────────────────────────────────────────

-- -- ai in education variants → canonical
-- UPDATE carl_findings SET domain = 'ai in education'
--   WHERE domain = 'AI in education';
-- UPDATE carl_findings SET domain = 'ai in education', subtopic = 'embodied cognition'
--   WHERE domain = 'ai in education / embodied cognition';

-- -- play-based variants → canonical
-- UPDATE carl_findings SET domain = 'play-based & experiential pedagogy'
--   WHERE domain IN ('play-based learning', 'play-based pedagogy');

-- -- learning design variants → canonical
-- UPDATE carl_findings SET domain = 'learning design & UDL'
--   WHERE domain IN ('learning design', 'UDL', 'universal design');
-- UPDATE carl_findings SET domain = 'learning design & UDL', subtopic = 'memory'
--   WHERE domain = 'learning design & memory';

-- -- cognitive psychology variants → canonical
-- UPDATE carl_findings SET domain = 'cognitive psychology', subtopic = 'threshold concepts'
--   WHERE domain = 'cognitive psychology / threshold concepts';

-- -- marketing curriculum seeds → canonical mo · * domains
-- UPDATE carl_curriculum SET domain = 'mo · strategy'
--   WHERE domain IN ('marketing strategy','brand & positioning','pricing');
-- UPDATE carl_curriculum SET domain = 'mo · audience & behaviour'
--   WHERE domain IN ('consumer behaviour','marketing research & analytics');
-- UPDATE carl_curriculum SET domain = 'mo · digital & growth'
--   WHERE domain = 'digital & growth marketing';
-- UPDATE carl_curriculum SET domain = 'mo · communications'
--   WHERE domain IN ('communications & storytelling','b2b, nonprofit & cause marketing');

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 6: verify post-merge (run after step 5)
-- ─────────────────────────────────────────────────────────────────────────────
-- SELECT domain, COUNT(*) AS n FROM carl_findings GROUP BY domain ORDER BY n DESC;
-- SELECT COUNT(*) AS total, COUNT(subtopic) AS with_subtopic FROM carl_findings;
-- SELECT COUNT(*) AS canonical_domains FROM carl_domains;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (only if something went wrong — restores from backup tables)
-- ─────────────────────────────────────────────────────────────────────────────
-- INSERT INTO carl_findings SELECT * FROM carl_findings_backup_20260623
--   ON CONFLICT (id) DO UPDATE SET domain = EXCLUDED.domain, subtopic = NULL;
-- INSERT INTO carl_curriculum SELECT * FROM carl_curriculum_backup_20260623
--   ON CONFLICT (id) DO UPDATE SET domain = EXCLUDED.domain, requested_by = NULL;
-- ALTER TABLE bibliography DROP COLUMN IF EXISTS carl_finding_id;
-- DROP TABLE IF EXISTS carl_domains;
-- ALTER TABLE carl_findings DROP COLUMN IF EXISTS subtopic;
-- ALTER TABLE carl_curriculum DROP COLUMN IF EXISTS requested_by;
