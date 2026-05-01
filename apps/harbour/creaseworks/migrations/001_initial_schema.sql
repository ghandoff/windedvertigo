-- creaseworks initial schema
-- version: 001
-- date: 2026-02-16
-- description: full schema for content cache + application data

-- =============================================================================
-- CONTENT CACHE TABLES (populated by Notion sync cron)
-- =============================================================================

CREATE TABLE IF NOT EXISTS patterns_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  headline        TEXT,
  release_channel TEXT NOT NULL,
  ip_tier         TEXT NOT NULL,
  status          TEXT NOT NULL,
  primary_function TEXT,
  arc_emphasis    JSONB DEFAULT '[]',
  context_tags    JSONB DEFAULT '[]',
  friction_dial   SMALLINT,
  start_in_120s   BOOLEAN DEFAULT FALSE,
  required_forms  JSONB DEFAULT '[]',
  slots_optional  JSONB DEFAULT '[]',
  slots_notes     TEXT,
  rails_sentence  TEXT,
  find            TEXT,
  fold            TEXT,
  unfold          TEXT,
  find_again_mode TEXT,
  find_again_prompt TEXT,
  substitutions_notes TEXT,
  notion_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  slug            TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS materials_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  form_primary    TEXT,
  functions       JSONB DEFAULT '[]',
  connector_modes JSONB DEFAULT '[]',
  context_tags    JSONB DEFAULT '[]',
  do_not_use      BOOLEAN DEFAULT FALSE,
  do_not_use_reason TEXT,
  shareability    TEXT,
  min_qty_size    TEXT,
  examples_notes  TEXT,
  generation_notes TEXT,
  generation_prompts JSONB DEFAULT '[]',
  source          TEXT,
  notion_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pattern_materials (
  pattern_id UUID REFERENCES patterns_cache(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials_cache(id) ON DELETE CASCADE,
  PRIMARY KEY (pattern_id, material_id)
);

CREATE TABLE IF NOT EXISTS packs_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL,
  notion_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  slug            TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS pack_patterns (
  pack_id    UUID REFERENCES packs_cache(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES patterns_cache(id) ON DELETE CASCADE,
  PRIMARY KEY (pack_id, pattern_id)
);

CREATE TABLE IF NOT EXISTS runs_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  pattern_notion_id TEXT,
  run_type        TEXT,
  run_date        DATE,
  context_tags    JSONB DEFAULT '[]',
  trace_evidence  JSONB DEFAULT '[]',
  what_changed    TEXT,
  next_iteration  TEXT,
  notion_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS run_materials (
  run_id      UUID REFERENCES runs_cache(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials_cache(id) ON DELETE CASCADE,
  PRIMARY KEY (run_id, material_id)
);

-- =============================================================================
-- APPLICATION DATA TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  email_verified  BOOLEAN DEFAULT FALSE,
  name            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verified_domains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  domain          TEXT UNIQUE NOT NULL,
  verified        BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  verification_email TEXT,
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS domain_blocklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          TEXT UNIQUE NOT NULL,
  enabled         BOOLEAN DEFAULT TRUE,
  reason          TEXT,
  added_by        UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_allowlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS org_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role            TEXT DEFAULT 'member',
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

CREATE TABLE IF NOT EXISTS packs_catalogue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_cache_id   UUID UNIQUE NOT NULL REFERENCES packs_cache(id),
  price_cents     INTEGER,
  currency        TEXT DEFAULT 'USD',
  visible         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id),
  pack_catalogue_id UUID NOT NULL REFERENCES packs_catalogue(id),
  purchaser_id    UUID NOT NULL REFERENCES users(id),
  amount_cents    INTEGER,
  currency        TEXT DEFAULT 'USD',
  payment_provider TEXT DEFAULT 'stub',
  payment_ref     TEXT,
  status          TEXT DEFAULT 'completed',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entitlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id),
  pack_cache_id   UUID NOT NULL REFERENCES packs_cache(id),
  purchase_id     UUID REFERENCES purchases(id),
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  UNIQUE (org_id, pack_cache_id)
);

CREATE TABLE IF NOT EXISTS access_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  org_id          UUID REFERENCES organisations(id),
  pattern_id      UUID REFERENCES patterns_cache(id),
  pack_id         UUID REFERENCES packs_cache(id),
  action          TEXT NOT NULL,
  ip_address      INET,
  fields_accessed TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_patterns_release ON patterns_cache(release_channel);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON patterns_cache(status);
CREATE INDEX IF NOT EXISTS idx_patterns_slug ON patterns_cache(slug);
CREATE INDEX IF NOT EXISTS idx_materials_form ON materials_cache(form_primary);
CREATE INDEX IF NOT EXISTS idx_materials_do_not_use ON materials_cache(do_not_use);
CREATE INDEX IF NOT EXISTS idx_entitlements_org ON entitlements(org_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_pack ON entitlements(pack_cache_id);
CREATE INDEX IF NOT EXISTS idx_verified_domains_domain ON verified_domains(domain);
CREATE INDEX IF NOT EXISTS idx_blocklist_domain ON domain_blocklist(domain);
CREATE INDEX IF NOT EXISTS idx_audit_user ON access_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON access_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON org_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_packs_slug ON packs_cache(slug);
