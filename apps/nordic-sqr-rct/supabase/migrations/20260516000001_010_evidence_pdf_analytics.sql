-- 010_evidence_pdf_analytics.sql
-- 2026-05-16 — Cost-savings analytics for the Literature Retrieval Tool.
-- Tracks which waterfall tier retrieved each PDF so we can surface a
-- running "$X saved vs. publisher prices" figure on the Evidence Repository.

BEGIN;

ALTER TABLE pcs_evidence
  ADD COLUMN IF NOT EXISTS pdf_source              TEXT,
  ADD COLUMN IF NOT EXISTS pdf_retrieved_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_platform_retrieved  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS publisher_cost_usd      NUMERIC(6,2) NOT NULL DEFAULT 35.00;

COMMENT ON COLUMN pcs_evidence.pdf_source IS
  'Waterfall tier that found the PDF: unpaywall | semantic_scholar | openalex | europe_pmc | biorxiv_medrxiv | zenodo | orcid | pmc | discovery | manual';
COMMENT ON COLUMN pcs_evidence.pdf_platform_retrieved IS
  'TRUE when the PDF URL was auto-retrieved by the waterfall. Used for cost-savings analytics.';
COMMENT ON COLUMN pcs_evidence.publisher_cost_usd IS
  'Estimated purchase price from publisher. Default $35 (industry average closed-access). 0.00 for known open-access publishers.';

CREATE INDEX IF NOT EXISTS pcs_evidence_pdf_retrieved_idx
  ON pcs_evidence (pdf_platform_retrieved)
  WHERE pdf_platform_retrieved = TRUE;

COMMIT;
