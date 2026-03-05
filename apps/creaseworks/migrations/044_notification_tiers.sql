-- Migration 044: Tier-aware notification filtering (P3-6)
--
-- Adds a min_tier column to in_app_notifications so that
-- notifications can be scoped to users at a specific engagement tier.
--
-- Read-time filtering: the user's current ui_tier is compared against
-- each notification's min_tier. This means if a user upgrades their
-- tier, they'll retroactively see notifications they previously couldn't.
--
-- Tier ordering: casual < curious < collaborator

ALTER TABLE in_app_notifications
  ADD COLUMN IF NOT EXISTS min_tier TEXT NOT NULL DEFAULT 'casual';

-- Backfill gallery notifications to collaborator tier
-- (only collaborators can submit to the gallery, so these are inherently collaborator-scoped)
UPDATE in_app_notifications
  SET min_tier = 'collaborator'
  WHERE event_type IN ('gallery_approved', 'gallery_rejected');
