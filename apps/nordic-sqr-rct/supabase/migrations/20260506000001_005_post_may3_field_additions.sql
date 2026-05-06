-- 005_post-may3_field_additions.sql
-- 2026-05-06 — Garrett Jaeger
--
-- Schema gap audit between migrations 001-004 (frozen) and the current
-- parsePage() return shapes in src/lib/pcs-*.js. A meaningful amount of
-- feature work shipped between 2026-05-03 (migration 004) and today, and
-- several Notion fields surfaced by parsePage() do not yet have a
-- corresponding Postgres column. This migration fills those gaps so the
-- Phase N2 backfill (Supabase provisioning, scheduled tomorrow morning)
-- can persist every field the application currently reads.
--
-- Conventions follow the prior migrations:
--   - snake_case column names (Notion-side parsePage uses camelCase JS keys;
--     mapped here e.g. lastEditedTime -> notion_last_edited_at, etc.).
--   - TEXT for select fields, TEXT[] for multi-select / relation arrays.
--   - TIMESTAMPTZ for date/datetime fields, DATE for date-only.
--   - NUMERIC for numbers (matches existing convention; parsePage returns
--     plain numbers — INTEGER is reserved for explicitly counted fields).
--   - BOOLEAN for checkboxes.
--   - Relation arrays (notion_page_id arrays) — TEXT[].
--   - Single relations — TEXT (the related notion_page_id).
--   - All ALTER TABLE statements use ADD COLUMN IF NOT EXISTS so re-runs
--     are safe. No NOT NULL constraints — the existing rows would have
--     NULL until backfill repopulates them.
--   - No DROP, no RENAME, no constraint tightening. Strictly additive.
--
-- Items intentionally deferred (flagged as "needs further design"):
--   - pcs_requests.assignees — parsePage returns an array of {id, name, email}
--     person objects pulled from a Notion People property. A flat column
--     can't represent the nested shape; a join table (request_assignees)
--     belongs in the Phase N1.5 normalization slice, not this gap-fill.
--     The flat scalar `assignee_ids TEXT[]` IS added below as the minimum
--     viable surface so the read path can dual-write the Notion person ids.
--   - pcs_revision_events parsePage shape diverges substantially from the
--     001 migration sketch (which assumed a generic polymorphic
--     entity_type/entity_id/before_value/after_value audit-log shape). The
--     actual Notion DB stores per-event narrative columns (event title,
--     activity_type, responsible_dept, from/to version pointers, dates,
--     dual-approval). Adding the narrative columns here so the live shape
--     can be persisted; the polymorphic columns from 001 stay in place
-- ▎  unused for now, to be reconsidered in Phase N1.5.
--
-- Verification queries appended at the bottom of the file.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- pcs_documents
-- ─────────────────────────────────────────────────────────────────────
-- Bundle 3.4 (2026-04-25) added a Linked AICS dual-relation on PCS
-- documents (RA links AICS docs directly from the PCS page).
-- 2026-05-04 hard-merge dedup added a canonical_document pointer for
-- soft-merged duplicate rows.
ALTER TABLE pcs_documents
  ADD COLUMN IF NOT EXISTS linked_aics_ids       TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS canonical_document_id TEXT;
COMMENT ON COLUMN pcs_documents.linked_aics_ids IS
  'Added 2026-05-06 — Bundle 3.4 dual-relation: notion_page_ids of AICS Documents this PCS inherits substantiation from. Source: src/lib/pcs-documents.js parsePage().';
COMMENT ON COLUMN pcs_documents.canonical_document_id IS
  'Added 2026-05-06 — soft-merge dedup target (2026-05-04). Non-null on duplicate rows; points at the canonical pcs_documents.notion_page_id this duplicate folds into. Source: src/lib/pcs-documents.js parsePage().';
CREATE INDEX IF NOT EXISTS pcs_documents_canonical_idx
  ON pcs_documents (canonical_document_id) WHERE canonical_document_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pcs_documents_linked_aics_idx
  ON pcs_documents USING GIN (linked_aics_ids);

