-- Migration 011: pcs_prefixes, pcs_ingredient_forms, pcs_claim_dose_reqs, pcs_import_jobs
-- Part of the Supabase-only migration (Part 10). These four tables are actively used
-- in production but had no Postgres mirror — all reads/writes went directly to Notion.

-- ── pcs_prefixes ──────────────────────────────────────────────────────────────
-- Claim prefix lookup (e.g. "Supports", "Helps build", "Is required for").
-- Used by backfill-review dropdown and inline prefix selector.
CREATE TABLE IF NOT EXISTS pcs_prefixes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        TEXT UNIQUE,
  prefix                TEXT NOT NULL,
  regulatory_tier       TEXT,
  display_order         INTEGER,
  evidence_type         TEXT,
  qualification_level   TEXT,
  dose_sensitivity      TEXT,
  notes                 TEXT,
  notion_created_at     TIMESTAMPTZ,
  notion_last_edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pcs_prefixes_notion_page_id ON pcs_prefixes(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_pcs_prefixes_display_order  ON pcs_prefixes(display_order ASC NULLS LAST);

-- ── pcs_ingredient_forms ──────────────────────────────────────────────────────
-- Ingredient form variants (e.g. "Cholecalciferol" for Vitamin D3).
-- Linked to a canonical pcs_ingredients row via active_ingredient_id.
CREATE TABLE IF NOT EXISTS pcs_ingredient_forms (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id          TEXT UNIQUE,
  form_name               TEXT,
  active_ingredient_id    TEXT,   -- notion_page_id of parent pcs_ingredients row
  bioavailability_notes   TEXT,
  notes                   TEXT,
  notion_created_at       TIMESTAMPTZ,
  notion_last_edited_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pcs_ingredient_forms_notion ON pcs_ingredient_forms(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_pcs_ingredient_forms_ai    ON pcs_ingredient_forms(active_ingredient_id);

-- ── pcs_claim_dose_reqs ───────────────────────────────────────────────────────
-- Dose requirement records linked to PCS claims.
-- Captures min/max dose thresholds that substantiate a claim.
CREATE TABLE IF NOT EXISTS pcs_claim_dose_reqs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        TEXT UNIQUE,
  claim_id              TEXT,    -- notion_page_id of parent pcs_claims row
  dose_min_mg           NUMERIC,
  dose_max_mg           NUMERIC,
  dose_unit             TEXT,
  notes                 TEXT,
  notion_created_at     TIMESTAMPTZ,
  notion_last_edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pcs_claim_dose_reqs_notion   ON pcs_claim_dose_reqs(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_pcs_claim_dose_reqs_claim_id ON pcs_claim_dose_reqs(claim_id);

-- ── pcs_import_jobs ───────────────────────────────────────────────────────────
-- PDF import job tracking. Records the state of each PCS PDF extraction run.
CREATE TABLE IF NOT EXISTS pcs_import_jobs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        TEXT UNIQUE,
  pcs_id                TEXT,
  status                TEXT,    -- 'pending' | 'extracting' | 'reviewing' | 'committed' | 'error'
  error_log             TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  notion_created_at     TIMESTAMPTZ,
  notion_last_edited_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_pcs_import_jobs_notion ON pcs_import_jobs(notion_page_id);
CREATE INDEX IF NOT EXISTS idx_pcs_import_jobs_pcs_id ON pcs_import_jobs(pcs_id);
CREATE INDEX IF NOT EXISTS idx_pcs_import_jobs_status ON pcs_import_jobs(status);
