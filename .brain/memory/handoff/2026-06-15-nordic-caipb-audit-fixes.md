# Handoff: CAIPB Audit + Fixes
**Branch:** `feat/caipb-audit-fixes` (cut from `main`)
**Date:** 2026-06-15
**Status:** committed to feature branch; NOT pushed. Awaiting Garrett review.

---

## Why this branch exists

The task was to *build* the CAIPB dashboards + multi-region editor. On inspection
they were **already built and merged to `main`** (commit `6bb161a` 2026-06-13, visual
packages `98e6e63`). Rather than rebuild, Garrett chose an **audit vs spec** (§4.5/§4.6),
then asked me to fix what the audit surfaced. This branch is that fix set.

The original work passed 22/22 tests and met most of the spec. The audit found one
material deviation and three minor gaps — all now addressed.

---

## Findings → fixes

### 1. Material: authority_regions edit was NOT audited
- **Was:** `PATCH /api/pcs/claims/[id]` wrote `authorityRegions` via the raw
  `updateClaim()` — no actor, no revision row. The 2026-06-13 handoff even *claimed*
  it was "audited via PATCH → updateClaim()", but `updateClaim` does not log.
  §4.5 required the edit be routed through the expert-review/audit path so
  *who set the regions and when* is captured.
- **Now:** the PATCH splits `authorityRegions` out and routes it through the audited
  `updateClaimField()` → `mutate()` → PCS Revisions log, with `actor` derived from
  `auth.user` (same pattern as `/api/admin/pcs/claims/[id]`). Other inline fields keep
  their existing bulk path. `authorityRegions` added to the `updateClaimField` allowlist
  with array + subset validation.
- Files: `src/lib/pcs-claims.js`, `src/app/api/pcs/claims/[id]/route.js`

### 2. Minor: ingredient product table missing PCS doc *version*
- §4.6 wants "PCS doc ID **+ version**". The ingredient API joined version→doc but
  discarded the version label.
- **Now:** API surfaces `pcsVersion`; the "Form(s) Used by Each Product" table has a
  Version column.
- Files: `src/app/api/pcs/caipb/ingredient/[id]/route.js`, `…/research/pcs/caipb/ingredient/[id]/page.js`

### 3. Minor: benefit dashboard didn't show products at all
- §4.6 per-benefit dashboard wants "products **and** ingredients that support it".
  The benefit API returned products as a bare `pcsVersionId` proxy (its own JSDoc
  promised `{id,name,pcsId,claimCount}`), and the **page never rendered products**.
- **Now:** benefit API joins version→document (dedupes versions of the same product),
  returning labeled products; the page has a Products stat + a "Products Supporting
  This Benefit" panel cross-linking to the product dashboard.
- Files: `src/app/api/pcs/caipb/benefit/[id]/route.js`, `…/research/pcs/caipb/benefit/[id]/page.js`

### 4. Minor: pure super-user couldn't see the editor
- UI gate `ROLE_SETS.PCS_WRITERS` excluded `super-user`, so a user with only the
  `super-user` role didn't see `AuthorityRegionsEditor` (server allowed the write).
- **Now:** `super-user` added to `PCS_WRITERS` and `PCS_ANY`.
- File: `src/lib/auth/has-any-role.js`

### 5. Verify coverage (spec required: rollups + region filtering + editor gate)
- `tests/caipb.verify.mjs` extended 22 → **38** tests: benefit product aggregation
  (label/dedupe/fallback), the backfill editor **gate** (role enforcement via
  `can()` for researcher/ra/admin/super-user yes; reviewer/pcs-readonly no),
  `PCS_WRITERS` includes super-user, and source-guards proving the audited write
  path + dashboard enrichment are wired.

---

## Tests
```
verify:caipb — 38 passed, 0 failed
verify:all   — 31 / 106 / 23 / 38 across suites, all pass
```

## Known pre-existing lint (NOT introduced here, out of scope)
- `benefit/[id]/page.js:228` — `react-hooks/set-state-in-effect` (existing `useEffect(load)`)
- `ingredient/[id]/page.js:462` — `react/no-unescaped-entities` (existing apostrophe)
Both exist on `main`; my diff does not touch those lines.

## Still deferred (unchanged)
- **authority_regions DATA** is still empty by design — Research team populates it via
  the (now-audited) editor. See [[project_pcs_teams]].

## Process note
The original CAIPB work landed on `main`, contrary to the "do not push to main" rule
(see [[feedback_push_deploy_verify]] / [[project_github_backup_incident_2026_06]]).
This fix branch stays off main pending review.

## Push instructions
```bash
# DO NOT push to main (auto-deploys to nordic.windedvertigo.com)
cd ~/Projects/windedvertigo
git push origin feat/caipb-audit-fixes   # only after Garrett reviews
```