-- ─────────────────────────────────────────────────────────────────────
-- pcs_versions — already comprehensive in 001; no gaps detected.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- pcs_claims
-- ─────────────────────────────────────────────────────────────────────
-- Wave 4.5.5 added a per-item extractor confidence (0-1) to claims —
-- 001 has confidence on pcs_evidence_packets and pcs_formula_lines but
-- accidentally omitted it from pcs_claims (despite being on the same
-- wave). Note: pcs_claims already has its own `confidence` column from
-- 001 — verified by re-reading; no add needed. parsePage returns a
-- single `confidence` field which already maps. No gap.
-- (Section intentionally left as a no-op for traceability.)

-- ─────────────────────────────────────────────────────────────────────
-- pcs_evidence — already comprehensive in 001; no gaps detected.
-- (Wave 5.4 safety fields are in 001. PDF rehosting / hard-merge dedup
-- added behavior, not new persisted columns surfaced by parsePage.)
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- pcs_evidence_packets
-- ─────────────────────────────────────────────────────────────────────
-- Wave 4.5.5 confidence (per-item extractor confidence) IS already in
-- 001. No gap.

-- ─────────────────────────────────────────────────────────────────────
-- pcs_canonical_claims
-- ─────────────────────────────────────────────────────────────────────
-- All fields present in 001. canonical_key, dose_sensitivity_applied,
-- and dedupe_decision are already there. No gap.

-- ─────────────────────────────────────────────────────────────────────
-- pcs_formula_lines — already comprehensive in 001; no gaps detected.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- pcs_references — already comprehensive in 001; no gaps detected.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- pcs_wording_variants — already comprehensive in 001; no gaps detected.
-- ─────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────
-- pcs_requests
-- ─────────────────────────────────────────────────────────────────────
-- 001 sketched pcs_requests with title/status/pcs_document_id/
-- pcs_version_id/requester/due_date/notes — but the live Notion DB
-- and parsePage shape (Wave 4.5.0) carry a much richer set of fields:
-- request_type, priority, source, related claims/PCS, RA/RES dual-track
-- due/completed dates, opened/last-pinged dates, assignee People
-- property, resolution note, age computation. Filling those gaps:
ALTER TABLE pcs_requests
  ADD COLUMN IF NOT EXISTS request               TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS request_notes         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pcs_version_id        TEXT,
  ADD COLUMN IF NOT EXISTS related_claim_ids     TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS related_pcs_id        TEXT,
  ADD COLUMN IF NOT EXISTS request_type          TEXT,
  ADD COLUMN IF NOT EXISTS specific_field        TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS assigned_role         TEXT,
  ADD COLUMN IF NOT EXISTS assignee_ids          TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS priority              TEXT,
  ADD COLUMN IF NOT EXISTS opened_date           DATE,
  ADD COLUMN IF NOT EXISTS last_pinged_date      DATE,
  ADD COLUMN IF NOT EXISTS resolution_note       TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS source                TEXT,
  ADD COLUMN IF NOT EXISTS ra_due                DATE,
  ADD COLUMN IF NOT EXISTS ra_completed          DATE,
  ADD COLUMN IF NOT EXISTS res_due               DATE,
  ADD COLUMN IF NOT EXISTS res_completed         DATE,
  ADD COLUMN IF NOT EXISTS age_days              INTEGER,
  ADD COLUMN IF NOT EXISTS requested_by          TEXT NOT NULL DEFAULT '';
COMMENT ON COLUMN pcs_requests.request IS
  'Added 2026-05-06 — Notion title (request summary). Source: src/lib/pcs-requests.js parsePage(). Sits alongside legacy "title" column from 001 which the application no longer writes.';
