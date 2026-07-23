# Handoff: CAIPB Dashboards + Authority Regions Editor
**Branch:** `feat/caipb-dashboards`
**Date:** 2026-06-13
**Commit:** 6bb161a

---

## What was built

### PART 1 — CAIPB Dashboards (browse mode, super-user-only)

Three cross-linked dashboards replacing Lauren's CAIPB Smartsheet (Claims · Active Ingredients · Products · Benefit Categories):

**Hub**: `/research/pcs/caipb`
- Three search dropdowns (ingredient / benefit category / product) → navigate to detail dashboard
- Loads options from `/api/pcs/explore` (no params = returns picker options)
- Added "CAIPB Dashboards" link to "Marketing Intelligence ✦" sidebar group in `sidebar-items.js`

**Ingredient dashboard**: `/research/pcs/caipb/ingredient/[id]`
- Stats: # products, # distinct forms, # claims (region-filtered)
- Forms & Their Sources table: AI Form → Ingredient Source → FM PLM# (unique combos from formula lines)
- Benefit Categories Supported panel with claim counts, cross-linked to benefit dashboard
- Form Usage % bar chart (computed from formula lines: count each `aiForm`, % of total products)
- Products table: Product name → AI Form → FM PLM# → Dose → PCS Doc (cross-linked to product dashboard and PCS document)
- Claims section (region-filterable)
- Region selector (uses `CLAIM_AUTHORITY_REGIONS` from pcs-config.js)

**Benefit dashboard**: `/research/pcs/caipb/benefit/[id]`
- Stats: filtered claims, ingredient count, total claims
- Ingredients panel with claim counts, cross-linked to ingredient dashboard
- "Open in Explorer" link to `/research/pcs/explore?lens=benefit&id=...`
- Claims list with authority chips, dose, ingredient cross-link

**Product dashboard**: `/research/pcs/caipb/product/[id]`
- Stats: total claims, active ingredient count, version count
- Formula lines table (latest version): AI → AI Form → FM PLM# → Dose → Source
- Claims grouped by benefit category (cross-linked), with authority chips
- PCS version history table
- "Open PCS Doc →" link to `/research/pcs/documents/[id]`

### PART 2 — Authority Regions Editor + Display

**`src/lib/pcs-claims.js`**: Added `authorityRegions` to `updateClaim()` — writes `multi_select` to Notion. Postgres write already worked via the stub row pattern (camelCase → snake_case auto-conversion).

**`/api/pcs/claims/[id]` PATCH**: Added `authorityRegions` validation against `CLAIM_AUTHORITY_REGIONS` (array, valid values only).

**`/research/pcs/claims/[id]` claim detail page**:
- Read-only authority chips display always shown (below Evidence Items in Status section)
- `AuthorityRegionsEditor` component: chip-toggle for each authority in `CLAIM_AUTHORITY_REGIONS`, "Save Regions" button, audited via PATCH → `updateClaim()`
- Gated to `canWrite` (researcher/ra/admin/super-user). Super-users also have this.

---

## New API routes

| Route | Capability | Notes |
|-------|-----------|-------|
| `GET /api/pcs/caipb/ingredient/[id]` | `pcs.market-explorer:view` | Ingredient + formula lines + claim rows + form usage rollup |
| `GET /api/pcs/caipb/benefit/[id]` | `pcs.market-explorer:view` | Benefit category + claims + ingredient aggregation |
| `GET /api/pcs/caipb/product/[id]` | `pcs.market-explorer:view` | Document + versions + formula lines (latest) + claim rows |

All three accept `?region=<authority>` for region-aware filtering.

---

## New files

```
apps/nordic-sqr-rct/
  src/app/api/pcs/caipb/
    ingredient/[id]/route.js
    benefit/[id]/route.js
    product/[id]/route.js
  src/app/research/pcs/caipb/
    page.js                   (hub)
    ingredient/[id]/page.js
    benefit/[id]/page.js
    product/[id]/page.js
  tests/caipb.verify.mjs      (22 tests, all pass)
```

## Modified files

```
apps/nordic-sqr-rct/
  package.json                 verify:caipb + verify:all extended
  src/lib/pcs-claims.js        authorityRegions → multi_select Notion write in updateClaim()
  src/app/api/pcs/claims/[id]/route.js    authorityRegions validation
  src/app/research/pcs/claims/[id]/page.js  AuthorityRegionsEditor + authority chips display
  src/components/sidebar/sidebar-items.js   CAIPB Dashboards added to Marketing Intelligence ✦
```

---

## Tests

```
verify:caipb — 22 passed, 0 failed
verify:all   — all 396 tests pass across 14 suites
```

---

## Key design decisions

**FM PLM# surfaced**: The existing `/api/pcs/ingredients/[id]/products` endpoint omitted `fmPlm`. CAIPB APIs call `getFormulaLinesForIngredient()` directly (which includes `fmPlm` from Postgres) and do the version→document join themselves, matching the same pattern already used in the products endpoint.

**Form usage rollup**: Pure client-side computation from formula lines array — no new DB query. Count occurrences of each `aiForm`, divide by total line count.

**`buildExplorerIndex()` reuse**: All three CAIPB API routes reuse `queryByIngredient`, `queryByBenefitCategory`, `queryByProduct` from pcs-explorer.js, which cache-share the underlying `buildExplorerIndex()` call. No extra DB load.

**Authority editor gating**: `canWrite = hasAnyRole(user, ROLE_SETS.PCS_WRITERS)` which covers researcher/ra/admin. Super-users also get this via `can(user, 'pcs.claims:edit')`. The editor is on the claim detail page, not behind a super-user wall.

---

## Intentional deferrals

- **`authority_regions` data**: All schema and editor are in place. Research team (Sharon, Gina, Adin, Lauren) needs to manually select authorities per claim via the chip editor on claim detail pages. No automation planned — this is deliberate editorial judgment.
- **Products list in benefit dashboard**: Currently surfaces `pcsVersionId` counts as a proxy for products (no full version→document join in the benefit route). Could be improved by loading `getAllVersions()` + `getAllDocuments()` to show finishedGoodName, but deferred to keep the benefit route lean.
- **Recharts for form usage**: Used a pure CSS progress bar instead of the `recharts` library (already in package.json) to avoid hydration complexity. Could upgrade to a proper bar chart later.

---

## Push + deploy instructions

```bash
# DO NOT push to main (auto-deploys to nordic.windedvertigo.com)
# Garrett reviews first, then:
cd ~/Projects/windedvertigo
git push origin feat/caipb-dashboards
# After Garrett approves: merge to main, then:
./scripts/deploy-nordic.sh
```
