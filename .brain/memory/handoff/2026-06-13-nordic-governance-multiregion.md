# Handoff — 2026-06-13 — Nordic: Governance Persistence + Multi-Region

**Branch:** `feat/governance-persistence-and-multiregion`  
**Cut from:** `feat/budget-c-and-gates-preview` (inherits all governance + persistence wiring)  
**Status:** All three tasks complete. Ready for Garrett's review. **Do NOT push to main.**

---

## What was built

### GAP 1 — Persist governance layer to Supabase ✅
Already done on `feat/budget-c-and-gates-preview` (migration 018, `pcs-review-events.js`, API routes wired). This branch adds:
- `deriveGateStatus(events[])` — pure function in `review-gate.js` that replaces inline derivation; drives testable persistence round-trip verification
- `verify:review-gate` extended: 106 tests (was 97), 9 new `deriveGateStatus` tests

### GAP 2 — Surface ReviewStatusBadge on detail pages ✅
- Claim detail (`/research/pcs/claims/[id]/page.js`) — badge + fetch wired
- Canonical-claim detail (`/research/pcs/canonical-claims/[id]/page.js`) — badge + fetch wired  
- Evidence detail was already done on prior branch

### NEW — Multi-region / multi-authority dimension ✅
- `CLAIM_AUTHORITY_REGIONS` constant in `pcs-config.js` (FDA, EFSA, Health Canada, TGA, FSANZ, Japan MHLW)
- Migration `20260613000002_019_claim_authority_regions.sql` — `authority_regions TEXT[]` + GIN index on `pcs_claims`
- `pcs-claims.js` — parses `authorityRegions` from both Postgres and Notion paths
- `pcs-explorer.js` — `filterByRegion(rows, region)` exported; all 3 query functions accept `{ region }` option
- `GET /api/pcs/explore` — accepts `region` param, passes to query functions
- `/research/pcs/explore` — authority/region selector dropdown, "Authorities" column in ExplorerTable, auto-re-queries when region changes
- `tests/pcs-explorer.verify.mjs` — new file, 23 tests; added to `verify:all`

---

## Test status
```
verify:review-gate  → 106 passed, 0 failed
verify:pcs-explorer → 23  passed, 0 failed
verify:all          → green (all existing + new)
```

---

## What's NOT done (intentional deferrals)
- **`authority_regions` data backfill** — schema exists but all rows are empty `{}`. Research team (Sharon, Gina, Adin, Lauren) to populate via manual review. Flagged in TASKS.md.
- **Supabase migrations** — both migration files need to be applied to the live DB after Garrett reviews the branch. They've been run against local dev only.
- **Governance toggle ON** — still ships OFF (`governanceEnabled: false`). Garrett flips it after the leadership demo.

---

## Files changed on this branch (delta from feat/budget-c-and-gates-preview)
- `src/lib/review-gate.js` — added `deriveGateStatus()` export
- `src/lib/pcs-review-events.js` — `getRecordGateStatus` now delegates to `deriveGateStatus()`
- `src/lib/pcs-config.js` — added `CLAIM_AUTHORITY_REGIONS` + `authorityRegions` to PROPS.claims
- `src/lib/pcs-claims.js` — `parsePostgresRow` + `parsePage` map `authorityRegions`
- `src/lib/pcs-explorer.js` — `filterByRegion()` export + `{ region }` option on all 3 query fns + `buildRow` includes `authorityRegions`
- `src/app/api/pcs/explore/route.js` — accepts `region` query param
- `src/app/research/pcs/explore/page.js` — region selector UI + Authorities column
- `src/app/research/pcs/claims/[id]/page.js` — ReviewStatusBadge wired
- `src/app/research/pcs/canonical-claims/[id]/page.js` — ReviewStatusBadge wired
- `supabase/migrations/20260613000002_019_claim_authority_regions.sql` — new migration
- `tests/review-gate.verify.mjs` — 9 new `deriveGateStatus` tests (+ import)
- `tests/pcs-explorer.verify.mjs` — new file
- `package.json` — `verify:pcs-explorer` script + added to `verify:all`
- `.brain/TASKS.md` — new section for this branch
