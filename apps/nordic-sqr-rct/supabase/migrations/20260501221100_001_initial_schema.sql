-- 001_initial_schema.sql
-- Phase N1 initial Postgres schema for Nordic SQR-RCT.
-- Mirrors the 15 Notion databases. Multi-relations stored as TEXT[] of
-- notion_page_ids initially (denormalized) — this lets backfill + dual-write
-- ship faster. Phase N1.5 (a successor migration) will normalize the
-- highest-traffic many-to-many edges into proper join tables.
--
-- Conventions:
--   - UUID PKs (gen_random_uuid())
--   - notion_page_id TEXT UNIQUE on every domain table — preserves the
--     Notion identity for backfill matching + dual-write referencing.
--     After Phase N5 cutover this column can be dropped or kept as audit.
--   - created_at, updated_at TIMESTAMPTZ tracked at PG level (we ALSO
--     mirror Notion's created_time + last_edited_time as separate columns
--     for backfill fidelity; PG-side timestamps reflect when the row was
--     written to Supabase).
--   - Multi-select Notion fields → TEXT[]
--   - Select Notion fields → TEXT (no enum types; values evolve in Notion)
--   - Relations (single) → notion_relation_id TEXT (notion_page_id of the
--     other side) until Phase N1.5 swaps to UUID FK.
--   - Relations (multi) → TEXT[] of notion_page_ids until Phase N1.5.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ─────────────────────────────────────────────────────────────────────
-- SQR-RCT subsystem (3 tables)
-- ─────────────────────────────────────────────────────────────────────

-- reviewers — user accounts (researchers + ops staff)
-- Notion DB: NOTION_REVIEWER_DB
CREATE TABLE reviewers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        TEXT UNIQUE NOT NULL,
  first_name            TEXT NOT NULL DEFAULT '',
  last_name             TEXT NOT NULL DEFAULT '',
  email                 TEXT,
  affiliation           TEXT NOT NULL DEFAULT '',
  affiliation_type      TEXT,
  alias                 TEXT NOT NULL DEFAULT '',
  password_hash         TEXT NOT NULL DEFAULT '',  -- bcrypt
  discipline            TEXT NOT NULL DEFAULT '',
  domain_expertise      TEXT[] NOT NULL DEFAULT '{}',
  years_experience      NUMERIC,
  consent               BOOLEAN NOT NULL DEFAULT FALSE,
  training_completed    BOOLEAN NOT NULL DEFAULT FALSE,
  is_admin              BOOLEAN NOT NULL DEFAULT FALSE,
  roles                 TEXT[] NOT NULL DEFAULT '{sqr-rct}',  -- multi_select
  onboarding_date       DATE,
  profile_image_url     TEXT,
  password_reset_required BOOLEAN NOT NULL DEFAULT FALSE,  -- forced-reset flow
  notion_created_at     TIMESTAMPTZ,
  notion_last_edited_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX reviewers_email_idx ON reviewers (LOWER(email));
CREATE INDEX reviewers_alias_idx ON reviewers (alias);
CREATE INDEX reviewers_roles_idx ON reviewers USING GIN (roles);

