-- Phase 3: origin_type sourcing taxonomy, deal_events audit trail, and data corrections.
-- Spec: .claude/tasks/claude-code-supabase-revenue-wiring.md

-- ── Task 1: origin_type column ────────────────────────────────────────────
--
-- Taxonomy:
--   rfp          — sourced through RFP Lighthouse, PRME/UNGC, external procurement
--   warm_outreach — sourced through direct relationship (e.g. Lamis Sabra introductions)
--   legacy        — existing/recurring client relationships
--   product       — product revenue

ALTER TABLE deals ADD COLUMN IF NOT EXISTS origin_type text
  CHECK (origin_type IN ('rfp', 'warm_outreach', 'legacy', 'product'));

COMMENT ON COLUMN deals.origin_type IS 'Deal sourcing channel: rfp | warm_outreach | legacy | product. NULL = unclassified.';

CREATE INDEX IF NOT EXISTS deals_origin_type_idx ON deals (origin_type);

-- ── Task 2: deal_events audit table ──────────────────────────────────────
--
-- Records status changes, payment events, and notes against a deal.
-- event_type values:
--   status_change | payment_received | amount_updated
--   verbal_confirm | contract_signed | note_added

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

-- ── Task 3: Data corrections ──────────────────────────────────────────────

-- Amna at 10: correct contracted_amount ($29,350 → $25,400) and set origin_type.
-- Approved contract is £20,000; ~$25,400 at current GBP/USD rate.
UPDATE deals
SET contracted_amount = 25400,
    origin_type       = 'rfp'
WHERE deal ILIKE '%amna%';

-- Log the Amna correction as an audit event.
INSERT INTO deal_events (deal_id, event_type, old_value, new_value, note)
SELECT
  id,
  'amount_updated',
  '{"contracted_amount": 29350}'::jsonb,
  '{"contracted_amount": 25400}'::jsonb,
  'Corrected from proposal $29,350 to approved contract £20,000 (~$25,400 USD)'
FROM deals
WHERE deal ILIKE '%amna%';

-- Michael Finneran / MIC University of Limerick: new early-stage deal.
-- Introduced by Lamis Sabra; no contracted amount yet.
INSERT INTO deals (
  notion_page_id,
  deal,
  stage,
  contracted_amount,
  origin_type,
  notes,
  org_ids,
  rfp_ids
) VALUES (
  'manual-mic-limerick-michael-finneran-2026-06',
  'MIC University of Limerick — Sabbatical Creativity Center',
  'sourcing',
  NULL,
  'warm_outreach',
  'Contact: Michael Finneran. Introduced by Lamis Sabra. Early-stage creativity center project at MIC University of Limerick.',
  '{}',
  '{}'
) ON CONFLICT (notion_page_id) DO NOTHING;
