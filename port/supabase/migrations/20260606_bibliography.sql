-- Annotated Bibliography → Supabase.
-- Migrates the canonical citation store out of Notion into the existing
-- wv-port-pilot project (a new table — no new project, no added plan cost).
-- citation_key is a normalised dedupe key; created/cron-logged citations and the
-- one-time Notion backfill all insert here with ON CONFLICT (citation_key) skip.

CREATE TABLE IF NOT EXISTS bibliography (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_citation text NOT NULL,
  citation_key text UNIQUE NOT NULL,   -- lower(collapsed whitespace) of full_citation
  abstract text,
  keywords text,
  notes text,
  topic text,
  source_type text,
  year int,
  doi text,
  publisher_link text,
  scholar_link text,
  citation_count int,
  notion_page_id text,                 -- provenance from the one-time backfill
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bibliography_topic_idx ON bibliography (topic);
CREATE INDEX bibliography_year_idx ON bibliography (year DESC);
