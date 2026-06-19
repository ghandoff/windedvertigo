-- Migration 021: Compliance Attributes
-- Budget C Marketing Intelligence Layer (2026-06-14)
--
-- Adds per-ingredient compliance attribute tracking (Non-GMO, Vegan, Halal, etc.)
-- and a visibility flag on pcs_evidence for private/proprietary studies.

-- Compliance attributes table
CREATE TABLE IF NOT EXISTS compliance_attributes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient_id   TEXT NOT NULL,
  attribute       TEXT NOT NULL CHECK (attribute IN (
    'Non-GMO', 'Vegan', 'Vegetarian', 'Halal', 'Kosher',
    'WADA-Compliant', 'Gluten-Free', 'Soy-Free', 'Dairy-Free',
    'Heavy-Metals-Tested', 'Pesticide-Tested', 'Prop65-Compliant',
    'NSF-Certified', 'USP-Verified', 'CCOF-Organic'
  )),
  status          TEXT NOT NULL DEFAULT 'unknown'
                    CHECK (status IN ('yes', 'no', 'conditional', 'unknown')),
  certified_by    TEXT,
  notes           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_compliance_attr_unique
  ON compliance_attributes(ingredient_id, attribute);
CREATE INDEX IF NOT EXISTS idx_compliance_attr_ingredient
  ON compliance_attributes(ingredient_id);

-- Private study visibility on evidence
ALTER TABLE pcs_evidence
  ADD COLUMN IF NOT EXISTS visibility TEXT
    NOT NULL DEFAULT 'shared'
    CHECK (visibility IN ('shared', 'nordic-private'));

CREATE INDEX IF NOT EXISTS idx_pcs_evidence_visibility
  ON pcs_evidence(visibility) WHERE visibility = 'nordic-private';
