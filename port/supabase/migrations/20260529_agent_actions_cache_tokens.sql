-- Track cache effectiveness on wv-claw turns (W0.3 follow-up).
--
-- The Anthropic Messages API splits input tokens into three buckets when
-- cache_control markers are present:
--   - input_tokens               — non-cached input (regular price)
--   - cache_creation_input_tokens — first write of cached content (~1.25x)
--   - cache_read_input_tokens     — subsequent reads (~0.1x)
--
-- Today we sum all three into the single `input_tokens` column and apply
-- the regular rate, which OVER-counts cost for cache reads. This migration
-- adds the cache-specific columns so we can compute cache hit-rate +
-- accurate weighted cost over time. Backfill is not needed — existing
-- rows just have NULL in the new columns.

ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS cache_creation_input_tokens INTEGER;
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS cache_read_input_tokens INTEGER;

COMMENT ON COLUMN agent_actions.cache_creation_input_tokens IS 'Tokens written to cache on first turn (Anthropic prompt-caching ephemeral). Billed at ~1.25x base.';
COMMENT ON COLUMN agent_actions.cache_read_input_tokens IS 'Tokens read from cache on subsequent turns within 5-min TTL. Billed at ~0.1x base.';
