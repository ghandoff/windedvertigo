-- R1 (one-pager preprocessing): store the cheap review brief auto-generated at
-- intake for every grant. Structured JSON (see OnePager in lib/notion/types.ts),
-- Supabase-only — Notion has no equivalent property, so the hourly Notion→Supabase
-- sync deliberately does NOT write this column (it would wipe it).
-- Additive + non-destructive: safe to apply any time.

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS one_pager jsonb,
  ADD COLUMN IF NOT EXISTS one_pager_generated_at timestamptz;
