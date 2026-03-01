-- Migration 038: user-level entitlements, invite-pack associations, org member cap
--
-- Extends the entitlements system to support per-user access alongside
-- the existing per-org model. Individual invites grant user-level
-- entitlements for specific packs chosen by the admin.
--
-- Also adds a member_cap column to organisations so domain auto-join
-- can be capped, preventing large email domains (school districts, etc.)
-- from granting unbounded access.

-- 1. Allow user-level entitlements (nullable user_id alongside org_id)
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
ALTER TABLE entitlements ALTER COLUMN org_id DROP NOT NULL;

-- Replace the single unique constraint with partial indexes so
-- org-level and user-level entitlements have separate uniqueness domains.
-- Only consider active (non-revoked) rows to allow re-grants.
ALTER TABLE entitlements DROP CONSTRAINT IF EXISTS entitlements_org_id_pack_cache_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_org_pack
  ON entitlements (org_id, pack_cache_id) WHERE user_id IS NULL AND revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_user_pack
  ON entitlements (user_id, pack_cache_id) WHERE org_id IS NULL AND revoked_at IS NULL;

-- Ensure at least one scope is set — every entitlement must belong to
-- either an org or a user (or both, if we ever need that).
ALTER TABLE entitlements ADD CONSTRAINT chk_entitlements_scope
  CHECK (org_id IS NOT NULL OR user_id IS NOT NULL);

-- 2. Link invites to specific packs — admins choose which packs to grant
CREATE TABLE IF NOT EXISTS invite_packs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id     UUID NOT NULL REFERENCES invites(id) ON DELETE CASCADE,
  pack_cache_id TEXT NOT NULL,
  UNIQUE(invite_id, pack_cache_id)
);

COMMENT ON TABLE invite_packs IS
  'Associates invites with specific packs — each invite grants user-level entitlements for these packs on sign-in';

-- 3. Org member cap for domain auto-join safety
-- NULL = unlimited (backwards compatible). Set a number to cap how many
-- users can auto-join via domain verification.
ALTER TABLE organisations ADD COLUMN IF NOT EXISTS member_cap INTEGER;

COMMENT ON COLUMN organisations.member_cap IS
  'Max users who can auto-join via domain verification. NULL = unlimited.';
