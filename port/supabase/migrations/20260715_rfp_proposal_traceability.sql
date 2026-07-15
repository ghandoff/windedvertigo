-- BIZ-C1/C2: per-generation citation trace + a deterministic traceability
-- score, persisted so biz_qc_review can surface "how well-supported is
-- this draft" without re-reading the live Notion doc (getQcInputs reads
-- structured Supabase data, not Notion content).
--
-- Apply via the Supabase SQL editor (wv-port-pilot project).
-- Preview with the DRY-RUN SELECT at the bottom before committing.

BEGIN;

CREATE TABLE IF NOT EXISTS rfp_proposal_traceability (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id          text NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now(),
  citation_trace  jsonb NOT NULL DEFAULT '[]'::jsonb,
  score           int,             -- null = no citations were available to trace (not applicable)
  score_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  citation_count  int NOT NULL DEFAULT 0
);

-- one row per rfp_id kept current (latest generation) — regenerations upsert,
-- history isn't needed here the way it is for the strategy brief.
CREATE UNIQUE INDEX IF NOT EXISTS rfp_proposal_traceability_rfp_idx
  ON rfp_proposal_traceability (rfp_id);

ALTER TABLE public.rfp_proposal_traceability ENABLE ROW LEVEL SECURITY;

COMMIT;

-- ── DRY-RUN SELECT (run before COMMIT to preview) ────────────────────────────
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'rfp_proposal_traceability' ORDER BY ordinal_position;

-- ── ROLLBACK (run only to undo) ───────────────────────────────────────────────
-- DROP TABLE IF EXISTS rfp_proposal_traceability;
