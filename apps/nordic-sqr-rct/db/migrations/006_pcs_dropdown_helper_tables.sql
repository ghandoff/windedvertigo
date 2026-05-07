-- 006_pcs_dropdown_helper_tables.sql
-- 2026-05-06 — Path-2 Day 2.6
--
-- The Phase 2 dropdown helpers (ingredients, core_benefits) were
-- omitted from the initial Phase N1 schema (001) because they sit
-- behind in-memory caches and were lower-priority than the busiest
-- tables (evidence, claims, documents). This migration adds them so
-- the Path-2 read+write+drift swap on `pcs-ingredients.js` and
-- `pcs-core-benefits.js` has somewhere to land.
--
-- Conventions match the prior migrations: snake_case, TEXT/TEXT[]
-- defaults, IF NOT EXISTS for re-runnability, no NOT NULL constraints
-- on optional fields. Triggers for updated_at attached at the bottom
-- (matches the 001 trigger pattern).
--
-- Source of truth for column shapes:
--   - src/lib/pcs-ingredients.js parsePage()
--   - src/lib/pcs-core-benefits.js parsePage()

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- pcs_ingredients — canonical Active Ingredient catalog
-- Notion DB: NOTION_PCS_INGREDIENTS_DB
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pcs_ingredients (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  canonical_name           TEXT NOT NULL DEFAULT '',
  synonyms                 TEXT NOT NULL DEFAULT '',
  category                 TEXT,
  standard_unit            TEXT,
  fda_rdi                  NUMERIC,
  fda_rdi_unit             TEXT,
  regulatory_ceiling       NUMERIC,
  bioavailability_notes    TEXT NOT NULL DEFAULT '',
  interaction_cautions     TEXT NOT NULL DEFAULT '',
  notes                    TEXT NOT NULL DEFAULT '',
  form_ids                 TEXT[] NOT NULL DEFAULT '{}',
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pcs_ingredients_canonical_name_idx
  ON pcs_ingredients (LOWER(canonical_name));
CREATE INDEX IF NOT EXISTS pcs_ingredients_category_idx
  ON pcs_ingredients (category);

-- ─────────────────────────────────────────────────────────────────────
-- pcs_core_benefits — prefix-stripped claim bodies
-- Notion DB: NOTION_PCS_CORE_BENEFITS_DB
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pcs_core_benefits (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  core_benefit             TEXT NOT NULL DEFAULT '',
  benefit_category_id      TEXT,
  notes                    TEXT NOT NULL DEFAULT '',
  pcs_claim_instance_ids   TEXT[] NOT NULL DEFAULT '{}',
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pcs_core_benefits_core_benefit_idx
  ON pcs_core_benefits (LOWER(core_benefit));
CREATE INDEX IF NOT EXISTS pcs_core_benefits_benefit_category_idx
  ON pcs_core_benefits (benefit_category_id);

-- ─────────────────────────────────────────────────────────────────────
-- updated_at triggers — same pattern as 001's bulk DO block
-- ─────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'pcs_ingredients_set_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER pcs_ingredients_set_updated_at BEFORE UPDATE ON pcs_ingredients FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'pcs_core_benefits_set_updated_at'
  ) THEN
    EXECUTE 'CREATE TRIGGER pcs_core_benefits_set_updated_at BEFORE UPDATE ON pcs_core_benefits FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────────────
--   SELECT table_name FROM information_schema.tables
--     WHERE table_schema='public' AND table_name IN ('pcs_ingredients','pcs_core_benefits');
--   -- expect both rows
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='pcs_ingredients';
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='pcs_core_benefits';
