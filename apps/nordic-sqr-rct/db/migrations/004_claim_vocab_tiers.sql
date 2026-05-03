-- ─── Migration 004 — Claim Vocabulary Tiers (Phase 4.6) ──────────────────
-- 2026-05-03 — Garrett Jaeger
--
-- Adds the Tier-1.5 strength axis + Tier-3 phrasing variant storage to
-- the claim model. Companion to docs/reviews/claim-vocab-redundancy-2026-05-03.md.
--
-- The 4-tier vocabulary established by Lauren's AICS-0004 template:
--   Tier 1   — Category        (cv_benefit_categories — already seeded)
--   Tier 1.5 — Claim Strength  (cv_claim_strengths    — NEW, this migration)
--   Tier 2   — Claim Family    (family_key TEXT       — NEW, this migration)
--   Tier 3   — Phrasing Variant (pcs_claim_variants    — NEW, this migration)
--
-- ADDITIVE ONLY: every change is `IF NOT EXISTS` or `ADD COLUMN`. Existing
-- rows keep their behavior; new rows pick up the tier structure.

BEGIN;

-- ─── Tier 1.5: Claim Strength controlled vocabulary ──────────────────────
CREATE TABLE IF NOT EXISTS cv_claim_strengths (
  code         TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  sort_order   INT  NOT NULL DEFAULT 0,
  description  TEXT
);
COMMENT ON TABLE cv_claim_strengths IS 'Phase 4.6: Tier-1.5 of the claim vocabulary. Distinguishes the regulatory weight of a claim. essential > mechanism > support > nutrition > delivery_system, roughly in decreasing substantiation strength.';

INSERT INTO cv_claim_strengths (code, display_name, sort_order, description) VALUES
  ('essential',       'Required for / Essential',                 1, 'Strongest claim language. "Required for [function]" implies essentiality of the AI for that function.'),
  ('mechanism',       'Plays a critical role in',                 2, 'Mechanistic claim. Implies the AI participates in a known biological mechanism.'),
  ('support',         'Supports / Helps / Promotes',              3, 'Standard structure-function language. Most common Tier in Nordic claims.'),
  ('nutrition',       'Nutritional support',                      4, 'Nutrition claim. Often gated by % Daily Value thresholds.'),
  ('delivery_system', 'Delivery / Bioavailability / Form-factor', 5, 'Claims about the AI form, source, or delivery system rather than the AI''s function.')
ON CONFLICT (code) DO NOTHING;

-- ─── Extend aics_claims with Tier-1.5 + Tier-2 ───────────────────────────
ALTER TABLE aics_claims
  ADD COLUMN IF NOT EXISTS claim_strength TEXT REFERENCES cv_claim_strengths(code) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS family_key     TEXT;

CREATE INDEX IF NOT EXISTS aics_claims_strength_idx ON aics_claims(claim_strength);
CREATE INDEX IF NOT EXISTS aics_claims_family_idx   ON aics_claims(family_key);

