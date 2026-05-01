-- Phase G.1.2 — add missing filter columns to organizations table.
-- These are needed before switching GET /api/organizations reads from Notion to Supabase.
-- Sync cron (sync-organizations-pilot) must be redeployed alongside this migration to
-- start populating the new columns.

-- Enable pg_trgm first (needed for the name gin index below)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS source   text,
  ADD COLUMN IF NOT EXISTS regions  text,    -- comma-joined multi-select (matches category pattern)
  ADD COLUMN IF NOT EXISTS quadrant text;

-- Trigram index enables efficient ILIKE '%search%' on name
CREATE INDEX IF NOT EXISTS organizations_name_trgm_idx ON organizations USING gin (name gin_trgm_ops);

-- Simple B-tree indexes for new filter columns
CREATE INDEX IF NOT EXISTS organizations_source_idx   ON organizations (source);
CREATE INDEX IF NOT EXISTS organizations_quadrant_idx ON organizations (quadrant);