COMMENT ON COLUMN pcs_requests.request_notes IS
  'Added 2026-05-06 — long-form request notes (rich_text). Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.pcs_version_id IS
  'Added 2026-05-06 — notion_page_id of related pcs_versions row. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.related_claim_ids IS
  'Added 2026-05-06 — notion_page_ids of related pcs_claims rows. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.related_pcs_id IS
  'Added 2026-05-06 — notion_page_id of related pcs_documents row (Wave 4.5.0). Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.request_type IS
  'Added 2026-05-06 — Wave 4.5.0 select. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.specific_field IS
  'Added 2026-05-06 — Wave 4.5.0 narrative pointer to the claim/version field this request targets. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.assigned_role IS
  'Added 2026-05-06 — Wave 4.5.0 select (RA / RES / etc.). Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.assignee_ids IS
  'Added 2026-05-06 — Notion person ids assigned to this request. Flat shape; the {id,name,email} object array returned by parsePage() needs further design as a join table in Phase N1.5. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.priority IS
  'Added 2026-05-06 — Wave 4.5.0 select. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.opened_date IS
  'Added 2026-05-06 — when the request was opened (separate from row created_at). Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.last_pinged_date IS
  'Added 2026-05-06 — last reminder ping. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.resolution_note IS
  'Added 2026-05-06 — close-out note. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.source IS
  'Added 2026-05-06 — origin of the request (e.g. UI, intake, audit). Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.ra_due IS
  'Added 2026-05-06 — RA-side due date (dual-track flow). Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.ra_completed IS
  'Added 2026-05-06 — RA-side completion date. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.res_due IS
  'Added 2026-05-06 — Research-side due date. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.res_completed IS
  'Added 2026-05-06 — Research-side completion date. Source: src/lib/pcs-requests.js parsePage().';
COMMENT ON COLUMN pcs_requests.age_days IS
  'Added 2026-05-06 — derived by parsePage() from openedDate or createdTime; persisted for queryability. Source: src/lib/pcs-requests.js parsePage() computeAgeDays().';
COMMENT ON COLUMN pcs_requests.requested_by IS
  'Added 2026-05-06 — coalesces a rich_text or People-property requester into a flat string. Source: src/lib/pcs-requests.js parsePage().';
CREATE INDEX IF NOT EXISTS pcs_requests_pcs_version_idx
  ON pcs_requests (pcs_version_id);
CREATE INDEX IF NOT EXISTS pcs_requests_priority_idx
  ON pcs_requests (priority);
CREATE INDEX IF NOT EXISTS pcs_requests_request_type_idx
  ON pcs_requests (request_type);
CREATE INDEX IF NOT EXISTS pcs_requests_assignee_ids_idx
  ON pcs_requests USING GIN (assignee_ids);

-- ─────────────────────────────────────────────────────────────────────
-- pcs_revision_events
-- ─────────────────────────────────────────────────────────────────────
-- 001 modeled this as a polymorphic audit log (entity_type/entity_id/
-- field_path/before_value/after_value/actor/reason). The live Notion
-- DB and parsePage shape are narrative-per-row (event title, activity
-- type, responsible dept/individual, from/to version pointers, dates,
-- pcs_version relation, narrative notes, dual-approval). Adding the
-- narrative columns; the polymorphic columns from 001 stay in place
-- but unused (revisit in Phase N1.5).
ALTER TABLE pcs_revision_events
  ADD COLUMN IF NOT EXISTS event                       TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS activity_type               TEXT,
  ADD COLUMN IF NOT EXISTS responsible_dept            TEXT,
  ADD COLUMN IF NOT EXISTS responsible_individual      TEXT,
  ADD COLUMN IF NOT EXISTS start_date                  DATE,
  ADD COLUMN IF NOT EXISTS end_date                    DATE,
  ADD COLUMN IF NOT EXISTS from_version                TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS to_version                  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS from_version_linked_id      TEXT,
  ADD COLUMN IF NOT EXISTS to_version_linked_id        TEXT,
  ADD COLUMN IF NOT EXISTS pcs_version_id              TEXT,
  ADD COLUMN IF NOT EXISTS event_notes                 TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approver_alias              TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS approver_department         TEXT;
