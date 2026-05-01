-- 053: restore seeded commerce-SKU packs to status='live'
--
-- Migrations 033 (co-design essentials test-mode price) and 052 (depth-chart,
-- deep-deck, raft-house, harbour-bundle commerce SKUs) inserted 5 rows into
-- packs_cache with kebab-case notion_ids as a placeholder discriminator
-- (e.g. 'dc-assessment-pro', 'harbour-bundle', 'test-notion-001').
--
-- Every Notion sync since flipped these rows to status='archived' because
-- the cleanupStale() sweep in lib/sync/packs.ts swept ALL rows whose
-- notion_id wasn't in the active Notion list — including these SKUs that
-- never came from Notion to begin with.
--
-- The sweep is now scoped to UUID-shaped notion_ids (see packs.ts +
-- collections.ts), so this is the one-shot to restore the affected rows
-- back to their migration-time status. Commerce SKUs need status='live' so
-- the catalogue/entitlement queries that filter on status see them.
--
-- Idempotent: only flips rows that are currently archived AND have a
-- non-UUID notion_id. Safe to re-run.

UPDATE packs_cache
SET status = 'live',
    synced_at = NOW()
WHERE notion_id !~ '^[0-9a-f]{8}-'
  AND status = 'archived';
