# claude code prompt: wire the strategy hero bar to live data

> paste this into a Claude Code conversation with the windedvertigo monorepo mounted.

---

## context

the strategy page at `/strategy` on the port dashboard has a progress-to-target bar in the `StrategyHero` component that visualizes our path to $500k in revenue. it currently reads from a **hardcoded constant** called `REVENUE_PROGRESS` in `port/lib/strategy-data.ts`. every time a deal changes status or a new proposal lands, someone has to manually edit the file and redeploy. we need to wire this to live data.

the rest of the strategy page already uses live data — the pipeline tab reads from `fetchActivePipelineOpportunities()` which queries the `rfp_opportunities` table in supabase. but the hero bar is stuck on Phase 1 hardcoded values. the comment in strategy-data.ts literally says "Phase 2 will migrate this to Supabase." this is Phase 2.

### the two-source problem

revenue comes from two streams that don't share a pipeline:

1. **RFPs** — tracked in the Notion `rfpRadar` database (ID `685b0a16-d861-4380-b04a-f6ac276b9319`), synced to supabase `rfp_opportunities` table every ~15 min via `port/app/api/cron/sync-rfp-pilot/route.ts`. statuses: `radar`, `reviewing`, `pursuing`, `interviewing`, `submitted`, `won`, `lost`, `no-go`, `missed deadline`.

2. **relationship deals** — tracked in the Notion `deals` database (ID `7a76db3a-f9bc-4914-9fec-4873a720520d`), synced to supabase `deals` table via `port/app/api/cron/sync-deals-pilot/route.ts`. stages: `identified`, `pitched`, `proposal`, `won`, `lost`.

the progress-to-target bar uses a **revenue confidence ladder** with 5 tiers:
- **paid** — cash received (bank confirmed)
- **signed** — contract signed, payment pending
- **advanced** — verbal commit / SOW pending
- **negotiation** — active back-and-forth on terms
- **open** — proposal submitted or sitting in someone's inbox

this confidence ladder is a different axis than either the RFP pipeline stages or the deal stages. a "signed" contract may have come from an RFP that was `won`, or from a relationship deal at stage `won`. an "open" opportunity could be an RFP at status `submitted` or a deal at stage `pitched`. the hero bar needs to merge both sources through a unified confidence mapping.

## what already exists (read these files first)

| file | what it does |
|---|---|
| `port/lib/strategy-data.ts` | hardcoded `REVENUE_PROGRESS`, `REVENUE_TARGET`, `PRME_CONTRACT_TOTAL`, `PRME_RECEIVED`, `deriveRevenueTiers()`, `RevenueProgressInput` interface |
| `port/app/(dashboard)/strategy/components/strategy-hero.tsx` | renders the 5-tier progress bar. imports `REVENUE_PROGRESS` directly. only prop is `subscribers` |
| `port/app/(dashboard)/strategy/page.tsx` | server component. does `Promise.all()` of 9 data fetches. passes nothing revenue-related to `StrategyHero` |
| `port/lib/supabase/deals.ts` | supabase read/write layer for deals table. exports `getDealsFromSupabase()`, `upsertDealToSupabase()` |
| `port/lib/marketing/rfp-analytics.ts` | `fetchActivePipelineOpportunities()` — reads from `rfp_opportunities` supabase table |
| `port/lib/marketing/pipeline-progress.ts` | tier 1 operationalization — derives proposal count (live) and contract count (still hardcoded from `REVENUE_PROGRESS.breakdown`) |
| `port/lib/notion/types.ts` | `Deal` interface, `DealStage` type, `DealLostReason` type (lines 792-825) |
| `port/supabase/migrations/20260429_catchup_untracked_tables.sql` | deals table schema: `id`, `notion_page_id`, `deal`, `stage`, `value`, `org_ids`, `rfp_ids`, `notes`, `loss_reason`, `updated_at` |

## what to build

### 1. extend the deals table

create a new supabase migration that adds three columns to `deals`:

```sql
ALTER TABLE deals ADD COLUMN IF NOT EXISTS revenue_tier text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS received_amount numeric DEFAULT 0;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS contracted_amount numeric;
```

