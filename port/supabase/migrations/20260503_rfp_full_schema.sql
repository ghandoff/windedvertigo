-- Phase 1 Supabase read cutover: add all Notion fields to rfp_opportunities
-- Applied 2026-05-03 via `npx supabase db query --linked`

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS url TEXT,
  ADD COLUMN IF NOT EXISTS rfp_document_url TEXT,
  ADD COLUMN IF NOT EXISTS proposal_draft_url TEXT,
  ADD COLUMN IF NOT EXISTS question_bank_url TEXT,
  ADD COLUMN IF NOT EXISTS question_count INTEGER,
  ADD COLUMN IF NOT EXISTS cover_letter_url TEXT,
  ADD COLUMN IF NOT EXISTS team_cvs_url TEXT,
  ADD COLUMN IF NOT EXISTS what_worked TEXT,
  ADD COLUMN IF NOT EXISTS what_fell_flat TEXT,
  ADD COLUMN IF NOT EXISTS client_feedback TEXT,
  ADD COLUMN IF NOT EXISTS lessons_for_next_time TEXT,
  ADD COLUMN IF NOT EXISTS proposal_notes TEXT,
  ADD COLUMN IF NOT EXISTS created_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS related_project_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS owner_ids TEXT[] DEFAULT '{}';
