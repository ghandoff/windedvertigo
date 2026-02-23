-- creaseworks migration 012
-- date: 2026-02-23
-- description: add collective-tier fields to patterns_cache
--
-- These fields are visible to the winded.vertigo collective
-- (windedvertigo.com emails) but not to regular entitled users.
-- They provide behind-the-curtain context: why this playdate
-- was designed, what developmental opportunities it touches,
-- and any notes from the design team.

ALTER TABLE patterns_cache
  ADD COLUMN IF NOT EXISTS design_rationale TEXT,
  ADD COLUMN IF NOT EXISTS developmental_notes TEXT,
  ADD COLUMN IF NOT EXISTS author_notes TEXT;
