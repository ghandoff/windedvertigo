CREATE TABLE IF NOT EXISTS hints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id UUID NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL, -- 'familysearch', 'wikidata'
  external_id TEXT NOT NULL, -- FamilySearch PID or Wikidata QID
  match_data JSONB NOT NULL, -- the raw match data from the external system
  confidence SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  evidence JSONB, -- structured evidence supporting the match
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (person_id, source_system, external_id)
);

CREATE INDEX IF NOT EXISTS idx_hints_person ON hints(person_id, status);
CREATE INDEX IF NOT EXISTS idx_hints_tree ON hints(tree_id, status, confidence DESC);
