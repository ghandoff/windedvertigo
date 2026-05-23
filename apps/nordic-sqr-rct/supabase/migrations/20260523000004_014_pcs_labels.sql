-- Migration 014: pcs_labels
-- Market-facing product labels. Each SKU ships a label; the label is what
-- regulators, consumers, and plaintiff attorneys read. Labels relate to
-- PCS documents (substantiation), ingredients (printed composition),
-- evidence (safety cross-check), and PCS requests (drift findings).

CREATE TABLE IF NOT EXISTS pcs_labels (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id              TEXT UNIQUE,

  -- Identification
  sku                         TEXT NOT NULL,
  upc                         TEXT,
  product_name_as_marketed    TEXT,

  -- Visual + versioning
  -- label_image is an array of {name, url} objects (label PDFs / images).
  label_image                 JSONB DEFAULT '[]'::jsonb,
  label_version_date          DATE,

  -- Regulatory metadata
  regulatory_framework        TEXT,        -- e.g. "FDA DSHEA" / "EU Reg 1924/2006"
  markets                     TEXT[] DEFAULT '{}',  -- countries / regions
  approved_claims_on_label    TEXT,
  dv_compliance               BOOLEAN DEFAULT false,

  -- Composition
  ingredient_list_ids         TEXT[] DEFAULT '{}',   -- → pcs_ingredients.notion_page_id
  ingredient_doses            TEXT,

  -- Linked substantiation
  pcs_document_id             TEXT,                  -- → pcs_documents.notion_page_id
  linked_evidence_ids         TEXT[] DEFAULT '{}',   -- → pcs_evidence.notion_page_id

  -- Workflow
  status                      TEXT,
  last_drift_check            DATE,
  drift_finding_ids           TEXT[] DEFAULT '{}',
  owner_ids                   TEXT[] DEFAULT '{}',
  notes                       TEXT,

  -- Timestamps (Notion-era; preserved for sort stability post-migration)
  notion_created_at           TIMESTAMPTZ,
  notion_last_edited_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pcs_labels_notion_page_id
  ON pcs_labels(notion_page_id);

CREATE INDEX IF NOT EXISTS idx_pcs_labels_sku
  ON pcs_labels(sku);

CREATE INDEX IF NOT EXISTS idx_pcs_labels_pcs_document_id
  ON pcs_labels(pcs_document_id);

CREATE INDEX IF NOT EXISTS idx_pcs_labels_status
  ON pcs_labels(status);
