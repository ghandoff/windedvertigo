# Budget C Preview — Super-User-Gated Marketing Intelligence Interface

**Build prompt for the Nordic Research Platform (apps/nordic-sqr-rct) Claude Code session.**
Author: winded.vertigo · Date: 2026-06-13 · Status: ready to implement

---

## 0. TL;DR

Build a **preview** of the Budget C "holy grail" — a marketing-facing query interface — **gated so only super-users (Garrett, August) can see it.** This lets us demo it to Sharon without exposing it to the Nordic org or giving her team full access until the Addendum B (Budget C) payment lands. Reuse the existing evidence + claims + canonical-claims data; do **not** build a new data model. Every AI-assisted output must pass a human review/sign-off gate (the FDA-accountability principle — see §2). Work on a **feature branch** and do **not** push to `main` until Garrett reviews (push auto-deploys to `nordic.windedvertigo.com`).

---

## 1. Why we're building this

Nordic's VP is evaluating outside tools (e.g. Ingredient AI) partly because they ship a "regulatory-affairs agent." Our differentiator is **not** an autonomous agent — it's a governed, evidence-traceable, human-reviewed system that *buttresses* the (slow, under-resourced) RA function instead of creating unaccountable liability. This preview makes that tangible: Sharon can see the end-state interface running on our real PCS data, behind a gate, before any money changes hands.

This is the **spine** of Budget C: the query interface + substantiation status + dossier export. It is **not** the full Ingredient-AI surface (formula generation, supplier/competitor, agentic research) — that's Budget D / 2027 and is explicitly out of scope here (§7).

## 2. Non-negotiable guardrails

1. **Super-user-only visibility.** Nothing in this build may be visible or reachable by Nordic roles (`admin`, `researcher`, `ra`, `reviewer`, `pcs*`) yet. Gate at three layers: nav, route, and server (see §3).
2. **Expert-in-the-loop on every AI/derived output.** No claim text, dose, or dossier is presented as authoritative without a visible "review required / signed off by [user]" state. We never imply the system is the source of truth. This is the direct lesson from the FDA case Sharon raised: accountability falls on Nordic, so an expert must sign off. (Automation is assistive — experts keep the option to review, correct, or enter by hand.)
3. **Read-only against existing data.** Reuse the Notion/Supabase `pcs-*` helpers and the evidence/claims/canonical-claims resources. Do not create new tables or mutate the data model.
4. **Don't leak via deploy.** Push to `main` auto-deploys (`.github/workflows/deploy-nordic.yml`). Build on a feature branch; the super-user gate is the safety net even once merged.
5. **Follow house conventions** in `apps/nordic-sqr-rct/CLAUDE.md` (auth scopes, caching headers, `verify:*` tests, `.brain/handoff.md` + `.brain/TASKS.md`).

## 3. Access & gating model (use what exists)

The role/capability plumbing already exists — use it, don't reinvent:

- **Capabilities:** `src/lib/auth/capabilities.js` defines `SUPER_USER_CAPS`, the per-role capability map, and `SUPER_USER_ONLY_CAPABILITIES`. `src/lib/auth/require-capability.js` enforces server-side.
  - Add a new capability, e.g. `pcs.market-explorer:view` (and `pcs.dossier:export`), to `SUPER_USER_CAPS` and to the `SUPER_USER_ONLY_CAPABILITIES` set so no other role can be granted it yet.
- **Nav gating (UX):** use `hasAnyRole(user, ['super-user'])` from `src/lib/auth/has-any-role.js` to conditionally render the new sidebar entry in `src/components/pcs/PcsNav.js` / the `RoleAwareSidebar`.
- **Route gating:** wrap the new page(s) in `RoleRoute requires={['super-user']}` (see `src/app/research/pcs/layout.js` for the pattern).
- **Server gating:** every new API route calls `requireCapability('pcs.market-explorer:view')` (or the dossier capability). Per CLAUDE.md, server-side authz must re-verify — never trust JWT/nav gating alone.
- **Optional time-boxed preview for Sharon:** if we later want Sharon to click around herself (vs. Garrett driving a demo), add her account to a single named allow-list constant (e.g. `PREVIEW_ALLOW_LIST = ['smatheny@nordicnaturals.com']`) checked alongside the super-user capability — one line to add, one line to remove after payment. Default to **off**; Garrett demos as super-user first.

## 4. What to build (the spine)

### 4.1 Marketing Intelligence Interface — `/research/pcs/explore`

A query page with **three lenses** (mirrors both Lauren's CAIPB dashboards and Ingredient AI's structure):

- **By Benefit Category** → "Which products/ingredients support [Eye Health]?" Returns products + ingredients + the substantiating claims.
- **By Ingredient** → "What can [magnesium] support, and at what dose?" Returns benefit categories, claims, and minimum dose per claim.
- **By Product** → "What claims can [product] make?" Returns claims, benefit categories, doses, and PCS references.

