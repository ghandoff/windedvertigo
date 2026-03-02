-- Migration 042: Progressive disclosure user tiers
--
-- Adds a ui_tier column to users for progressive disclosure.
-- Tiers are purely cosmetic/UX — they control what appears in
-- navigation and dashboard surfaces, NOT access permissions.
-- All features remain accessible via direct URL regardless of tier.
--
-- Tiers:
--   casual       — just play ideas (sampler, matcher, packs, gallery view-only)
--   curious      — + playbook with developmental context
--   collaborator — + reflections, community, gallery submissions, credits

ALTER TABLE users ADD COLUMN IF NOT EXISTS ui_tier TEXT NOT NULL DEFAULT 'casual';

ALTER TABLE users ADD CONSTRAINT chk_ui_tier
  CHECK (ui_tier IN ('casual', 'curious', 'collaborator'));

-- Existing onboarded users have already seen the full feature set —
-- default them to collaborator so nothing changes for them.
UPDATE users SET ui_tier = 'collaborator' WHERE onboarding_completed = TRUE;
