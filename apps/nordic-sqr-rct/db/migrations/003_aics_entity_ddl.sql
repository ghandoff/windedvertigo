-- 003_aics_entity_ddl.sql
-- Wave 7.5 / Bundle 3 — AICS as first-class entity (DDL-only slice).
--
-- AICS = Active Ingredient Claims Substantiation. The upstream sibling of
-- PCS. Where a PCS doc lives at the product level (e.g. "Vit D3 Children's
-- Gummy"), an AICS doc lives at the active-ingredient level (e.g. "Vit D3").
-- A single AICS substantiation feeds multiple PCS docs by reference.
--
-- Sources for the schema:
--   - The AICS-0004v0.1 Vit D3 Children RA-review .docx Gina shared 2026-05-01
--   - Lauren Bosio's controlled-vocabulary doc (2026-04-16 meeting notes,
--     Notion page 344e4ee74ba480808e68f5fbf16d1ca5)
--
-- This migration is ADDITIVE-ONLY:
--   - No existing tables are altered or dropped.
--   - No application code reads/writes these tables yet (Bundle 3 Phase 3.2+
--     adds entity helpers + API routes).
--   - Controlled-vocab tables are also seeded by this migration so Bundle 4
--     (PCS form-driven entry) can reuse them without a separate migration.
--
-- Migration ordering rule (per db/README.md): DDL → backfill → enable RLS,
-- never out of order. This is the DDL step. RLS is deferred to a future
-- migration once the tables are populated and application code is dual-writing.

-- ============================================================================
-- (1) Controlled-vocabulary tables (canonical lookup for AICS + PCS)
-- ============================================================================

-- Format code (FMT) per Lauren's vocab doc: CAP/CHW/GUM/LIQ/SG/TAB/PWDR.
CREATE TABLE cv_format_codes (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0
);
COMMENT ON TABLE cv_format_codes IS
  'Bundle 3/4 — canonical product format codes per Lauren Bosio''s vocab doc 2026-04-16.';

-- Demographic age groups per Lauren's vocab (canonical; AICS-0004 used a finer
-- split with Toddlers/Pre-teen which we do NOT carry — Lauren''s spec wins).
CREATE TABLE cv_demographics_age (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  age_min_years NUMERIC,
  age_max_years NUMERIC,
  sort_order   INT NOT NULL DEFAULT 0
);
COMMENT ON TABLE cv_demographics_age IS
  'Bundle 3/4 — canonical age-group taxonomy per Lauren''s vocab (2026-04-16). AICS-0004''s finer split (toddlers/pre-teen) is normalized to this coarser set.';

-- Biological sex (Males / Females / Males and Females).
CREATE TABLE cv_demographics_sex (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0
);

-- Life stage (Perimenopausal / Postmenopausal / Pregnant prenatal / Postpartum).
CREATE TABLE cv_demographics_lifestage (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0
);

-- Lifestyle tags (Active/athlete) and ingredient-level tags (Vegetarian /
-- Carnivore-Limited-Plant). Two columns of taxonomy keep them distinct from
-- demographic; both attach to claims.
CREATE TABLE cv_demographics_lifestyle (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  category     TEXT NOT NULL CHECK (category IN ('lifestyle', 'ingredient_level')),
  sort_order   INT NOT NULL DEFAULT 0
);

-- 17 benefit categories per Lauren's vocab.
CREATE TABLE cv_benefit_categories (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  sort_order   INT NOT NULL DEFAULT 0
);
COMMENT ON TABLE cv_benefit_categories IS
  'Bundle 3/4 — canonical benefit-category list per Lauren''s vocab. 17 entries.';

-- Active Ingredient master (canonical AI list referenced by AICS docs).
-- Lauren''s "AI Details for Qualified Raw Materials" Smartsheet feeds this;
-- Phase 3.2 adds an import script. For now, the table is empty and AICS
-- documents can either reference an AI by FK (preferred) or by free-text
-- (legacy fallback for any AICS doc that arrives before backfill).
CREATE TABLE cv_active_ingredients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_name      TEXT UNIQUE NOT NULL,                -- e.g. 'vitamin D3'
  display_name TEXT NOT NULL,
  ai_class     TEXT,                                -- e.g. 'fat-soluble vitamin'
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI form (e.g. cholecalciferol, ergocalciferol). Belongs to one AI.
CREATE TABLE cv_ai_forms (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_ingredient_id UUID NOT NULL REFERENCES cv_active_ingredients(id) ON DELETE CASCADE,
  form_name     TEXT NOT NULL,                      -- e.g. 'cholecalciferol'
  display_name  TEXT NOT NULL,
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (active_ingredient_id, form_name)
);

