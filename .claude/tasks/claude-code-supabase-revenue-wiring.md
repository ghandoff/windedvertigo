# claude-code-supabase-revenue-wiring

Phase 3 of the revenue pipeline wiring. Connects the strategy dashboard at
`port/lib/strategy-data.ts` to live Supabase data and adds pipeline tracking
improvements including origin_type, deal_events audit trail, and data corrections.

---

## before starting

Check whether Phase 2 has been implemented:
- Look at `port/supabase/migrations/20260429_catchup_untracked_tables.sql`
  and any subsequent migrations to confirm `deals` has `revenue_tier`,
  `received_amount`, and `contracted_amount` columns.
- If Phase 2 is NOT complete, read `.claude/tasks/claude-code-wire-revenue-dashboard.md`
  and implement it first, then return here.

---

## task 1 — add `origin_type` to `deals`

Create a migration that adds:

```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS origin_type text
  CHECK (origin_type IN ('rfp', 'warm_outreach', 'legacy', 'product'));
```

Taxonomy:
- `rfp` — sourced through RFP Lighthouse, PRME/UNGC, or similar external procurement pipeline
- `warm_outreach` — sourced through direct relationship (e.g. Lamis Sabra introductions)
- `legacy` — existing/recurring client relationships
- `product` — product revenue

---

## task 2 — create `deal_events` audit table

```sql
CREATE TABLE IF NOT EXISTS deal_events (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id     uuid REFERENCES deals(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  -- 'status_change' | 'payment_received' | 'amount_updated'
  -- | 'verbal_confirm' | 'contract_signed' | 'note_added'
  old_value   jsonb,
  new_value   jsonb,
  note        text,
  created_at  timestamptz DEFAULT now()
);
```

---

## task 3 — data corrections

**Amna record** (find by name/client in `deals`):
- Update `contracted_amount` from 29350 to 25400
  (approved contract is £20,000; use ~$25,400 at current GBP/USD rate)
- Set `origin_type` = 'rfp'
- Add a `deal_events` row: event_type 'amount_updated', note
  "Corrected from proposal $29,350 to approved contract £20,000 (~$25,400 USD)"

**Michael Finneran** — insert new `deals` row:
- client: "MIC University of Limerick"
- project: "Sabbatical Creativity Center"
- contact_name: "Michael Finneran"
- origin_type: 'warm_outreach'
- status: 'sourcing'
- contracted_amount: null (TBD)
- notes: "Introduced by Lamis Sabra. Early-stage creativity center project at MIC University of Limerick."

---

## task 4 — wire `port/lib/strategy-data.ts`

The `REVENUE_PROGRESS` constant is hardcoded. Replace it with a Supabase query
that returns:

```ts
{
  totalContracted: number,   // sum of contracted_amount (non-null deals)
  totalReceived: number,     // sum of received_amount (non-null deals)
  byOriginType: {
    rfp: number,
    warm_outreach: number,
    legacy: number,
    product: number,
  },
  byRevenueTier: Record<string, number>,  // existing tier breakdown
}
```

- Use the existing Supabase client pattern already in `port/lib/`
- This should be a server-side fetch (not client-side) since it feeds into the
  strategy page SSR
- If a `getRevenueProgress()` function doesn't exist yet, create it in
  `port/lib/strategy-data.ts` and update the strategy page to call it
- Keep the hardcoded `REVENUE_PROGRESS` constant as a fallback — if the
  Supabase fetch fails, fall back to it gracefully

---

## task 5 — document update entry points

In `port/lib/strategy-data.ts` or a new `docs/revenue-pipeline.md`, add a
comment block describing the three ways a deal gets updated:

1. **Verbal/conversation stage** → direct Supabase dashboard entry or future
   admin route in port
2. **Contract signed** → status → 'contracted', set contracted_amount, log
   deal_events row (event_type: 'contract_signed')
3. **Payment received** → update received_amount to match QBO invoice paid
   amount, log deal_events row (event_type: 'payment_received')

No UI needed for this now — just document the pattern so it's clear.

---

## migration file naming

Name the migration:
`port/supabase/migrations/[timestamp]_phase3_revenue_pipeline.sql`

Commit message:
`feat: phase 3 revenue pipeline — origin_type, deal_events, live wiring`

---

## what NOT to do

- Do NOT delete the hardcoded `REVENUE_PROGRESS` constant — keep it as the fallback
- Do NOT change the visual design of the hero bar or the `deriveRevenueTiers()` output shape
- Do NOT modify the Notion→Supabase sync crons — the new columns are supabase-only for now
- Do NOT create a new table for deals — use the existing `deals` table
- Do NOT merge — open a draft PR for review before deploying
