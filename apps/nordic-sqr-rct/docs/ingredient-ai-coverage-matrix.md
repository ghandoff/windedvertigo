# Ingredient AI → Nordic Platform — Coverage & Traceability Matrix

**This is the living anti-drift tracker.** Every Ingredient AI capability from the teardown brief is listed here with where it currently lives in the plan. **Update this whenever a capability moves between spine / add-on / Budget D.** The two build prompts and the Budget C scope estimate reference this file.

Source brief: `ingredient-ai-teardown-and-nordic-fit-brief.md` · Plan doc: Notion "Phase 3 Scope Estimate (Addendum B)" · Last synced: 2026-06-13.

## Coverage

| Ingredient AI capability | Teardown call | Current home | Status |
|---|---|---|---|
| Claims table (claim · ingredient/dose · benefit · # studies) | Mirror | Budget C — Module D | ✅ Covered |
| Per-claim Risk Score | Mirror | Budget C — as transparent "Substantiation status" (SQR-RCT-derived) | ✅ Covered (adapted) |
| Three-lens query (ingredient / benefit / product) — *search mode* | Mirror | Budget C — Module D (`/explore`) | ✅ Built |
| **CAIPB dashboards** — *browse mode* (per-ingredient/benefit/product: # products, Forms→Source→FM PLM#, Benefit Categories Supported, Form Usage % chart, per-product→PCS-doc/version table) | Mirror (Sharon's CAIPB Smartsheet) | Budget C — Module D | ❌ Not built; **never in prompts (now added)** |
| Multi-region / multi-authority regulatory selector | Mirror (near-term) | **Budget C — Module D (pulled forward)** | ◻️ In scope, not yet built |
| Ingredients agentic research | Adapt | Budget D | ⚠️ Decision B |
| Marketing Claims agentic research | Adapt | Budget D | ⚠️ Decision B |
| Regulation agentic research (compare authorities) | Adapt | Budget D | ⚠️ Decision B |
| Studies agentic research | Adapt | Budget D | ⚠️ Decision B |
| Substantiation Dossier generation | Adapt | Budget C — Module D | ✅ Covered |
| Facts panels / Formula Card / Product Spec / Raw Materials Spec | Defer | Budget D | ✅ Parked (now captured) |
| Private Garden (proprietary study upload) | Adapt | Budget C — Module E + Evidence Library | ✅ Covered |
| Formula generation (NPD) | Defer | Budget D | ✅ Deferred |
| Suppliers module | Defer | Budget D | ✅ Deferred |
| Competitors module | Defer | Budget D | ✅ Deferred |
| Project product-workspaces | Defer | Budget D | ✅ Parked (now captured) |
| Attributes / Sourcing & Sustainability / Emerging Trends tabs | Defer | Budget D | ✅ Parked (now captured) |

## Nordic-specific additions (our differentiators — beyond Ingredient AI)

| Capability | Current home | Status |
|---|---|---|
| SQR-RCT study-quality scoring feeding substantiation status | Budget A + Budget C | ✅ |
| Expert-in-the-loop gates with configurable modes (incl. human-first + AI-verify) | Module E gate + `expert-in-the-loop-gates-build-prompt.md` | ✅ |
| Version-controlled review history / proof-of-review (not rubber-stamp) | Module G + gates prompt §5 | ✅ |
| Rules engine + adherence dashboard + learning metrics + time-saved ROI (super-user toggle, default OFF) | Module G add-on ($12K) | ✅ |

## Open decisions (for Garrett)

**A. Multi-region regulatory. — RESOLVED (2026-06-13):** pulled into **Budget C Module D** (region/authority selector + per-region claim view). Heavy ongoing multi-authority *change-monitoring* stays in Budget D. To build: region-applicability dimension on claims + selector + per-region filtering (see the governance-persistence-and-multiregion prompt).

**B. Agentic research engine** (Ingredients / Marketing Claims / Regulation / Studies agentic search). Brief framed it as the *adapt* "intelligence layer"; it's currently in Budget D. Nordic already owns the search substrate (PubMed + Semantic Scholar + 7-tier PDF waterfall), so it's "wrap an agent around what exists." → Decision: keep in Budget D, or pull a *grounded agentic search over the governed corpus + SQR-RCT* forward as a Budget C add-on module (like Module G)? If add-on, set a rough price.

**C & D (captured, confirm only).** Facts-panel/spec generation, project workspaces, and Attributes/Sourcing tabs are now explicitly listed in the Budget D section. Confirm you're happy with them deferred there.

## Build status — reconciled against the Nordic Research Platform code session (2026-06-13)

Verified against git history + `.brain/TASKS.md`. Much of this is **already built** on feature branches (`feat/budget-c-market-explorer-preview`, `feat/budget-c-and-gates-preview`), **not pushed to main**, pending Garrett review.

**✅ Already built (ahead of / matching the prompts):**
- Budget C Marketing Intelligence Interface `/research/pcs/explore` — three lenses; results table (Claim · Ingredient/Dose · Benefit · # studies · Substantiation Status · PCS ref).
- Substantiation Status — transparent, SQR-RCT-derived, configurable thresholds, hover shows inputs.
- Substantiation Dossier export — DOCX, DRAFT watermark until a named sign-off.
- Expert-in-the-loop gate library (`src/lib/review-gate.js`) — **4 modes, default = human-first-AI-verify (Sharon's preference, already wired)**, immutable audit events, rule engine, rubber-stamp detection, correction-rate, time-saved (always flagged estimate), adherence.
- Governance / "Module G" — review queue + management dashboard `/research/pcs/governance`; **super-user toggle, ships OFF**; rules API (sets gate mode per record type); metrics API.
- Capabilities (`pcs.market-explorer:view`, `pcs.dossier:export`, `pcs.review:approve`, `pcs.review.rules:edit`, `pcs.governance:manage`) + super-user-only sidebar groups.
- Tests: `verify:market-explorer` (31) + `verify:review-gate` (97); `verify:all` green (355).

**◻️ Code session's own pending finish-work (it flagged these):**
- ~~Persist governance config + rules + audit log to Supabase~~ → **NOW BUILT** on `feat/governance-persistence-and-multiregion` (migration `018_pcs_review_gate`, append-only `pcs_review_events`, `pcs-review-events.js`; 106 tests). Remaining: run the migration on the live DB after review.
- ~~Add `ReviewStatusBadge` to claim / evidence / canonical-claim detail pages~~ → **NOW BUILT** (all three detail pages wired + `/api/pcs/review/status`).
- Process only: push branches after review; run the Supabase migrations; flip governance toggle ON after the leadership demo; add Sharon to `PREVIEW_ALLOW_LIST`; widen role access on payment.

**❌ Not built — confirmed gaps vs the brief:**
- **Multi-region regulatory** — **NOW BUILT (code)** on `feat/governance-persistence-and-multiregion` (`CLAIM_AUTHORITY_REGIONS`, `authority_regions` column + migration `019`, `filterByRegion`, region selector + Authorities column on `/explore`, 23 tests). **Only remaining: the `authority_regions` data is empty — Research team backfills which authorities each claim is valid under.**
- **CAIPB dashboards (browse mode)** — the per-ingredient/benefit/product dashboards Sharon's Smartsheet shows (Form Usage % chart, Benefit Categories Supported, per-product → PCS-doc/version table, # products). Substrate partially exists (ingredient detail page has Forms+Source+Products); the dashboard layer is **not built and was never in a prompt**. Now in Module D scope + the build prompt. This is the "browse" complement to the `/explore` query tool.
- Agentic research engine — absent (Budget D) → Decision B.
- Facts panels / specs, project workspaces, Attributes/Sourcing tabs — absent (Budget D).

**Billing note:** the governance layer ("Module G") is effectively *built and demoable* behind the OFF toggle — so the "$12K optional add-on" is now a ready-to-activate deliverable, not a future estimate. Revisit how it's framed/billed.

## Full programme reconciliation (A / B / C) — code-grounded 2026-06-13

Every row below has been **discussed**. Columns: in the **Contract** (budget doc) · in this **Matrix** · in a **Build prompt** · **Built** in code · **Remaining**. Verified against git history, route inventory, and `.brain/TASKS.md`.

### Budget A — Baseline Contract ($50K)
| Deliverable | Contract | Matrix | Prompt | Built | Remaining |
|---|---|---|---|---|---|
| Research platform architecture | ✅ | ✅ | n/a (pre-existing) | ✅ | — |
| PCS document processing workflows | ✅ | ✅ | n/a | ✅ | — |
| Relational DB schema (PCS DBs) | ✅ | ✅ | n/a | ✅ | — |
| SQR-RCT study-quality system | ✅ | ✅ | n/a | ✅ | — |
| Access / environment config | ✅ | — | n/a | ✅ | — |

### Budget B — Addendum A ($30K)
| Deliverable | Contract | Matrix | Prompt | Built | Remaining |
|---|---|---|---|---|---|
| Evidence Library (article search, 7-tier PDF, evidence + packets) | ✅ | ✅ | n/a (pre-prompt) | ✅ | — |
| Claims Library (claims, canonical, wording variants, dose reqs, standardization/dedupe queue) | ✅ | ✅ | n/a | ✅ | — |
| The Bridge (ingredient↔PCS wiring, ingredient relations, dashboard) | ✅ | ✅ | n/a | ✅ | — |
| Platform refinements / UI-UX | ✅ | — | n/a | ✅ (ongoing) | — |

### Budget C — Addendum B (spine $45K + Module G $12K)
| Deliverable | Contract | Matrix | Prompt | Built | Remaining |
|---|---|---|---|---|---|
| **Module D** — Marketing Intelligence Interface `/explore` (3 lenses, results table) | ✅ | ✅ | ✅ | ✅ | — |
| Substantiation status (transparent Risk-Score mirror) | ✅ | ✅ | ✅ | ✅ | — |
| Substantiation Dossier export (DOCX, DRAFT until sign-off) | ✅ | ✅ | ✅ | ✅ | — |
| Multi-region selector + per-region view | ✅ | ✅ | ✅ | ✅ (code) | ◻️ **data backfill** |
| **CAIPB dashboards (browse mode)** | ✅ | ✅ | ✅ | ❌ | **BUILD — `feat/caipb-dashboards`** |
| **Module E** — Data ingestion (upload, extraction, review gate, versioning, audit) | ✅ | ✅ | ✅ | ✅ | — |
| **Module F** — Training & handover | ✅ | — | n/a (docs) | ◻️ | on delivery |
| **Module G** — Expert-in-the-loop gates (4 modes, default human-first-AI-verify) | ✅ | ✅ | ✅ | ✅ | — |
| Version-controlled review history (persisted, append-only) | ✅ | ✅ | ✅ | ✅ | run migration |
| Rules engine + adherence dashboard + learning metrics + time-saved | ✅ | ✅ | ✅ | ✅ | — |
| Super-user governance toggle (default OFF) | ✅ | ✅ | ✅ | ✅ | flip ON post-demo |

### Budget D — 2027 (deferred, intentional)
| Capability | Contract | Matrix | Prompt | Built | Remaining |
|---|---|---|---|---|---|
| Agentic research engine | ✅ (Budget D) | ✅ | — | ❌ | Budget D |
| Formula generation (NPD) | ✅ | ✅ | — | ❌ | Budget D |
| Suppliers / Competitors | ✅ | ✅ | — | ❌ | Budget D |
| Facts panels / specs generation | ✅ | ✅ | — | ❌ | Budget D |
| Project product-workspaces | ✅ | ✅ | — | ❌ | Budget D |
| Attributes / Sourcing / Emerging-Trends tabs | ✅ | ✅ | — | ❌ | Budget D |
| Multi-region *change-monitoring* (ongoing) | ✅ | ✅ | — | ❌ | Budget D |

### The only true open build items (everything else is built or deferred)
1. **CAIPB dashboards** — in contract/matrix/prompt, not yet built → `feat/caipb-dashboards`.
2. **Multi-region `authority_regions` data backfill** — code built, data empty. A small gated backfill editor (so the Research team can populate it through the expert gate) is folded into the `feat/caipb-dashboards` prompt; the data entry itself remains a Research-team task.
3. **Module F training** — a delivery activity, not code.
4. **Process** — push branches, run migrations, flip toggle post-demo, widen access on payment.

## Maintenance rule

If any row's "Current home" changes, edit it here first, then propagate to the Budget C scope estimate and the relevant build prompt. This file is the single source of truth for IAI ↔ Nordic coverage.
