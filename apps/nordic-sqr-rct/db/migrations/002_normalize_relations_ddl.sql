-- 002_normalize_relations_ddl.sql
-- Phase N1.5 DDL-only slice. ADDITIVE only — no data is read or written.
-- Application code does NOT use these new structures yet; Phase N2 (backfill)
-- populates them, Phase N3 (dual-write) starts using them, Phase N5 cutover
-- drops the old TEXT/TEXT[] columns.

-- (1) Empty M:N join tables.

CREATE TABLE score_reviewers (
  score_id UUID NOT NULL REFERENCES scores(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES reviewers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (score_id, reviewer_id)
);
CREATE INDEX score_reviewers_reviewer_idx ON score_reviewers(reviewer_id);

CREATE TABLE version_claims (
  version_id UUID NOT NULL REFERENCES pcs_versions(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES pcs_claims(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (version_id, claim_id)
);
CREATE INDEX version_claims_claim_idx ON version_claims(claim_id);

CREATE TABLE packet_evidence (
  packet_id UUID NOT NULL REFERENCES pcs_evidence_packets(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES pcs_evidence(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (packet_id, evidence_id)
);
CREATE INDEX packet_evidence_evidence_idx ON packet_evidence(evidence_id);

CREATE TABLE evidence_references (
  evidence_id UUID NOT NULL REFERENCES pcs_evidence(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES pcs_references(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (evidence_id, reference_id)
);
CREATE INDEX evidence_references_reference_idx ON evidence_references(reference_id);

-- (2) Nullable UUID FK columns on existing tables. Each is alongside the
-- existing TEXT notion_page_id-style column; both coexist until N5 cutover.
-- ON DELETE SET NULL is intentional — we don't want a cascade through these
-- new FKs while Phase N2 is still backfilling.

ALTER TABLE pcs_versions
  ADD COLUMN pcs_document_id_fk UUID REFERENCES pcs_documents(id) ON DELETE SET NULL;

ALTER TABLE pcs_claims
  ADD COLUMN pcs_version_id_fk UUID REFERENCES pcs_versions(id) ON DELETE SET NULL;

ALTER TABLE pcs_evidence_packets
  ADD COLUMN pcs_claim_id_fk UUID REFERENCES pcs_claims(id) ON DELETE SET NULL;

ALTER TABLE pcs_references
  ADD COLUMN pcs_version_id_fk UUID REFERENCES pcs_versions(id) ON DELETE SET NULL;

-- (3) is_ops on reviewers. Backfilled by Phase N2 from a Notion query.

ALTER TABLE reviewers
  ADD COLUMN is_ops BOOLEAN NOT NULL DEFAULT FALSE;

-- (4) current_user_id() session function for future RLS. Reads a session GUC
-- (Postgres custom setting); returns NULL if not set, which RLS policies will
-- use to deny access entirely.

CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
  SELECT NULLIF(
    current_setting('app.current_user_id', true),
    ''
  )::UUID;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION current_user_id() IS
  'Phase N1.5 — reads app.current_user_id GUC set by API on each request. Returns NULL if unset (RLS policies treat NULL as deny-all). Function is STABLE so Postgres can cache within a single statement.';
