-- 016_evidence_shares.sql
-- Shareable links for evidence portfolios.
-- Phase D — evidence export (practitioner tier).
--
-- A share is a time-limited public token that grants read-only access
-- to a filtered subset of a user's evidence. Default expiry: 7 days.

CREATE TABLE IF NOT EXISTS evidence_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  filters JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_shares_token
  ON evidence_shares(token);

CREATE INDEX IF NOT EXISTS idx_evidence_shares_user
  ON evidence_shares(user_id);
