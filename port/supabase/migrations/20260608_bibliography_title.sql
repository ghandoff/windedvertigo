-- Bibliography: store the real article title
--
-- The table previously derived the title by string-splitting the full citation,
-- which mangled non-standard citations (DOIs and journal names showed up as
-- "titles"). Every ScholarHit and Crossref record already carries a clean
-- `title` — this column persists it so the title column + title sort are exact.
-- Legacy rows without a captured/backfilled title fall back to the parse.

ALTER TABLE bibliography ADD COLUMN IF NOT EXISTS title text;

COMMENT ON COLUMN bibliography.title IS
  'Clean article title from the search hit / Crossref. Null for legacy rows (UI falls back to parsing the citation).';
