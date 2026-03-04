-- deep.deck initial schema
-- Run against Neon Postgres via console or migration runner.

-- Users table (Auth.js adapter)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  name          TEXT,
  image         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- OAuth accounts (Google, etc.)
CREATE TABLE IF NOT EXISTS accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  type                TEXT NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_account_id)
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- Email verification tokens (Auth.js magic link)
CREATE TABLE IF NOT EXISTS verification_token (
  identifier TEXT NOT NULL,
  token      TEXT NOT NULL UNIQUE,
  expires    TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_token_identifier
  ON verification_token(identifier);

-- Purchases (Stripe payment records)
CREATE TABLE IF NOT EXISTS purchases (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES users(id),
  pack                     TEXT NOT NULL DEFAULT 'full',
  amount_cents             INTEGER NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'USD',
  stripe_session_id        TEXT,
  stripe_payment_intent_id TEXT,
  status                   TEXT NOT NULL DEFAULT 'completed',
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_purchases_stripe_session
  ON purchases(stripe_session_id);

-- Entitlements (what packs each user can access)
CREATE TABLE IF NOT EXISTS entitlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack        TEXT NOT NULL DEFAULT 'full',
  purchase_id UUID REFERENCES purchases(id),
  granted_at  TIMESTAMPTZ DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,
  UNIQUE (user_id, pack)
);

CREATE INDEX IF NOT EXISTS idx_entitlements_user_pack
  ON entitlements(user_id, pack) WHERE revoked_at IS NULL;
