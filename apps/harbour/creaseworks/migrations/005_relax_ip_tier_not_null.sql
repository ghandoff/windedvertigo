-- migration 005: relax ip_tier NOT NULL constraint on patterns_cache
-- The Notion sync can produce NULL ip_tier values when a pattern page
-- doesn't have the property set. The NOT NULL constraint causes the
-- entire INSERT to fail, blocking the sync for that pattern.

ALTER TABLE patterns_cache ALTER COLUMN ip_tier DROP NOT NULL;
