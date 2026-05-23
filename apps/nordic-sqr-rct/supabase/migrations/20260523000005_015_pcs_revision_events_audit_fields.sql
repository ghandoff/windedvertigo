-- Migration 015: extend pcs_revision_events with audit-trail fields.
--
-- pcs_revision_events is the platform's per-mutation audit log. The
-- original schema (migration 001) covered the snapshot fields
-- (entity_type / entity_id / field_path / before / after / actor / reason).
-- Wave 8 Phase A added a parallel Notion DB with extra audit fields used
-- by src/lib/pcs-revisions.js (actor roles, entity title denorm, revert
-- bookkeeping). This migration brings those fields into Postgres so the
-- entire revision-log path can be Postgres-first (Part 10 Tier-2 PR #7).
--
-- All columns are additive + nullable; existing rows continue to work.

ALTER TABLE pcs_revision_events
  ADD COLUMN IF NOT EXISTS actor_roles         TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS entity_title        TEXT,
  ADD COLUMN IF NOT EXISTS reverted_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reverted_by         TEXT,
  ADD COLUMN IF NOT EXISTS revert_of_revision  TEXT;

-- Lookup for "what revision undid this one?" — used by the revert UI.
CREATE INDEX IF NOT EXISTS pcs_revision_events_revert_of_idx
  ON pcs_revision_events (revert_of_revision)
  WHERE revert_of_revision IS NOT NULL;