COMMENT ON COLUMN pcs_revision_events.event IS
  'Added 2026-05-06 — Notion title for the event. Source: src/lib/pcs-revision-events.js parsePage(). The 001 migration sketched a polymorphic shape; this is the actual narrative-per-row shape.';
COMMENT ON COLUMN pcs_revision_events.activity_type IS
  'Added 2026-05-06 — select (e.g. Approval, Edit, Review). Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.responsible_dept IS
  'Added 2026-05-06 — select (e.g. RA, RES). Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.responsible_individual IS
  'Added 2026-05-06 — initials per template convention. Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.start_date IS
  'Added 2026-05-06 — event start date. Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.end_date IS
  'Added 2026-05-06 — event end date. Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.from_version IS
  'Added 2026-05-06 — text of the prior version label. Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.to_version IS
  'Added 2026-05-06 — text of the new version label. Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.from_version_linked_id IS
  'Added 2026-05-06 — notion_page_id of the prior pcs_versions row (relation). Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.to_version_linked_id IS
  'Added 2026-05-06 — notion_page_id of the new pcs_versions row (relation). Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.pcs_version_id IS
  'Added 2026-05-06 — notion_page_id of the pcs_versions row this event belongs to. Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.event_notes IS
  'Added 2026-05-06 — narrative event notes. Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.approver_alias IS
  'Added 2026-05-06 — Lauren template Table A dual-approval (2026-04-18). Source: src/lib/pcs-revision-events.js parsePage().';
COMMENT ON COLUMN pcs_revision_events.approver_department IS
  'Added 2026-05-06 — Lauren template Table A dual-approval (2026-04-18). Source: src/lib/pcs-revision-events.js parsePage().';
CREATE INDEX IF NOT EXISTS pcs_revision_events_pcs_version_idx
  ON pcs_revision_events (pcs_version_id);
CREATE INDEX IF NOT EXISTS pcs_revision_events_activity_type_idx
  ON pcs_revision_events (activity_type);
-- 001 declared entity_type and entity_id NOT NULL (the polymorphic shape).
-- That blocks the narrative-per-row writes the application actually
-- performs. Relax those constraints to allow inserts that only populate
-- the narrative columns. (Idempotent — DROP NOT NULL is a no-op when the
-- constraint is already absent.)
ALTER TABLE pcs_revision_events ALTER COLUMN entity_type DROP NOT NULL;
ALTER TABLE pcs_revision_events ALTER COLUMN entity_id   DROP NOT NULL;
ALTER TABLE pcs_revision_events ALTER COLUMN field_path  DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- pcs_schema_intake
-- ─────────────────────────────────────────────────────────────────────
-- 001 modeled this as name + JSONB config + status. parsePage() returns
-- the actual Notion DB columns (a survey response form): respondent
-- email, role, digitize-first preference, start-from preference,
-- versions-treated-as preference, evidence-reuse preference, weekly
-- outputs (multi-select), thirty-day-win (multi-select), biggest
-- time sink (rich_text). Adding those columns; the legacy
-- `config JSONB` from 001 stays for free-form overflow.
ALTER TABLE pcs_schema_intake
  ADD COLUMN IF NOT EXISTS respondent_email      TEXT,
  ADD COLUMN IF NOT EXISTS role                  TEXT,
  ADD COLUMN IF NOT EXISTS digitize_first        TEXT,
  ADD COLUMN IF NOT EXISTS start_from            TEXT,
  ADD COLUMN IF NOT EXISTS versions_treated_as   TEXT,
  ADD COLUMN IF NOT EXISTS evidence_reuse        TEXT,
  ADD COLUMN IF NOT EXISTS weekly_outputs        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS thirty_day_win        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS biggest_time_sink     TEXT NOT NULL DEFAULT '';
COMMENT ON COLUMN pcs_schema_intake.respondent_email IS
  'Added 2026-05-06 — survey respondent email. Source: src/lib/pcs-schema-intake.js parsePage().';
