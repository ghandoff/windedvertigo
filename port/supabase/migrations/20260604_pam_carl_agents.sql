-- PaM: project + momentum manager

CREATE TABLE IF NOT EXISTS pam_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL,
  session_type text DEFAULT 'cowork',
  summary text NOT NULL,
  decisions jsonb DEFAULT '[]',
  tags text[] DEFAULT '{}',
  raw_context text
);
CREATE INDEX pam_decisions_who_idx ON pam_decisions (who);
CREATE INDEX pam_decisions_created_idx ON pam_decisions (created_at DESC);
CREATE INDEX pam_decisions_tags_idx ON pam_decisions USING gin (tags);

CREATE TABLE IF NOT EXISTS pam_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS pam_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL,
  what text NOT NULL,
  due_date date,
  source text,
  depends_on uuid[],
  status text DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'blocked', 'done', 'parked')),
  blocker text,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pam_commitments_who_idx ON pam_commitments (who);
CREATE INDEX pam_commitments_status_idx ON pam_commitments (status);
CREATE INDEX pam_commitments_due_idx ON pam_commitments (due_date);

-- cARL: cyber agent of research + learning

CREATE TABLE IF NOT EXISTS carl_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL,
  session_type text DEFAULT 'cowork',
  summary text NOT NULL,
  decisions jsonb DEFAULT '[]',
  tags text[] DEFAULT '{}',
  raw_context text
);
CREATE INDEX carl_decisions_who_idx ON carl_decisions (who);
CREATE INDEX carl_decisions_created_idx ON carl_decisions (created_at DESC);
CREATE INDEX carl_decisions_tags_idx ON carl_decisions USING gin (tags);

CREATE TABLE IF NOT EXISTS carl_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL
);

CREATE TABLE IF NOT EXISTS carl_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  domain text NOT NULL,
  title text NOT NULL,
  source text,
  citation text,
  summary text NOT NULL,
  relevance text,
  tags text[] DEFAULT '{}',
  connected_to text[]
);
CREATE INDEX carl_findings_domain_idx ON carl_findings (domain);
CREATE INDEX carl_findings_tags_idx ON carl_findings USING gin (tags);
CREATE INDEX carl_findings_created_idx ON carl_findings (created_at DESC);

-- seed PaM memory
INSERT INTO pam_memory (key, value, updated_by) VALUES
  ('garrett-commitments', 'WTG proposal draft, PPCS report architecture, strategy dashboard wiring', 'garrett'),
  ('maria-commitments',   'harbour QA framework, PPCS interactive experience, threshold concepts facilitation', 'garrett'),
  ('payton-commitments',  'harbour social campaign, linkedin content series', 'garrett'),
  ('jamie-commitments',   'PPCS narrative arc review, substack posts', 'garrett'),
  ('lamis-commitments',   'storytelling/comms for PPCS report', 'garrett'),
  ('overdue-items',       'WTG proposal (identified as priority june 4, not started)', 'garrett'),
  ('next-whirlpool',      'wednesday june 4 — threshold concepts, upaya, harbour co-design, PPCS report', 'garrett')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;

-- seed cARL memory
INSERT INTO carl_memory (key, value, updated_by) VALUES
  ('active-research-domains', 'threshold concepts, play-based pedagogy, AI in education, embodied cognition, UDL', 'garrett'),
  ('current-harbour-focus',   'rhythm.lab (music threshold), bias.lens (psychology), creaseworks (creative writing)', 'garrett'),
  ('key-frameworks',          'meyer & land threshold concepts, kolb experiential learning, freire critical pedagogy, mcluhan medium-is-message', 'garrett'),
  ('recent-reading',          'upaya (skillful means) — buddhist pedagogy principle applied to toy-threshold sequencing', 'garrett')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;
