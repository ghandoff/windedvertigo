-- migration 004: accounts table for OAuth provider linking
-- supports Google Workspace SSO (and future OAuth providers)

CREATE TABLE IF NOT EXISTS accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider              TEXT NOT NULL,            -- e.g. 'google'
  provider_account_id   TEXT NOT NULL,            -- provider's user ID
  type                  TEXT NOT NULL,            -- 'oauth' | 'oidc' | 'email'
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (provider, provider_account_id)
);

CREATE INDEX idx_accounts_user ON accounts(user_id);