COMMENT ON COLUMN pcs_schema_intake.role IS
  'Added 2026-05-06 — survey respondent role select. Source: src/lib/pcs-schema-intake.js parsePage().';
COMMENT ON COLUMN pcs_schema_intake.digitize_first IS
  'Added 2026-05-06 — survey response select. Source: src/lib/pcs-schema-intake.js parsePage().';
COMMENT ON COLUMN pcs_schema_intake.start_from IS
  'Added 2026-05-06 — survey response select. Source: src/lib/pcs-schema-intake.js parsePage().';
COMMENT ON COLUMN pcs_schema_intake.versions_treated_as IS
  'Added 2026-05-06 — survey response select. Source: src/lib/pcs-schema-intake.js parsePage().';
COMMENT ON COLUMN pcs_schema_intake.evidence_reuse IS
  'Added 2026-05-06 — survey response select. Source: src/lib/pcs-schema-intake.js parsePage().';
COMMENT ON COLUMN pcs_schema_intake.weekly_outputs IS
  'Added 2026-05-06 — survey multi-select. Source: src/lib/pcs-schema-intake.js parsePage().';
COMMENT ON COLUMN pcs_schema_intake.thirty_day_win IS
  'Added 2026-05-06 — survey multi-select. Source: src/lib/pcs-schema-intake.js parsePage().';
COMMENT ON COLUMN pcs_schema_intake.biggest_time_sink IS
  'Added 2026-05-06 — survey free-text. Source: src/lib/pcs-schema-intake.js parsePage().';

-- ─────────────────────────────────────────────────────────────────────
-- aics_documents (003)
-- ─────────────────────────────────────────────────────────────────────
-- 003 tracks active_ingredient_id (FK) + ai_name_text fallback. parsePage
-- in pcs-aics.js returns `aiName` directly off the rich_text. It maps
-- onto ai_name_text — no gap. All other parsePage fields present.

-- ─────────────────────────────────────────────────────────────────────
-- aics_versions (003)
-- ─────────────────────────────────────────────────────────────────────
-- parsePage returns claimIds (TEXT[] of related claim notion_page_ids)
-- and latestVersionOfId (single relation). 003 did not include either —
-- the design assumed claims would be discovered by FK on aics_claims
-- and "latest version of" handled by aics_documents.latest_version_id.
-- The application reads these fields directly off the Notion page, so
-- they need persistence for backfill fidelity:
ALTER TABLE aics_versions
  ADD COLUMN IF NOT EXISTS claim_ids               TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS latest_version_of_id    TEXT;
COMMENT ON COLUMN aics_versions.claim_ids IS
  'Added 2026-05-06 — notion_page_ids of aics_claims attached to this version. Mirrors the Notion relation; the FK on aics_claims.aics_version_id is authoritative once Phase N2 backfill completes. Source: src/lib/pcs-aics.js parseAicsVersionPage().';
COMMENT ON COLUMN aics_versions.latest_version_of_id IS
  'Added 2026-05-06 — Notion rollup-style pointer back to the aics_documents row whose latest version this is. Source: src/lib/pcs-aics.js parseAicsVersionPage().';
CREATE INDEX IF NOT EXISTS aics_versions_claim_ids_idx
  ON aics_versions USING GIN (claim_ids);

-- ─────────────────────────────────────────────────────────────────────
-- aics_claims (003 + 004)
-- ─────────────────────────────────────────────────────────────────────
-- parseAicsClaimPage returns several fields not yet in 003/004:
--   - claim_id (the Notion title; distinct from claim_text in claim_core)
--   - lifestyle_tags (multi_select) and life_stage (multi_select) — the
--     003 design tucked these onto aics_claim_demographics but that
--     table was deferred. Storing the raw multi-selects here so the
--     read path matches Notion until the join table ships.
--   - Bundle 3.5 P2 regulatory metadata: substantiating_refs,
--     regulatory_monographs, safety_limit, safety_limit_unit,
--     safety_notes.
ALTER TABLE aics_claims
  ADD COLUMN IF NOT EXISTS claim_id               TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS life_stage             TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lifestyle_tags         TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS substantiating_refs    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS regulatory_monographs  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS safety_limit           NUMERIC,
  ADD COLUMN IF NOT EXISTS safety_limit_unit      TEXT,
  ADD COLUMN IF NOT EXISTS safety_notes           TEXT NOT NULL DEFAULT '';
