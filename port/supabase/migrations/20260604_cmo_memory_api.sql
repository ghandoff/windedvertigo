-- cmo decisions: append-only log of every Mo conversation
CREATE TABLE IF NOT EXISTS cmo_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL,
  session_type text DEFAULT 'cowork',
  summary text NOT NULL,
  decisions jsonb DEFAULT '[]',
  tags text[] DEFAULT '{}',
  raw_context text
);

CREATE INDEX cmo_decisions_who_idx ON cmo_decisions (who);
CREATE INDEX cmo_decisions_created_idx ON cmo_decisions (created_at DESC);
CREATE INDEX cmo_decisions_tags_idx ON cmo_decisions USING gin (tags);

-- cmo memory: key-value working state
CREATE TABLE IF NOT EXISTS cmo_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL
);

-- seed initial working state
INSERT INTO cmo_memory (key, value, updated_by) VALUES
  ('pipeline-total',       '$457,500 of $500,000 target (91.5% coverage)',                                                                                              'garrett'),
  ('pipeline-gap',         '$42,500 to source',                                                                                                                          'garrett'),
  ('wtg-status',           'identified as major pursuit. not yet submitted. mo flagged as top priority june 4.',                                                          'garrett'),
  ('ppcs-report-status',   'in progress. 10-page report + interactive experience. jamie''s narrative arc framework. due before prme global forum late june.',            'garrett'),
  ('harbour-status',       'launched may 28. post-launch polish in progress. QA framework being formalised by maria.',                                                   'garrett'),
  ('payton-focus',         'harbour campaign, social media strategy, linkedin content',                                                                                   'garrett'),
  ('maria-focus',          'harbour QA process, PPCS report interactive experience, threshold concepts facilitation',                                                    'garrett'),
  ('jamie-focus',          'ppcs narrative arc, substack writing, research',                                                                                              'garrett'),
  ('lamis-focus',          'storytelling, comms, content support',                                                                                                       'garrett'),
  ('proposals-active',     'DW akademie (submitted, awaiting), ICSP concern (submitted, awaiting), ubongo (submitted, awaiting), amna (scoping)',                       'garrett'),
  ('next-major-action',    'submit william t. grant foundation proposal',                                                                                                 'garrett')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;