-- AI source (e.g. 'lanolin (sheep)', 'lichen (algae and fungi)'). Free-form
-- per AICS doc; not strictly bound to a specific AI form.
CREATE TABLE cv_ai_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name  TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  archived     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Claim grade (A/B/C — replaces the legacy "Classification" column).
CREATE TABLE cv_claim_grades (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description  TEXT,
  sort_order   INT NOT NULL DEFAULT 0
);

-- Claim prefix (e.g. 'supports', 'helps build', 'is required for'). Lauren
-- flagged these as semantically distinct from the core benefit text — same
-- claim with different prefixes can imply different dosing thresholds.
CREATE TABLE cv_claim_prefixes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix_text  TEXT UNIQUE NOT NULL,
  archived     BOOLEAN NOT NULL DEFAULT FALSE
);

-- ============================================================================
-- (2) AICS entity tables (mirror pcs_documents / pcs_versions / pcs_claims)
-- ============================================================================

CREATE TABLE aics_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        TEXT UNIQUE NOT NULL,
  aics_id               TEXT NOT NULL DEFAULT '',           -- e.g. 'AICS-0004'
  -- Active Ingredient this AICS substantiates (one-to-one).
  active_ingredient_id  UUID REFERENCES cv_active_ingredients(id) ON DELETE SET NULL,
  ai_name_text          TEXT NOT NULL DEFAULT '',           -- free-text fallback (e.g. 'vitamin D3')
  -- Status fields mirror pcs_documents.
  classification        TEXT,
  file_status           TEXT,
  ra_review_status      TEXT,                                -- e.g. 'Pending RA Review' / 'Approved'
  document_notes        TEXT NOT NULL DEFAULT '',
  approved_date         DATE,
  latest_version_id     TEXT,                                -- notion_page_id of aics_versions
  all_version_ids       TEXT[] NOT NULL DEFAULT '{}',
  archived              BOOLEAN NOT NULL DEFAULT FALSE,
  template_version      TEXT,
  template_signals      TEXT NOT NULL DEFAULT '',
  notion_created_at     TIMESTAMPTZ,
  notion_last_edited_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX aics_documents_ai_idx ON aics_documents(active_ingredient_id);
CREATE INDEX aics_documents_status_idx ON aics_documents(ra_review_status);

COMMENT ON TABLE aics_documents IS
  'AICS = Active Ingredient Claims Substantiation. Upstream sibling of pcs_documents. One AICS feeds many PCS docs via pcs_aics_references.';

CREATE TABLE aics_versions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        TEXT UNIQUE NOT NULL,
  aics_document_id      UUID REFERENCES aics_documents(id) ON DELETE SET NULL,
  aics_document_notion_id TEXT NOT NULL DEFAULT '',
  version               TEXT NOT NULL DEFAULT '',           -- e.g. 'v0.1', 'v1.0'
  is_latest             BOOLEAN NOT NULL DEFAULT FALSE,
  effective_date        DATE,
  change_description    TEXT NOT NULL DEFAULT '',
  responsible_dept      TEXT,                                -- e.g. 'RES' (Research) or 'RA'
  responsible_individual TEXT,                               -- initials per AICS doc convention
  approved_by           TEXT,
  notion_created_at     TIMESTAMPTZ,
  notion_last_edited_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX aics_versions_doc_idx ON aics_versions(aics_document_id);

