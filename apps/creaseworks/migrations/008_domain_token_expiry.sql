-- Migration 008: add expiry to domain verification tokens.
--
-- Session 12 audit fix: verification tokens had no TTL, meaning a
-- leaked token could be used to verify a domain at any point in the
-- future. This adds a token_expires_at column and defaults it to
-- 24 hours from creation.

ALTER TABLE verified_domains
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

-- Backfill: expire any existing unverified tokens immediately so
-- they must be re-requested. Verified domains are unaffected.
UPDATE verified_domains
  SET token_expires_at = NOW()
  WHERE verified = FALSE AND token_expires_at IS NULL;