- `revenue_tier` — one of: `signed`, `advanced`, `negotiation`, `open`, or null (not on the revenue radar). this is the confidence-ladder mapping, set manually or via a default rule.
- `received_amount` — cash actually received (for partial-payment tracking like PRME's $48,285 of $145k).
- `contracted_amount` — the committed contract value. distinct from the existing `value` field, which is the estimated pipeline value before a deal closes. once signed, `contracted_amount` is the real number; `value` was the estimate.

also add a CHECK constraint: `revenue_tier IN ('signed', 'advanced', 'negotiation', 'open')` or null.

### 2. update the Deal type and supabase layer

in `port/lib/notion/types.ts`:
- add `revenueTier` to the `Deal` interface: `revenueTier: RevenueTier | null`
- add type: `export type RevenueTier = "signed" | "advanced" | "negotiation" | "open";`
- add `receivedAmount: number` and `contractedAmount: number | null` to the Deal interface

in `port/lib/supabase/deals.ts`:
- add `revenue_tier`, `received_amount`, `contracted_amount` to `DealRow` interface and `SELECT_COLS`
- map them in `mapRowToDeal()`
- the upsert function should already handle new columns via `Partial<DealRow>`

### 3. build `fetchRevenueProgress()`

create `port/lib/marketing/revenue-progress.ts`:

```typescript
export async function fetchRevenueProgress(): Promise<RevenueProgressInput>
```

this function merges two data sources into the `RevenueProgressInput` shape that `deriveRevenueTiers()` already accepts:

**source A: deals with a revenue_tier set**
- query supabase `deals` where `revenue_tier IS NOT NULL` and `stage != 'lost'`
- for each deal:
  - `client` = deal name
  - `amount` = `contracted_amount` if set, else `value`, else 0
  - `status` = map `revenue_tier` to the status strings that `deriveRevenueTiers()` expects:
    - `signed` → `"signed"`
    - `advanced` → `"in-progress"`
    - `negotiation` → `"negotiation"`
    - `open` → `"documentation"`
  - include `receivedAmount` for the paid/signedUnpaid split (generalize the current PRME special-case)

**source B: active RFP opportunities not already linked to a deal**
- query supabase `rfp_opportunities` where status is `pursuing`, `interviewing`, or `submitted` AND `estimated_value IS NOT NULL`
- exclude any RFP whose `notion_page_id` appears in a deal's `rfp_ids` array (to avoid double-counting — if an RFP has been converted to a deal, the deal is the source of truth)
- for each remaining RFP:
  - `client` = opportunity_name
  - `amount` = estimated_value
  - `status` = `"documentation"` (open tier — these haven't closed yet)
  - map `interviewing` RFPs to `"negotiation"` status since they're further along

**return value:**
```typescript
{
  target: REVENUE_TARGET,  // keep using the constant for now
  breakdown: [...dealRows, ...rfpRows],
}
```

**important: generalize the paid/signedUnpaid split.** currently `deriveRevenueTiers()` has a PRME special case that checks `if (amount === PRME_CONTRACT_TOTAL)` to split paid vs signed. refactor this to use `receivedAmount` from any deal row instead of hardcoding PRME. the `RevenueProgressInput` breakdown rows should include an optional `receivedAmount` field:

```typescript
interface RevenueProgressInput {
  target: number;
  breakdown: ReadonlyArray<{
    client: string;
    amount: number;
    status: string;
    detail?: string;
    receivedAmount?: number;  // new: for paid/signedUnpaid split
  }>;
}
```

then `deriveRevenueTiers()` uses `receivedAmount` (if present and > 0) to split any signed deal into paid + signedUnpaid tiers, not just PRME.

### 4. wire the hero component

in `port/app/(dashboard)/strategy/page.tsx`:
- add `fetchRevenueProgress()` to the `Promise.all()` (becomes the 10th fetch)
- pass the result to `<StrategyHero>` as a new `revenueProgress` prop
- on fetch failure, fall back to the hardcoded `REVENUE_PROGRESS` constant (graceful degradation)

in `port/app/(dashboard)/strategy/components/strategy-hero.tsx`:
- change `StrategyHeroProps` to accept `revenueProgress?: RevenueProgressInput`
- if `revenueProgress` is provided, use it. otherwise fall back to importing `REVENUE_PROGRESS`
- remove the direct import of `PRME_CONTRACT_TOTAL` and `PRME_RECEIVED` — these are now embedded in the live data via `receivedAmount`
- the `REVENUE_TARGET` import can stay (or move to the prop — your call)

### 5. update pipeline-progress.ts

`port/lib/marketing/pipeline-progress.ts` currently derives the contract count from the hardcoded `REVENUE_PROGRESS.breakdown`. update it to:
- import `fetchRevenueProgress` instead of `REVENUE_PROGRESS`
- count contracts from the live data (deals with `revenue_tier = 'signed'`)
- or even simpler: query `deals` directly where `stage = 'won'` (this is a count, not the full breakdown)

### 6. seed the existing deals

create a one-time seed script or migration that sets `revenue_tier`, `contracted_amount`, and `received_amount` for the deals we already have:

| deal | revenue_tier | contracted_amount | received_amount |
|---|---|---|---|
| PRME 2026 | signed | 145000 | 48285 |
| Nordic — Budget A | advanced | 50000 | 0 |
| Nordic — Budget B | negotiation | 54000 | 0 |
| IDB El Salvador | open | 75000 | 0 |
| Ubongo | open | 49500 | 0 |
| ICSP — Concern Worldwide | open | 31700 | 0 |
| Amna | open | 29350 | 0 |

if these deals don't exist in the deals table yet, create them. check the Notion deals database first — some may already be tracked there and synced to supabase.

### 7. add an API route for CMO updates

create `port/app/api/deals/[id]/revenue/route.ts`:

```typescript
// PATCH /api/deals/:id/revenue
// body: { revenue_tier?, contracted_amount?, received_amount? }
```

this lets the CMO (claude in cowork) update a deal's revenue position through a simple API call without touching the codebase. the cowork session calls this endpoint, the supabase record updates, and the next page load reflects the change.

also update the existing `port/app/api/deals/[id]/route.ts` PATCH handler to accept the new fields if it doesn't already pass through arbitrary columns.

## what NOT to do

- do NOT delete the hardcoded `REVENUE_PROGRESS` constant — keep it as the fallback
- do NOT change the visual design of the hero bar or the `deriveRevenueTiers()` output shape — the rendering stays the same, only the data source changes
- do NOT modify the Notion→Supabase sync crons — the new columns are supabase-only for now (not synced from Notion properties). they're set via the API or seed script
- do NOT touch the pipeline tab or `fetchActivePipelineOpportunities()` — that's separate and already works
- do NOT create a new table — use the existing `deals` table. it's the right abstraction for "all revenue opportunities regardless of origin"

## execution order

1. read all the files listed in the table above to understand current state
2. create the supabase migration (new columns on deals)
3. update types and supabase layer
4. build `fetchRevenueProgress()`
5. refactor `deriveRevenueTiers()` to use `receivedAmount` instead of PRME special case
6. wire the hero component via page.tsx props
7. update pipeline-progress.ts contract count
8. seed existing deals with revenue tier data
9. add the API route for CMO updates
10. test locally — run `npm run dev` in the port directory and verify the hero bar renders from live data
11. commit to a branch, open a draft PR for my review
12. do NOT merge — i want to review the wiring before it goes live

## architecture notes for the developer

the key insight: `RevenueProgressInput` was designed as the abstraction boundary. everything upstream (data fetching, source merging) produces this shape. everything downstream (tier derivation, bar rendering) consumes it. the interface doesn't need to change much — just add the optional `receivedAmount` field and maybe `detail`.

the confidence ladder (`signed` → `advanced` → `negotiation` → `open`) is a **manual classification**, not something derived from pipeline stage. a deal at stage `won` is usually `signed`, but the revenue_tier field lets us override — maybe it's won but the contract hasn't been countersigned yet (so it's `advanced`, not `signed`). this manual control is intentional.

the `deals` table is the unification point because every revenue opportunity becomes a deal eventually:
- an RFP that's won → a deal with `rfp_ids` linking back
- a relationship gig like Nordic → a deal with no rfp_ids
- a harbour subscription → could be a deal too (future)

RFP opportunities that haven't converted to deals yet still show up in the bar through source B of the fetch function, but they're always in the open tier until someone creates a deal and sets a higher confidence tier.