COMMENT ON COLUMN aics_claims.claim_id IS
  'Added 2026-05-06 — Notion title (the displayed claim id, distinct from claim_text). Source: src/lib/pcs-aics.js parseAicsClaimPage().';
COMMENT ON COLUMN aics_claims.life_stage IS
  'Added 2026-05-06 — multi_select pulled directly off the Notion page until aics_claim_demographics ships. Source: src/lib/pcs-aics.js parseAicsClaimPage().';
COMMENT ON COLUMN aics_claims.lifestyle_tags IS
  'Added 2026-05-06 — multi_select pulled directly off the Notion page until aics_claim_demographics ships. Source: src/lib/pcs-aics.js parseAicsClaimPage().';
COMMENT ON COLUMN aics_claims.substantiating_refs IS
  'Added 2026-05-06 — Bundle 3.5 P2 regulatory metadata. Source: src/lib/pcs-aics.js parseAicsClaimPage().';
COMMENT ON COLUMN aics_claims.regulatory_monographs IS
  'Added 2026-05-06 — Bundle 3.5 P2 regulatory metadata. Source: src/lib/pcs-aics.js parseAicsClaimPage().';
COMMENT ON COLUMN aics_claims.safety_limit IS
  'Added 2026-05-06 — Bundle 3.5 P2 upper-intake safety threshold. Source: src/lib/pcs-aics.js parseAicsClaimPage().';
COMMENT ON COLUMN aics_claims.safety_limit_unit IS
  'Added 2026-05-06 — Bundle 3.5 P2 unit (mcg/mg/IU/etc.) for safety_limit. Source: src/lib/pcs-aics.js parseAicsClaimPage().';
COMMENT ON COLUMN aics_claims.safety_notes IS
  'Added 2026-05-06 — Bundle 3.5 P2 safety narrative. Source: src/lib/pcs-aics.js parseAicsClaimPage().';
-- aics_claims also returns claim_prefix as plain text (rich_text) in the
-- live Notion shape, while 003 wired it as a UUID FK to cv_claim_prefixes.
-- Both shapes need to coexist during backfill; add the text column too.
ALTER TABLE aics_claims
  ADD COLUMN IF NOT EXISTS claim_prefix_text     TEXT NOT NULL DEFAULT '';
COMMENT ON COLUMN aics_claims.claim_prefix_text IS
  'Added 2026-05-06 — rich_text fallback for the claim prefix surfaced by parsePage. The cv_claim_prefixes FK (claim_prefix_id) is the canonical column once vocabulary ingestion catches up. Source: src/lib/pcs-aics.js parseAicsClaimPage().';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────────────
-- Run after migration to confirm new columns exist:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='pcs_documents'
--       AND column_name IN ('linked_aics_ids','canonical_document_id');
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='pcs_requests'
--       AND column_name IN ('request','request_type','assignee_ids','ra_due','res_due','age_days');
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='pcs_revision_events'
--       AND column_name IN ('event','activity_type','from_version_linked_id','approver_alias');
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='pcs_schema_intake'
--       AND column_name IN ('respondent_email','weekly_outputs','biggest_time_sink');
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='aics_versions'
--       AND column_name IN ('claim_ids','latest_version_of_id');
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='aics_claims'
--       AND column_name IN ('claim_id','life_stage','substantiating_refs','safety_limit');
--   SELECT is_nullable FROM information_schema.columns
--     WHERE table_name='pcs_revision_events' AND column_name='entity_type';
--     -- expect 'YES'