-- intakes — study intake forms (one row per RCT being scored)
-- Notion DB: NOTION_INTAKE_DB
CREATE TABLE intakes (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  citation                 TEXT NOT NULL DEFAULT '',
  doi                      TEXT,
  year                     INTEGER,
  journal                  TEXT NOT NULL DEFAULT '',
  purpose_of_research      TEXT NOT NULL DEFAULT '',
  study_design             TEXT NOT NULL DEFAULT '',
  funding_sources          TEXT NOT NULL DEFAULT '',
  inclusion_criteria       TEXT NOT NULL DEFAULT '',
  exclusion_criteria       TEXT NOT NULL DEFAULT '',
  recruitment              TEXT NOT NULL DEFAULT '',
  blinding                 TEXT,
  initial_n                INTEGER,
  ages                     TEXT NOT NULL DEFAULT '',
  female_participants      INTEGER,
  male_participants        INTEGER,
  final_n                  INTEGER,
  a_priori_power           TEXT,
  location_country         TEXT NOT NULL DEFAULT '',
  location_city            TEXT NOT NULL DEFAULT '',
  timing_of_measures       TEXT NOT NULL DEFAULT '',
  independent_variables    TEXT NOT NULL DEFAULT '',
  dependent_variables      TEXT NOT NULL DEFAULT '',
  control_variables        TEXT NOT NULL DEFAULT '',
  key_results              TEXT NOT NULL DEFAULT '',
  other_results            TEXT NOT NULL DEFAULT '',
  statistical_methods      TEXT NOT NULL DEFAULT '',
  missing_data_handling    TEXT NOT NULL DEFAULT '',
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX intakes_doi_idx ON intakes (doi);
CREATE INDEX intakes_year_idx ON intakes (year);

-- scores — score entries (one row per reviewer × intake combo)
-- Notion DB: NOTION_SCORES_DB
CREATE TABLE scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id        TEXT UNIQUE NOT NULL,
  score_id              TEXT NOT NULL DEFAULT '',
  study_relation        TEXT[] NOT NULL DEFAULT '{}',  -- intake notion_page_ids (1:1 in practice)
  reviewer_relation     TEXT[] NOT NULL DEFAULT '{}',  -- reviewer notion_page_ids
  rater_alias           TEXT,
  q1                    INTEGER,
  q2                    INTEGER,
  q3                    INTEGER,
  q4                    INTEGER,
  q5                    INTEGER,
  q6                    INTEGER,
  q7                    INTEGER,
  q8                    INTEGER,
  q9                    INTEGER,
  q10                   INTEGER,
  q11                   INTEGER,
  q1_raw                TEXT NOT NULL DEFAULT '',
  q2_raw                TEXT NOT NULL DEFAULT '',
  q3_raw                TEXT NOT NULL DEFAULT '',
  q4_raw                TEXT NOT NULL DEFAULT '',
  q5_raw                TEXT NOT NULL DEFAULT '',
  q6_raw                TEXT NOT NULL DEFAULT '',
  q7_raw                TEXT NOT NULL DEFAULT '',
  q8_raw                TEXT NOT NULL DEFAULT '',
  q9_raw                TEXT NOT NULL DEFAULT '',
  q10_raw               TEXT NOT NULL DEFAULT '',
  q11_raw               TEXT NOT NULL DEFAULT '',
  notion_created_at     TIMESTAMPTZ,
  notion_last_edited_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX scores_study_relation_idx ON scores USING GIN (study_relation);
CREATE INDEX scores_reviewer_relation_idx ON scores USING GIN (reviewer_relation);

-- ─────────────────────────────────────────────────────────────────────
-- PCS subsystem (12 tables)
-- ─────────────────────────────────────────────────────────────────────

-- pcs_documents — top-level entity per finished good
CREATE TABLE pcs_documents (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  pcs_id                   TEXT NOT NULL DEFAULT '',
  classification           TEXT,
  file_status              TEXT,
  product_status           TEXT,
  transfer_status          TEXT,
  document_notes           TEXT NOT NULL DEFAULT '',
  approved_date            DATE,
  latest_version_id        TEXT,                          -- notion_page_id of pcs_versions
  all_version_ids          TEXT[] NOT NULL DEFAULT '{}',  -- notion_page_ids
  finished_good_name       TEXT NOT NULL DEFAULT '',
  format                   TEXT,
  sap_material_no          TEXT NOT NULL DEFAULT '',
  skus                     TEXT[] NOT NULL DEFAULT '{}',
  archived                 BOOLEAN NOT NULL DEFAULT FALSE,
  template_version         TEXT,
  template_signals         TEXT NOT NULL DEFAULT '',
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_documents_pcs_id_idx ON pcs_documents (pcs_id);
CREATE INDEX pcs_documents_file_status_idx ON pcs_documents (file_status);

-- pcs_versions — version history of PCS documents
CREATE TABLE pcs_versions (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id                  TEXT UNIQUE NOT NULL,
  version                         TEXT NOT NULL DEFAULT '',
  pcs_document_id                 TEXT,                          -- notion_page_id of pcs_documents
  effective_date                  DATE,
  is_latest                       BOOLEAN NOT NULL DEFAULT FALSE,
  version_notes                   TEXT NOT NULL DEFAULT '',
  supersedes_id                   TEXT,
  claim_ids                       TEXT[] NOT NULL DEFAULT '{}',
  formula_line_ids                TEXT[] NOT NULL DEFAULT '{}',
  reference_ids                   TEXT[] NOT NULL DEFAULT '{}',
  revision_event_ids              TEXT[] NOT NULL DEFAULT '{}',
  request_ids                     TEXT[] NOT NULL DEFAULT '{}',
  latest_version_of_id            TEXT,
  product_name                    TEXT NOT NULL DEFAULT '',
  format_override                 TEXT NOT NULL DEFAULT '',
  demographic                     TEXT[] NOT NULL DEFAULT '{}',
  biological_sex                  TEXT[] NOT NULL DEFAULT '{}',
  age_group                       TEXT[] NOT NULL DEFAULT '{}',
  life_stage                      TEXT[] NOT NULL DEFAULT '{}',
  lifestyle                       TEXT[] NOT NULL DEFAULT '{}',
  demographic_backfill_review     TEXT NOT NULL DEFAULT '',
  daily_serving_size              TEXT NOT NULL DEFAULT '',
  total_epa                       NUMERIC,
  total_dha                       NUMERIC,
  total_epa_and_dha               NUMERIC,
  total_omega6                    NUMERIC,
  total_omega9                    NUMERIC,
  notion_created_at               TIMESTAMPTZ,
  notion_last_edited_at           TIMESTAMPTZ,
  created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_versions_pcs_document_id_idx ON pcs_versions (pcs_document_id);
CREATE INDEX pcs_versions_is_latest_idx ON pcs_versions (is_latest) WHERE is_latest = TRUE;

-- pcs_claims — individual claims requiring substantiation
CREATE TABLE pcs_claims (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  claim                    TEXT NOT NULL DEFAULT '',
  claim_no                 TEXT NOT NULL DEFAULT '',
  claim_bucket             TEXT,
  claim_status             TEXT,
  claim_notes              TEXT NOT NULL DEFAULT '',
  disclaimer_required      BOOLEAN NOT NULL DEFAULT FALSE,
  min_dose_mg              NUMERIC,
  max_dose_mg              NUMERIC,
  dose_guidance_note       TEXT NOT NULL DEFAULT '',
  pcs_version_id           TEXT,
  canonical_claim_id       TEXT,
  claim_prefix_id          TEXT,
  core_benefit_id          TEXT,
  evidence_packet_ids      TEXT[] NOT NULL DEFAULT '{}',
  wording_variant_ids      TEXT[] NOT NULL DEFAULT '{}',
  -- NutriGrade body-of-evidence fields
  heterogeneity            TEXT,
  publication_bias         TEXT,
  funding_bias             TEXT,
  precision                TEXT,
  effect_size_category     TEXT,
  dose_response_gradient   TEXT,
  certainty_score          NUMERIC,
  certainty_rating         TEXT,
  confidence               NUMERIC,
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_claims_pcs_version_id_idx ON pcs_claims (pcs_version_id);
CREATE INDEX pcs_claims_canonical_claim_id_idx ON pcs_claims (canonical_claim_id);
CREATE INDEX pcs_claims_claim_status_idx ON pcs_claims (claim_status);

-- pcs_evidence — evidence records (linked study results)
CREATE TABLE pcs_evidence (
  id                                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id                           TEXT UNIQUE NOT NULL,
  name                                     TEXT NOT NULL DEFAULT '',
  citation                                 TEXT NOT NULL DEFAULT '',
  doi                                      TEXT NOT NULL DEFAULT '',
  pmid                                     TEXT NOT NULL DEFAULT '',
  url                                      TEXT,
  evidence_type                            TEXT,
  ingredient                               TEXT[] NOT NULL DEFAULT '{}',
  publication_year                         INTEGER,
  canonical_summary                        TEXT NOT NULL DEFAULT '',
  endnote_group                            TEXT NOT NULL DEFAULT '',
  endnote_record_id                        TEXT NOT NULL DEFAULT '',
  sqr_score                                NUMERIC,
  sqr_risk_of_bias                         TEXT,
  sqr_reviewed                             BOOLEAN NOT NULL DEFAULT FALSE,
  sqr_review_date                          DATE,
  sqr_review_url                           TEXT,
  pdf_url                                  TEXT,
  used_in_packet_ids                       TEXT[] NOT NULL DEFAULT '{}',
  pcs_reference_ids                        TEXT[] NOT NULL DEFAULT '{}',
  active_ingredient_canonical_ids          TEXT[] NOT NULL DEFAULT '{}',
  -- Wave 5.4 — Ingredient safety cross-check
  safety_signal                            BOOLEAN NOT NULL DEFAULT FALSE,
  safety_ingredient_ids                    TEXT[] NOT NULL DEFAULT '{}',
  safety_dose_threshold                    NUMERIC,
  safety_dose_unit                         TEXT NOT NULL DEFAULT '',
  safety_demographic_filter_raw            TEXT NOT NULL DEFAULT '',
  notion_created_at                        TIMESTAMPTZ,
  notion_last_edited_at                    TIMESTAMPTZ,
  created_at                               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_evidence_doi_idx ON pcs_evidence (doi);
CREATE INDEX pcs_evidence_pmid_idx ON pcs_evidence (pmid);
CREATE INDEX pcs_evidence_safety_signal_idx ON pcs_evidence (safety_signal) WHERE safety_signal = TRUE;
CREATE INDEX pcs_evidence_ingredient_idx ON pcs_evidence USING GIN (ingredient);

-- pcs_evidence_packets — bundles of evidence supporting a claim
CREATE TABLE pcs_evidence_packets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  name                     TEXT NOT NULL DEFAULT '',
  pcs_claim_id             TEXT,
  evidence_item_id         TEXT,
  evidence_role            TEXT,
  meets_sqr_threshold      BOOLEAN NOT NULL DEFAULT FALSE,
  relevance_note           TEXT NOT NULL DEFAULT '',
  sort_order               NUMERIC,
  substantiation_tier      TEXT,
  study_dose_ai            TEXT NOT NULL DEFAULT '',
  study_dose_amount        NUMERIC,
  study_dose_unit          TEXT,
  null_result_rationale    TEXT NOT NULL DEFAULT '',
  key_takeaway             TEXT NOT NULL DEFAULT '',
  study_design_summary     TEXT NOT NULL DEFAULT '',
  sample_size              NUMERIC,
  positive_results         TEXT NOT NULL DEFAULT '',
  neutral_results          TEXT NOT NULL DEFAULT '',
  negative_results         TEXT NOT NULL DEFAULT '',
  potential_biases         TEXT NOT NULL DEFAULT '',
  confidence               NUMERIC,
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_evidence_packets_claim_idx ON pcs_evidence_packets (pcs_claim_id);
CREATE INDEX pcs_evidence_packets_evidence_idx ON pcs_evidence_packets (evidence_item_id);

-- pcs_canonical_claims — deduplicated claim catalog
CREATE TABLE pcs_canonical_claims (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id                TEXT UNIQUE NOT NULL,
  canonical_claim               TEXT NOT NULL DEFAULT '',
  claim_family                  TEXT,
  evidence_tier_required        TEXT,
  minimum_evidence_items        NUMERIC,
  notes_guardrails              TEXT NOT NULL DEFAULT '',
  pcs_claim_instance_ids        TEXT[] NOT NULL DEFAULT '{}',
  claim_prefix_id               TEXT,
  core_benefit_id               TEXT,
  active_ingredient_id          TEXT,
  benefit_category_id           TEXT,
  source_caipb_row_id           NUMERIC,
  canonical_key                 TEXT,
  dose_sensitivity_applied      TEXT,
  dedupe_decision               TEXT,
  notion_created_at             TIMESTAMPTZ,
  notion_last_edited_at         TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_canonical_claims_canonical_key_idx ON pcs_canonical_claims (canonical_key);
CREATE INDEX pcs_canonical_claims_claim_family_idx ON pcs_canonical_claims (claim_family);

-- pcs_formula_lines — per-product ingredient lines
CREATE TABLE pcs_formula_lines (
  id                                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id                              TEXT UNIQUE NOT NULL,
  ingredient_form                             TEXT NOT NULL DEFAULT '',
  pcs_version_id                              TEXT,
  ingredient_source                           TEXT NOT NULL DEFAULT '',
  elemental_ai                                TEXT,
  elemental_amount_mg                         NUMERIC,
  ratio_note                                  TEXT NOT NULL DEFAULT '',
  serving_basis_note                          TEXT NOT NULL DEFAULT '',
  formula_notes                               TEXT NOT NULL DEFAULT '',
  ai                                          TEXT NOT NULL DEFAULT '',
  ai_form                                     TEXT NOT NULL DEFAULT '',
  fm_plm                                      TEXT NOT NULL DEFAULT '',
  amount_per_serving                          NUMERIC,
  amount_unit                                 TEXT,
  percent_daily_value                         NUMERIC,
  active_ingredient_canonical_id              TEXT,
  active_ingredient_form_canonical_id         TEXT,
  confidence                                  NUMERIC,
  notion_created_at                           TIMESTAMPTZ,
  notion_last_edited_at                       TIMESTAMPTZ,
  created_at                                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_formula_lines_pcs_version_idx ON pcs_formula_lines (pcs_version_id);
CREATE INDEX pcs_formula_lines_canonical_idx ON pcs_formula_lines (active_ingredient_canonical_id);

-- pcs_references — cited reference materials
CREATE TABLE pcs_references (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id              TEXT UNIQUE NOT NULL,
  name                        TEXT NOT NULL DEFAULT '',
  pcs_reference_label         TEXT NOT NULL DEFAULT '',
  reference_text_as_written   TEXT NOT NULL DEFAULT '',
  reference_notes             TEXT NOT NULL DEFAULT '',
  pcs_version_id              TEXT,
  evidence_item_id            TEXT,
  notion_created_at           TIMESTAMPTZ,
  notion_last_edited_at       TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_references_evidence_idx ON pcs_references (evidence_item_id);

-- pcs_wording_variants — alternative phrasings of canonical claims
CREATE TABLE pcs_wording_variants (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  wording                  TEXT NOT NULL DEFAULT '',
  pcs_claim_id             TEXT,
  is_primary               BOOLEAN NOT NULL DEFAULT FALSE,
  variant_notes            TEXT NOT NULL DEFAULT '',
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_wording_variants_claim_idx ON pcs_wording_variants (pcs_claim_id);

-- pcs_requests — substantiation work requests (sketch — verify props in src/lib/pcs-requests.js)
CREATE TABLE pcs_requests (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  title                    TEXT NOT NULL DEFAULT '',
  status                   TEXT,
  pcs_document_id          TEXT,
  pcs_version_id           TEXT,
  requester                TEXT NOT NULL DEFAULT '',
  due_date                 DATE,
  notes                    TEXT NOT NULL DEFAULT '',
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_requests_status_idx ON pcs_requests (status);
CREATE INDEX pcs_requests_document_idx ON pcs_requests (pcs_document_id);

-- pcs_revision_events — audit log (polymorphic — entity_type + entity_id)
CREATE TABLE pcs_revision_events (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  entity_type              TEXT NOT NULL,  -- 'pcs_documents' | 'pcs_versions' | 'pcs_claims' | 'pcs_evidence'
  entity_id                TEXT NOT NULL,  -- notion_page_id of the affected entity
  field_path               TEXT NOT NULL,
  before_value             JSONB,
  after_value              JSONB,
  actor                    TEXT NOT NULL DEFAULT '',
  reason                   TEXT NOT NULL DEFAULT '',
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX pcs_revision_events_entity_idx ON pcs_revision_events (entity_type, entity_id);
CREATE INDEX pcs_revision_events_actor_idx ON pcs_revision_events (actor);
CREATE INDEX pcs_revision_events_created_at_idx ON pcs_revision_events (created_at DESC);

-- pcs_schema_intake — schema metadata / intake configuration (sketch)
CREATE TABLE pcs_schema_intake (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id           TEXT UNIQUE NOT NULL,
  name                     TEXT NOT NULL DEFAULT '',
  config                   JSONB,
  status                   TEXT,
  notion_created_at        TIMESTAMPTZ,
  notion_last_edited_at    TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────
-- Auxiliary tables (NOT in Notion — net-new for the migration)
-- ─────────────────────────────────────────────────────────────────────

-- notion_id_map — maps Notion page IDs to Supabase UUIDs across all tables.
-- Useful during dual-write phase: API receives a Notion ID, looks up the
-- corresponding Supabase row to update. After Phase N5 cutover, this
-- becomes redundant (Supabase uses its own UUIDs as primary identity).
CREATE TABLE notion_id_map (
  notion_page_id     TEXT PRIMARY KEY,
  supabase_id        UUID NOT NULL,
  table_name         TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX notion_id_map_table_idx ON notion_id_map (table_name);

-- dual_write_log — observability during the dual-write phase. Detects
-- divergence between Notion and Supabase (e.g. transformation bugs).
-- Drop after Phase N5 + 1 month of clean operation.
CREATE TABLE dual_write_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action          TEXT NOT NULL,  -- 'create' | 'update' | 'delete'
  table_name      TEXT NOT NULL,
  notion_id       TEXT,
  supabase_id     UUID,
  status          TEXT NOT NULL,  -- 'ok' | 'notion_failed' | 'supabase_failed' | 'diverged'
  error           TEXT,
  payload_hash    TEXT  -- sha256 of write payload; helps diff Notion vs Supabase contents
);
CREATE INDEX dual_write_log_ts_idx ON dual_write_log (ts DESC);
CREATE INDEX dual_write_log_status_idx ON dual_write_log (status) WHERE status != 'ok';

-- ─────────────────────────────────────────────────────────────────────
-- updated_at triggers — auto-bump on row update
-- ─────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'reviewers', 'intakes', 'scores',
    'pcs_documents', 'pcs_versions', 'pcs_claims',
    'pcs_evidence', 'pcs_evidence_packets', 'pcs_canonical_claims',
    'pcs_formula_lines', 'pcs_references', 'pcs_wording_variants',
    'pcs_requests', 'pcs_schema_intake'
  ]) LOOP
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at()', t, t);
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- RLS — placeholder. Enable once the API can set a session-scoped
-- current_user_id() value via SET LOCAL. Until then, all access is via
-- service role; app-side checks gate the API routes.
-- ─────────────────────────────────────────────────────────────────────

-- ALTER TABLE reviewers ENABLE ROW LEVEL SECURITY;
-- (etc.)
-- See db/schema-design.md "RLS sketch" section for the policy plan.
