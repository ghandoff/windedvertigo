-- Migration 029: Photo consent tracking (COPPA 2025 three-tier)
--
-- Tier model:
--   artifact   — photos of objects/creations, auto-approved
--   activity   — photos of activity (hands, process), opt-in marketing
--   face       — photos showing identifiable faces, requires signed waiver
--
-- Marketing approval is separate from consent_tier — an activity-tier
-- photo is consented for platform use but marketing_approved controls
-- whether it can appear in public gallery / social.
--
-- Revocation: setting revoked_at soft-deletes the consent. The photo
-- remains in run_evidence but is excluded from any marketing queries.

CREATE TABLE photo_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_evidence_id UUID NOT NULL REFERENCES run_evidence(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  consent_tier TEXT NOT NULL,  -- artifact | activity | face
  marketing_approved BOOLEAN DEFAULT false,
  parent_name TEXT,
  child_age_range TEXT,
  waiver_signed_at TIMESTAMPTZ,
  waiver_ip TEXT,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_photo_consents_evidence ON photo_consents(run_evidence_id);
CREATE INDEX idx_photo_consents_user ON photo_consents(user_id);
CREATE INDEX idx_photo_consents_marketing ON photo_consents(marketing_approved)
  WHERE marketing_approved = true AND revoked_at IS NULL;
