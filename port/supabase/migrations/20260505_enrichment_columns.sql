-- Phase A4 — add enrichment columns to organizations and contacts.
-- These are written by the org/contact enrich API routes and were previously
-- stored only in Notion. Now Supabase is the write-primary source of truth.

-- ── organizations ─────────────────────────────────────────────────────────────
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS logo               text,
  ADD COLUMN IF NOT EXISTS description        text,
  ADD COLUMN IF NOT EXISTS linkedin_url       text,
  ADD COLUMN IF NOT EXISTS bespoke_email_copy text,
  ADD COLUMN IF NOT EXISTS enriched_at        timestamptz;

-- ── contacts ──────────────────────────────────────────────────────────────────
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS profile_photo_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url      text;