-- ─── PCS claims live in Notion (no direct Postgres mirror table yet, by ──
-- design — that's the Phase N2 work). For now, the same fields are stored
-- on the Notion side; this migration just ensures the Postgres mirror is
-- ready for the Phase N2 backfill, which will lift PCS claims into here.
-- A placeholder table records the proposed structure so Phase N2 doesn't
-- have to redesign on the fly.
CREATE TABLE IF NOT EXISTS pcs_claims_mirror (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id      TEXT UNIQUE NOT NULL,
  pcs_document_id     UUID,                                          -- FK once Phase N2 lifts pcs_documents into Postgres
  claim_status        TEXT,
  claim_text          TEXT NOT NULL,                                 -- canonical short label (Lauren's vocab grammar)
  claim_category      TEXT REFERENCES cv_benefit_categories(code) ON DELETE SET NULL,
  claim_strength      TEXT REFERENCES cv_claim_strengths(code)    ON DELETE SET NULL,
  claim_prefix_id     UUID REFERENCES cv_claim_prefixes(id)       ON DELETE SET NULL,
  family_key          TEXT,
  age_group_code      TEXT REFERENCES cv_demographics_age(code)   ON DELETE SET NULL,
  sex_code            TEXT REFERENCES cv_demographics_sex(code)   ON DELETE SET NULL,
  min_dose            NUMERIC,
  min_dose_unit       TEXT,
  grade               TEXT REFERENCES cv_claim_grades(code)       ON DELETE SET NULL,
  fda_dshea_disclaimer_required BOOLEAN NOT NULL DEFAULT FALSE,
  notion_created_at   TIMESTAMPTZ,
  notion_last_edited_at TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS pcs_claims_mirror_category_idx ON pcs_claims_mirror(claim_category);
CREATE INDEX IF NOT EXISTS pcs_claims_mirror_strength_idx ON pcs_claims_mirror(claim_strength);
CREATE INDEX IF NOT EXISTS pcs_claims_mirror_family_idx   ON pcs_claims_mirror(family_key);
COMMENT ON TABLE pcs_claims_mirror IS 'Phase 4.6: structural mirror of Notion PCS Claims DB. Empty until Phase N2 lifts the mirror; used today for tier reporting and backfill staging. Notion remains source of truth.';

-- ─── Tier 3: Phrasing Variants storage ───────────────────────────────────
CREATE TABLE IF NOT EXISTS claim_variants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- A variant points at EITHER an aics_claim OR a pcs_claim (notion page id, since
  -- pcs claims aren't in Postgres yet). Exactly one of these is non-null.
  aics_claim_id   UUID REFERENCES aics_claims(id) ON DELETE CASCADE,
  pcs_claim_notion_page_id TEXT,                                     -- FK soft-link until Phase N2
  family_key      TEXT NOT NULL,
  variant_text    TEXT NOT NULL,
  variant_order   INT  NOT NULL DEFAULT 0,
  is_canonical    BOOLEAN NOT NULL DEFAULT FALSE,                    -- the "preferred" phrasing
  source          TEXT,                                              -- 'aics-doc', 'pcs-import', 'lauren-edit', 'feedback', etc.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT claim_variants_one_parent
    CHECK ((aics_claim_id IS NOT NULL) <> (pcs_claim_notion_page_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS claim_variants_family_idx        ON claim_variants(family_key);
CREATE INDEX IF NOT EXISTS claim_variants_aics_claim_idx    ON claim_variants(aics_claim_id);
CREATE INDEX IF NOT EXISTS claim_variants_pcs_notion_idx    ON claim_variants(pcs_claim_notion_page_id);
COMMENT ON TABLE claim_variants IS 'Phase 4.6: Tier-3 of the claim vocabulary. Multiple interchangeable phrasings backed by the same evidence + dose + grade. The label writer picks one variant at label-write time. Existing slash-separated compound titles are split into N variant rows during backfill.';

-- ─── Backfill audit log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claim_migration_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id      TEXT NOT NULL,                                 -- claim being classified
  source_database     TEXT NOT NULL,                                 -- 'pcs_claims' | 'aics_claims'
  before_text         TEXT,                                          -- claim text before migration
  after_category      TEXT,
  after_strength      TEXT,
  after_family_key    TEXT,
  after_variants      JSONB,                                         -- array of variant strings
  classification_method TEXT NOT NULL,                               -- 'regex-heuristic-v1' | 'lauren-manual' | 'feedback-correction'
  classifier_confidence NUMERIC,                                     -- 0.0–1.0
  applied             BOOLEAN NOT NULL DEFAULT FALSE,                -- false = dry-run proposal, true = written to Notion
  applied_at          TIMESTAMPTZ,
  applied_by_email    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS claim_migration_log_notion_idx ON claim_migration_log(notion_page_id);
CREATE INDEX IF NOT EXISTS claim_migration_log_applied_idx ON claim_migration_log(applied);

COMMIT;

-- ─── Verify ──────────────────────────────────────────────────────────────
-- Run after migration to confirm:
--   SELECT COUNT(*) FROM cv_claim_strengths;            -- expect 5
--   SELECT COUNT(*) FROM aics_claims;                   -- unchanged
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='aics_claims' AND column_name IN ('claim_strength','family_key');
--   SELECT * FROM claim_variants LIMIT 0;                -- table exists, empty
--   SELECT * FROM pcs_claims_mirror LIMIT 0;             -- table exists, empty
