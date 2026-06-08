-- Bibliography structured fields — authors, first_author, journal
--
-- The search layer (lib/bibliography/scholar) already returns structured
-- `authors[]` and `venue` on every ScholarHit, but the insert path only kept
-- the formatted `full_citation` blob. Without discrete columns the table can't
-- sort by author or filter by journal. This adds them.
--
--   authors       — full ordered author list, "Family, I. N." formatted
--   first_author  — denormalised leading author, for fast A–Z sort + index
--   journal       — publication venue / journal title, for the journal facet

ALTER TABLE bibliography ADD COLUMN IF NOT EXISTS authors      text[];
ALTER TABLE bibliography ADD COLUMN IF NOT EXISTS first_author text;
ALTER TABLE bibliography ADD COLUMN IF NOT EXISTS journal      text;

-- btree index on first_author for the A–Z sort (case-insensitive)
CREATE INDEX IF NOT EXISTS bibliography_first_author_idx
  ON bibliography (lower(first_author));

-- btree index on journal for the journal facet
CREATE INDEX IF NOT EXISTS bibliography_journal_idx
  ON bibliography (lower(journal));

COMMENT ON COLUMN bibliography.authors IS
  'Ordered author list captured from the search hit (ScholarHit.authors). Null for legacy rows without a clean parse.';
COMMENT ON COLUMN bibliography.first_author IS
  'Leading author surname-first, denormalised for A–Z sort. Backfilled from Crossref (DOI rows) or parsed from full_citation.';
COMMENT ON COLUMN bibliography.journal IS
  'Publication venue / journal title (ScholarHit.venue). Powers the journal multi-select facet.';
