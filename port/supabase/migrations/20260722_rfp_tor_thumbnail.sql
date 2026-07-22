-- TOR thumbnail: store the R2 URL of a screenshot of the TOR document / source
-- page so a human can visually confirm a real TOR (not a website) is attached.
-- (tor_verified_at / tor_verified_by already exist from 20260508_rfp_pipeline_v2.sql.)
-- Additive + non-destructive: safe to apply any time.

ALTER TABLE rfp_opportunities
  ADD COLUMN IF NOT EXISTS tor_thumbnail_url text,
  ADD COLUMN IF NOT EXISTS tor_thumbnail_generated_at timestamptz;