**Results table columns:** Claim · Ingredient / Dose · Benefit Category · Evidence (# supporting studies) · **Substantiation Status** (see 4.2) · PCS reference (link to the evidence/claim detail page).

Implementation notes:
- Build the read queries on top of existing `pcs-*` Notion/Supabase helpers + the evidence↔claims relationships. If a clean join doesn't exist yet, add a thin read-only query helper in `src/lib/` (e.g. `pcs-explorer.js`) — do not alter the data model.
- Honor the existing caching pattern (GET `revalidate` + `s-maxage`) and add a `loading.js` skeleton consistent with `src/components/Skeletons.js`.
- Free-text + faceted entry is fine; start with the three structured lenses before any natural-language parsing.

### 4.2 Substantiation Status indicator (transparent, not a black box)

For each claim, compute a status — **Supported / Thin / Unsupported** — from **evidence count + SQR-RCT study-quality scores** already in the platform. Show the inputs on hover/expand (e.g. "3 RCTs, mean SQR-RCT 0.82"). This is our defensible answer to Ingredient AI's opaque "Risk Score": same idea, but auditable and grounded in our own quality methodology. Keep the thresholds in one config constant so they're easy to tune with Sharon.

### 4.3 Substantiation Dossier export (human-gated)

Given a claim (or a product's claim set), generate a **Substantiation Dossier**: claim → linked evidence → studies (with SQR-RCT scores) → PCS document references. Use the libraries already in `package.json` (`docx` and/or `pdf-lib`). 

**Mandatory:** the export carries a review/sign-off block — it cannot be generated as "final" without a named human sign-off, and unsigned exports are watermarked "DRAFT — pending review." This is the RA buttress, not an RA replacement.

### 4.4 Sidebar entry

Add a single super-user-only nav item ("Explore" / "Marketing Intelligence") to the PCS sidebar, visible only when `hasAnyRole(user, ['super-user'])`.

### 4.5 Multi-region / multi-authority (pulled into the spine — Decision A, 2026-06-13)

A region/authority selector (e.g. FDA / EFSA / Health Canada / TGA) on the explore interface, with per-region filtering of which claims/doses are permissible. **Dependency:** this needs a region-applicability attribute on claims (which authorities a claim is valid under), captured in the data model — confirm it's set during Phase 2 ingestion; if absent, build the selector + schema and leave the data to be backfilled. Keep the heavy ongoing *change-monitoring* of evolving authority rules in Budget D.

### 4.6 CAIPB dashboards (browse mode — Sharon's Smartsheet reference)

The Explore tool (§4.1) is the *query* mode. CAIPB is the *browse* mode Sharon already knows from Lauren's Smartsheet (CAIPB = Claims · Active Ingredients · Products · Benefit Categories) — three cross-linked dashboards, built from the existing PCS data (the ingredient detail page `/research/pcs/ingredients/[id]` is a partial starting point — it already has Forms+Source and a Products section):

- **Per-ingredient dashboard** (model: the Magnesium dashboard): a "# of products containing this ingredient" stat; a Forms & Their Sources table (AI Form → AI Source → FM PLM#); a Benefit Categories Supported panel; a Form Usage (%) chart across the products that contain it; and a Form(s) Used by Each Product table (Product → AI Form → FM PLM# → PCS doc ID + version).
- **Per-benefit-category dashboard:** the products and ingredients that support the benefit, with their substantiating claims.
- **Per-product dashboard:** the claims the product can make, its ingredients/forms/doses, and its PCS document.
- The three cross-link (ingredient ↔ product ↔ benefit), directly replacing the manual CAIPB Smartsheet. Reuse existing endpoints (`/api/pcs/ingredients/[id]/products`, `/api/pcs/benefit-categories`, `/api/pcs/ingredient-forms`, `/api/pcs/dashboard`); add what's missing (form-usage rollup; per-product form/FM PLM#/PCS-doc-version join). Super-user-gated like the rest of the preview; add verify coverage.

## 5. Conventions & housekeeping

- Read `apps/nordic-sqr-rct/CLAUDE.md` first; match the `pcs.<resource>:<action>` capability-scope pattern and the caching approach.
- Add a `verify:market-explorer` script under `tests/` following the existing `verify:*` pattern (assert the gate denies non-super-users, and the status thresholds compute correctly), and wire it into `verify:all`.
- Update `.brain/handoff.md` and `.brain/TASKS.md` (monorepo root) as you go.
- Branch: `feat/budget-c-market-explorer-preview`. **Do not push to `main`** until Garrett reviews — push triggers auto-deploy.

## 6. Acceptance criteria

- [ ] A super-user sees an "Explore" entry; all other roles see nothing and get 403 on the routes/APIs.
- [ ] All three lenses return correct, complete results against real PCS data.
- [ ] Each claim shows a transparent Supported/Thin/Unsupported status with its inputs visible.
- [ ] Dossier export produces a docx/PDF that is watermarked DRAFT until a named human signs off.
- [ ] `npm run verify:market-explorer` passes; `verify:all` still green.
- [ ] Nothing is reachable by Nordic roles; nothing pushed to `main` without review.

## 7. Explicitly OUT of scope (Budget D / 2027 — do not build)

- AI formula generation / NPD
- Supplier & competitor intelligence
- Agentic literature-research engine, auto-summaries, living reviews
- Multi-region regulatory mapping/monitoring
- Org-wide / public access (stays super-user-gated until payment)

---

*Companion business context: see the Notion docs "Phase 3 Scope Estimate (Addendum B) — Marketing Intelligence Interface" and the brief `ingredient-ai-teardown-and-nordic-fit-brief.md`. Capability coverage is tracked in `docs/ingredient-ai-coverage-matrix.md` (the anti-drift source of truth).*
