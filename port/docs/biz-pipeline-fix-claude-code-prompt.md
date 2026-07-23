# Claude Code task — fix Biz↔RFP Lighthouse sync + set the canonical architecture

## Context
winded.vertigo runs a BD pipeline ("RFP Lighthouse") with two layers that have drifted apart:
- **RFP Lighthouse**: a Notion "RFP radar" database (data source `collection://685b0a16-d861-4380-b04a-f6ac276b9319`) + a Next.js dashboard at `port.windedvertigo.com/opportunities` (the Kanban board). This is what renders.
- **Biz connector**: an MCP server exposing `biz_set_bid_decision`, `biz_log_outcome`, `biz_list`, `biz_go_no_go`, etc. It writes to a canonical `rfp_opportunities` store and is supposed to mirror status into the board's data source.

## Observed bug (reproduced this session)
1. `biz_set_bid_decision(rfp_id, decision='bid')` returns `"recorded: bid → moved to pursuing"`. The **decision fields persist** (bid_decision, score, reason, debrief).
2. But the **status change does NOT durably persist**: minutes later, both `biz_list('radar')` and the live board show the card **back in `radar`**. ~10 cards I moved (bids + no-gos + defers) all reverted. The board briefly reflected the move, then a refresh showed `radar 16 / pursuing 6` — roughly the pre-change state.
3. Several cards show `"draft failed — retry?"` — the auto-proposal-generation that fires on `pursuing` is also failing.

## Hypotheses to confirm in the repo (don't assume — verify)
- (A) `set_bid_decision` writes status to a different store/table than the board reads, so the board never truly updates.
- (B) The board reads the Notion mirror; `set_bid_decision` updates the canonical store but NOT Notion, so a sync reverts it.
- (C) The feed ingest job ("sync feeds" / RSS re-ingest) re-writes `status='radar'` on existing rows on every run, clobbering human + Biz changes.
- (D) The auto-draft generator throwing on the `pursuing` transition rolls back the whole transaction, reverting status.

## Phasing (decided)
**Phase 1 — interim fix first, so the board stops lying.** Do tasks 1, 2, 4, 5, 7 against the *current* store (Notion-backed) — diagnose and fix the status-persistence + feed-clobber + failed-auto-draft bugs so a drag and a Biz decision both stick and survive refresh/sync. No migration yet.
**Phase 2 — migrate the database to Supabase** (task 3) once Phase 1 is stable: move pipeline/CRM data to Postgres, repoint the board to read it live, demote Notion to a drafting surface. Then task 6 (artifact layer + canonical hub) is wired to Supabase.

