-- Track which products / reports / artifacts each citation is used in (a
-- multi-select). Documents provenance + lets us learn how we've cited before.
-- The migrated human-curated corpus was gathered for the certificate series
-- subject-matter expertise, so seed those entries with that asset; cARL's
-- curriculum-study findings are left untagged (not yet used in an artifact).

ALTER TABLE bibliography ADD COLUMN IF NOT EXISTS used_in text[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS bibliography_used_in_idx ON bibliography USING gin (used_in);

UPDATE bibliography
  SET used_in = ARRAY['certificate series']
  WHERE (source_type IS DISTINCT FROM 'cARL finding')
    AND (used_in IS NULL OR used_in = '{}');
