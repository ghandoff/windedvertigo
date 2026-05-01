-- Migration 024: community gallery for opt-in evidence sharing
--
-- Adds columns to run_evidence table to allow users to opt-in to sharing
-- evidence in a public community gallery with admin moderation.

BEGIN;

-- Add gallery sharing columns to run_evidence
ALTER TABLE run_evidence
  ADD COLUMN IF NOT EXISTS shared_to_gallery BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gallery_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gallery_shared_at TIMESTAMPTZ;

-- Index for efficient gallery queries
CREATE INDEX IF NOT EXISTS idx_run_evidence_gallery
  ON run_evidence(shared_to_gallery, gallery_approved)
  WHERE shared_to_gallery = TRUE AND gallery_approved = TRUE;

-- Index for admin moderation (pending items)
CREATE INDEX IF NOT EXISTS idx_run_evidence_gallery_pending
  ON run_evidence(shared_to_gallery, gallery_approved)
  WHERE shared_to_gallery = TRUE AND gallery_approved = FALSE;

COMMIT;
