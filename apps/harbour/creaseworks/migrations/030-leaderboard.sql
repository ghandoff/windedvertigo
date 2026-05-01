-- Migration 030: Community leaderboard + partner API keys
--
-- Leaderboard feature:
--   - Users can opt in to appear on the community leaderboard
--   - Custom display names to preserve some privacy
--   - Ranked by total credits earned (earned - spent)
--
-- Partner API keys:
--   - Organizations can generate API keys for external integrations
--   - Keys are hashed for security; prefixes used for identification
--   - Supports granular scopes (read:progress, read:gallery)
--   - Can be revoked and have expiration dates

-- ===== LEADERBOARD =====

ALTER TABLE users ADD COLUMN leaderboard_opted_in BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN leaderboard_display_name TEXT;

CREATE INDEX idx_leaderboard_opted_in ON users(leaderboard_opted_in) WHERE leaderboard_opted_in = TRUE;

-- ===== PARTNER API KEYS =====

CREATE TABLE partner_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  key_hash TEXT NOT NULL,      -- SHA-256 hash of the API key
  key_prefix TEXT NOT NULL,    -- first 8 chars for identification (e.g. "cw_pk_ab")
  label TEXT NOT NULL,         -- user-provided label
  scopes TEXT[] DEFAULT '{"read:progress","read:gallery"}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_partner_keys_hash ON partner_api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_partner_keys_org ON partner_api_keys(org_id);
CREATE INDEX idx_partner_keys_prefix ON partner_api_keys(key_prefix) WHERE revoked_at IS NULL;