## Tasks
1. **Diagnose**: trace the full write path for a status change from (a) a manual board drag and (b) `biz_set_bid_decision`. Identify exactly where the two diverge and why the status doesn't stick. Confirm which hypothesis (A–D) is correct; fix the actual root cause.
2. **One source of truth + one transition path**: make BOTH a manual drag and a Biz status change go through the **same** state-transition function against the **same** store. A drag and `biz_set_bid_decision` must produce identical persisted status + identical side-effects.
3. **Recommended target store = Supabase (Postgres)** for pipeline/CRM data (opportunities, status, decisions, scores). Reasons: SQL-queryable with no Enterprise/AI gate (Notion's `query_data_sources` is gated behind Enterprise+Notion AI, which blocks programmatic enumeration today), a Supabase MCP exists for direct agent queries, and it gives one relational source of truth. Migrate the board to read Supabase live; demote Notion to a **drafting surface** (see task 5), not the database. If a full migration is out of scope now, at minimum make the existing sync bidirectional and idempotent so status changes are never clobbered.
4. **Make feed ingest non-destructive**: the RSS/"sync feeds" job must only INSERT new opportunities or update content fields — it must NEVER reset `status`, `bid_decision`, `score`, or decision fields on rows a human or Biz has already triaged. Add a guard/test for this.
5. **Proposal drafts stay in Notion (Lighthouse), with explicit review states**: keep auto-gen drafts as Notion subpages on the deal. Fix the failing auto-generation. Model the review lifecycle as first-class states: `auto-generated (draft 1) → biz-reviewed (draft 2) → human-reviewed (draft 3) → approved → exported`. On `approved`, export the draft to an organized Google Drive / Projects path (see task 6) as DOCX/PDF for final layout in Docs → InDesign/Canva.
6. **Human-browsable artifact layer**: maintain an organized file tree (Google Drive or the local Projects folder) keyed by **client → opportunity → documents**, so a person can click and open the produced files. Keep it in sync with the pipeline records (each opportunity row links to its Notion draft + its Drive/Projects artifact folder). Also create a **canonical Notion hub page** ("Proposals & Deliverables") indexing every active deal → its draft subpages → its exported artifact links.
7. **Decision capture preserved**: ensure Biz's decision/score/reason/debrief continue to persist alongside status, and surface them on the board card (so a reviewer sees *why* a tile moved, not just that it did).

## Acceptance criteria
- Moving a card via drag OR via `biz_set_bid_decision` persists identically and survives a page refresh and a feed-sync run.
- `biz_list('radar')` and the board always agree.
- Running "sync feeds" never reverts a triaged card's status/decision.
- Dragging to `pursuing` reliably generates the Notion draft (no "draft failed").
- On approval, an artifact file appears in the client-organized Drive/Projects tree and is linked from the canonical Notion hub.
- A short README documents the final architecture (where pipeline data lives, where drafts live, where artifacts live, and the one transition path).

## Phase 1.5 — Board UX (do alongside Phase 1, same session)
1. **Deferred leaves radar.** Radar must mean "new, untriaged" only. Rename the `reviewing` status column to **`Deferred`** (it's currently always empty, safe to repurpose) — or add a distinct `deferred` status if preferred. Route `biz_set_bid_decision(decision='deferred')` to set status = Deferred (not leave it on radar). The card in this column must surface the **defer reason** and **revisit date**. Target flow: `radar (new) → Deferred (on hold, reason+date shown) → pursuing → submitted → won/lost`. Live test cases currently mis-filed in radar: WOVEN Kenya (`386e4ee7-4ba4-8189-bec7-efb12b488d4e`), Farmer Visibility Kenya (`386e4ee7-4ba4-81ac-87b1-cced253a2cd5`).
2. **Won contracts show revenue + celebration.** Bug: the "Revenue won" tile reads $0/blank even though won opportunities have a contract value (e.g. Amna "at 10", signed 12 Jun, value now set to $25,000 / £20,000) — so the tile isn't wired to sum won-stage values. Fix: (a) wire the Revenue-won tile to sum the contract value of all `won` opps; (b) add a **Wins view** (gallery/board of won contracts: partner · value · signed date); (c) celebration hook — when an opp flips to `won`, post to Slack `#whirlpool` via the team bot.
3. **Metric tile tooltips.** Add hover tooltips to each top tile with these definitions:
   - **Active pipeline** — count of live opps (radar/deferred/pursuing/submitted/interviewing); excludes won/lost/no-go.
   - **Pipeline value** — raw unweighted sum of estimated contract value across active opps. A ceiling if everything won; not a forecast.
   - **Weighted pipeline** — sum of (value × win-probability) per opp; the honest expected value to plan against. (= roadmap BIZ-F1.)
   - **Revenue won** — sum of contract value of opps marked won.
   - **Win rate** — won ÷ (won + lost); % of decided bids won.

## Notes
- Stack is Cloudflare (TOR files on R2; two D1 DBs exist but are empty — not the pipeline store). Confirm where `rfp_opportunities` actually lives today before migrating.
- Don't break existing `biz_*` MCP tool signatures; extend behaviour behind them.
- Win-probability source for weighted pipeline: use the formula win-% already shown on cards (later calibrate via roadmap BIZ-I2).