-- AICS claims: per-claim min dose at the demographic level. Each row is
-- (claim × demographic_age × demographic_sex). Lifestage / lifestyle tags
-- attach via aics_claim_demographics if needed (deferred to Phase 3.2).
CREATE TABLE aics_claims (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  aics_document_id         UUID REFERENCES aics_documents(id) ON DELETE SET NULL,
  aics_version_id          UUID REFERENCES aics_versions(id) ON DELETE SET NULL,
  claim_no                 INT,                              -- 1, 2, 3 ... per AICS doc
  claim_status             TEXT,                              -- 'Authorized', 'Pending', 'Rejected', etc.
  benefit_category         TEXT REFERENCES cv_benefit_categories(code) ON DELETE SET NULL,
  claim_prefix_id          UUID REFERENCES cv_claim_prefixes(id) ON DELETE SET NULL,
  claim_text               TEXT NOT NULL,
  -- Per-demographic min dose. Each AICS claim row carries one set; multiple
  -- demographic rows mean multiple aics_claims rows with the same claim_no.
  age_group_code           TEXT REFERENCES cv_demographics_age(code) ON DELETE SET NULL,
  sex_code                 TEXT REFERENCES cv_demographics_sex(code) ON DELETE SET NULL,
  min_dose                 NUMERIC,
  min_dose_unit            TEXT,                              -- 'mcg', 'mg', 'IU', '% DV', etc.
  min_dose_secondary       NUMERIC,                           -- e.g. 600 IU when min_dose is 15 mcg
  min_dose_secondary_unit  TEXT,                              -- e.g. 'IU'
  grade                    TEXT REFERENCES cv_claim_grades(code) ON DELETE SET NULL,
  fda_dshea_disclaimer_required BOOLEAN NOT NULL DEFAULT FALSE,
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX aics_claims_doc_idx ON aics_claims(aics_document_id);
CREATE INDEX aics_claims_version_idx ON aics_claims(aics_version_id);
CREATE INDEX aics_claims_benefit_idx ON aics_claims(benefit_category);
CREATE INDEX aics_claims_grade_idx ON aics_claims(grade);

-- Table A — Applicable NN Raw Materials per AICS doc.
CREATE TABLE aics_raw_materials (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aics_document_id     UUID NOT NULL REFERENCES aics_documents(id) ON DELETE CASCADE,
  aics_version_id      UUID REFERENCES aics_versions(id) ON DELETE SET NULL,
  fm_plm_number        TEXT NOT NULL,                        -- e.g. 'IN00399' (volatile per Lauren)
  ai_source_id         UUID REFERENCES cv_ai_sources(id) ON DELETE SET NULL,
  ai_source_text       TEXT NOT NULL DEFAULT '',             -- free-text fallback
  ai_form_id           UUID REFERENCES cv_ai_forms(id) ON DELETE SET NULL,
  ai_form_text         TEXT NOT NULL DEFAULT '',             -- free-text fallback
  active_ingredient_id UUID REFERENCES cv_active_ingredients(id) ON DELETE SET NULL,
  ai_name_text         TEXT NOT NULL DEFAULT '',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX aics_raw_materials_doc_idx ON aics_raw_materials(aics_document_id);
CREATE INDEX aics_raw_materials_plm_idx ON aics_raw_materials(fm_plm_number);

-- ============================================================================
-- (3) PCS ↔ AICS reference (a PCS doc inherits substantiation from one or
-- more AICS docs — e.g. a multi-vitamin PCS references AICS-0004 (vit D3),
-- AICS-0007 (vit C), AICS-0012 (zinc), etc.)
-- ============================================================================

CREATE TABLE pcs_aics_references (
  pcs_document_id  UUID NOT NULL REFERENCES pcs_documents(id) ON DELETE CASCADE,
  aics_document_id UUID NOT NULL REFERENCES aics_documents(id) ON DELETE CASCADE,
  -- Optional AICS version pin; null = always inherit latest version.
  aics_version_id  UUID REFERENCES aics_versions(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (pcs_document_id, aics_document_id)
);
CREATE INDEX pcs_aics_references_aics_idx ON pcs_aics_references(aics_document_id);

COMMENT ON TABLE pcs_aics_references IS
  'Bundle 3 — PCS docs reference upstream AICS substantiation. By-reference (not by-copy): claims live on the AICS, the PCS just declares which AICS docs it inherits from.';

-- ============================================================================
-- (4) Seed data — controlled-vocabulary tables populated from Lauren's
-- 2026-04-16 vocab doc. Idempotent on re-run via ON CONFLICT.
-- ============================================================================

-- Format codes (Lauren's vocab):
INSERT INTO cv_format_codes (code, display_name, sort_order) VALUES
  ('CAP',  'Capsules',    10),
  ('CHW',  'Chews',       20),
  ('GUM',  'Gummies',     30),
  ('LIQ',  'Liquids',     40),
  ('SG',   'Soft Gels',   50),
  ('TAB',  'Tablets',     60),
  ('PWDR', 'Powder',      70)
ON CONFLICT (code) DO NOTHING;

-- Age groups (Lauren's coarser canonical set; supersedes AICS-0004's finer split):
INSERT INTO cv_demographics_age (code, display_name, age_min_years, age_max_years, sort_order) VALUES
  ('infants',        'Infants',           0,    1,   10),
  ('children_1_3',   'Children 1-3 yrs',  1,    3,   20),
  ('children_4_12',  'Children 4-12 yrs', 4,    12,  30),
  ('teens_13_17',    'Adolescents/Teens 13-17 yrs', 13, 17, 40),
  ('adults_18_69',   'Adults 18-69 yrs',  18,   69,  50),
  ('older_adults',   'Older Adults 70+ yrs', 70, NULL, 60)
ON CONFLICT (code) DO NOTHING;

-- Biological sex:
INSERT INTO cv_demographics_sex (code, display_name, sort_order) VALUES
  ('males',           'Males',            10),
  ('females',         'Females',          20),
  ('males_females',   'Males and Females', 30)
ON CONFLICT (code) DO NOTHING;

-- Life stage:
INSERT INTO cv_demographics_lifestage (code, display_name, sort_order) VALUES
  ('perimenopausal',  'Perimenopausal',                          10),
  ('postmenopausal',  'Postmenopausal',                          20),
  ('pregnant',        'Pregnant (prenatal) and/or lactating',    30),
  ('postpartum',      'Postpartum and/or lactating',             40)
ON CONFLICT (code) DO NOTHING;

-- Lifestyle / ingredient-level tags:
INSERT INTO cv_demographics_lifestyle (code, display_name, category, sort_order) VALUES
  ('athlete',         'Active/Athlete',                'lifestyle',        10),
  ('vegetarian',      'Vegetarian Diet',               'ingredient_level', 20),
  ('limited_plant',   'Carnivore/Limited-Plant Diet',  'ingredient_level', 30)
ON CONFLICT (code) DO NOTHING;

-- 17 benefit categories (Lauren's vocab):
INSERT INTO cv_benefit_categories (code, display_name, sort_order) VALUES
  ('athletic_performance',    'Athletic Performance',         10),
  ('bones_muscles_joints',    'Bones, Muscles, and/or Joints', 20),
  ('brain_cognition_mood',    'Brain, Cognition, and/or Mood', 30),
  ('digestive',               'Digestive System',              40),
  ('energy_vitality',         'Energy & Vitality',             50),
  ('eye',                     'Eye',                           60),
  ('fertility',               'Fertility',                     70),
  ('general_foundational',    'General/Foundational/Essential', 80),
  ('growth_development',      'Growth & Development',          90),
  ('heart_cardiovascular',    'Heart/Cardiovascular',          100),
  ('immune',                  'Immune System',                 110),
  ('men',                     'Men',                           120),
  ('metabolism',              'Metabolism',                    130),
  ('relaxation_sleep',        'Relaxation or Sleep',           140),
  ('sexual_health',           'Sexual Health',                 150),
  ('skin_hair_nails',         'Skin, Hair, Nails',             160),
  ('women',                   'Women',                         170)
ON CONFLICT (code) DO NOTHING;

-- Claim grades (A/B/C):
INSERT INTO cv_claim_grades (code, display_name, description, sort_order) VALUES
  ('A', 'Grade A', 'Strong substantiation: high-quality RCTs + regulatory monograph alignment.', 10),
  ('B', 'Grade B', 'Adequate substantiation: peer-reviewed evidence + RDA/regulatory backing.',  20),
  ('C', 'Grade C', 'Limited substantiation: emerging evidence; use with caution.',                30)
ON CONFLICT (code) DO NOTHING;
