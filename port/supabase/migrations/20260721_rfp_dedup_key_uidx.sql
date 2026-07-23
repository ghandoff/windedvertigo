-- F1 (prevent duplicate radar cards) — part 2 of 2: hard DB guard.
--
-- A partial UNIQUE index makes a second ACTIVE row with the same dedup_key
-- physically impossible, even under a concurrent-ingest race. The app-level
-- check in lib/ai/rfp-ingest.ts is the primary path; this is defence-in-depth.
--
-- Terminal statuses are excluded so a re-issued grant (new funding cycle) or a
-- previously-declined opportunity can legitimately re-enter the radar.
--
-- ⚠️  APPLY ONLY AFTER the one-time duplicate cleanup — index creation FAILS if
--     active duplicates still exist. Pre-check (must return zero rows):
--       select dedup_key, count(*) from rfp_opportunities
--       where coalesce(status,'radar')
--             not in ('won','lost','no-go','missed deadline')
--       group by dedup_key having count(*) > 1;

CREATE UNIQUE INDEX IF NOT EXISTS rfp_opportunities_active_dedup_key_uidx
  ON rfp_opportunities (dedup_key)
  WHERE status IS NULL OR status NOT IN ('won', 'lost', 'no-go', 'missed deadline');
