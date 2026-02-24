-- Migration 015: run_evidence table for practitioner-tier evidence capture
--
-- Adds a table to store structured evidence items (photos, quotes,
-- observations, artifacts) attached to runs. The existing trace_evidence
-- JSONB array on runs_cache stays as the "quick log" layer; this table
-- holds the richer, practitioner-tier evidence.

BEGIN;

CREATE TABLE IF NOT EXISTS run_evidence (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          UUID NOT NULL REFERENCES runs_cache(id) ON DELETE CASCADE,
  evidence_type   TEXT NOT NULL CHECK (evidence_type IN ('photo', 'quote', 'observation', 'artifact')),

  -- photo fields
  storage_key     TEXT,           -- R2 object key (org_id/run_id/evidence_id.ext)
  thumbnail_key   TEXT,           -- smaller version for gallery views

  -- quote fields
  quote_text      TEXT,
  quote_attribution TEXT,         -- e.g. "Mia, age 6"

  -- observation / artifact fields
  body            TEXT,           -- free-text content

  -- prompt that generated this (for guided reflections)
  prompt_key      TEXT,           -- e.g. "what_surprised", "arc:spatial_reasoning"

  sort_order      SMALLINT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_run_evidence_run ON run_evidence(run_id);
CREATE INDEX IF NOT EXISTS idx_run_evidence_type ON run_evidence(evidence_type);

COMMIT;
