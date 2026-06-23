-- Catch-up: the SCHEMA from 20260607_phase3_revenue_pipeline.sql never landed in
-- production. `deals.origin_type` and the `deal_events` table are both absent,
-- which silently broke:
--   • the /strategy chart's live deal read (SELECT_COLS includes origin_type, so
--     getRevenuePipelineDeals threw and the chart fell back to the hardcoded constant)
--   • the P1 won→deal sync (syncWonRfpToDeal writes origin_type → threw)
--   • the rfp-deal-reconcile cron
--
-- This applies ONLY the schema (plus the still-missing MIC Limerick deal). It
-- deliberately OMITS the original migration's Amna data correction, which would
-- revert Amna's contracted_amount back to 25400 (it's intentionally 25000 now).
-- Run in the Supabase SQL editor. Idempotent.

-- origin_type sourcing taxonomy
ALTER TABLE deals ADD COLUMN IF NOT EXISTS origin_type text
  CHECK (origin_type IN ('rfp', 'warm_outreach', 'legacy', 'product'));
COMMENT ON COLUMN deals.origin_type IS 'Deal sourcing channel: rfp | warm_outreach | legacy | product. NULL = unclassified.';
CREATE INDEX IF NOT EXISTS deals_origin_type_idx ON deals (origin_type);

-- deal_events audit trail
CREATE TABLE IF NOT EXISTS deal_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id     uuid REFERENCES deals(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  old_value   jsonb,
  new_value   jsonb,
  note        text,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deal_events_deal_id_idx    ON deal_events (deal_id);
CREATE INDEX IF NOT EXISTS deal_events_event_type_idx ON deal_events (event_type);
CREATE INDEX IF NOT EXISTS deal_events_created_at_idx ON deal_events (created_at DESC);

-- RLS (default-deny; service-role bypasses). Explicit because the
-- force_rls_on_new_tables trigger (20260622_enable_rls_port_usage_events) is not
-- yet applied.
ALTER TABLE deal_events ENABLE ROW LEVEL SECURITY;

-- MIC University of Limerick: early-stage warm-outreach deal (introduced by Lamis
-- Sabra) that never got created because this migration never ran. Idempotent.
INSERT INTO deals (notion_page_id, deal, stage, contracted_amount, origin_type, notes, org_ids, rfp_ids)
VALUES (
  'manual-mic-limerick-michael-finneran-2026-06',
  'MIC University of Limerick — Sabbatical Creativity Center',
  'sourcing', NULL, 'warm_outreach',
  'Contact: Michael Finneran. Introduced by Lamis Sabra. Early-stage creativity center project at MIC University of Limerick.',
  '{}', '{}'
) ON CONFLICT (notion_page_id) DO NOTHING;
