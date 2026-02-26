-- Migration 022: complimentary invites — email-based entitlement grants
--
-- Allows admins to grant free access to specific email addresses.
-- When the recipient signs up/in with that email, they get auto-entitled.

CREATE TABLE IF NOT EXISTS invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL,
  tier         TEXT NOT NULL DEFAULT 'explorer'
               CHECK (tier IN ('explorer', 'practitioner')),
  note         TEXT,                             -- optional admin note
  invited_by   UUID NOT NULL REFERENCES users(id),
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at  TIMESTAMPTZ,                      -- set when user signs in
  accepted_by  UUID REFERENCES users(id),        -- user who claimed it
  expires_at   TIMESTAMPTZ,                      -- optional expiry
  revoked_at   TIMESTAMPTZ,                      -- soft-delete
  UNIQUE(email, tier)
);

CREATE INDEX IF NOT EXISTS idx_invites_email ON invites (lower(email))
  WHERE revoked_at IS NULL;

COMMENT ON TABLE invites IS
  'Admin-created complimentary access grants by email address';
