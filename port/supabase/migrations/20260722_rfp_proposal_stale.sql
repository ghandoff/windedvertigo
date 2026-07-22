-- Replace-and-refresh: flag a proposal draft as stale when the TOR it was built
-- from is replaced, so the UI can prompt a regenerate instead of showing a draft
-- that predates the current document. Cleared when a new draft is (re)generated.
-- Additive + non-destructive.

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS proposal_stale boolean NOT NULL DEFAULT false;
