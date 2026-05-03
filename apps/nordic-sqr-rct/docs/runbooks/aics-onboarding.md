# AICS Onboarding — Operator Runbook (Draft)

> **Audience:** Garrett (DPO), Nordic RA (incoming hires), Nordic Research (Gina + team).
> **Status:** Draft — active build. Phase 3.1 (DDL) shipped 2026-05-03; Phase 3.2 (entity helpers + API routes) is in flight in a parallel worktree; UI + RA review queue are Phase 3.3+.
> **Last updated:** 2026-05-03

---

## What is AICS?

**AICS = Active Ingredient Claims Substantiation.** It's the upstream sibling of PCS in Nordic's regulatory document graph.

A PCS document describes a finished consumer product (e.g. "Vit D3 Children's Gummy") and its claims. An AICS document describes a single active ingredient (e.g. vitamin D3) and the body of evidence that substantiates the claims any product containing that ingredient is allowed to make.

One active ingredient → one AICS doc. So far, we have one in flight:

- **AICS-0004** — Vitamin D3 (Gina Jaeger's `AICS-0004v0.1_Vit D3 Children_RA review.docx`, shared 2026-05-01)

AICS docs are **owned and reviewed by RA**. Researchers consume them but don't author them. PCS docs link to AICS docs by reference and inherit their substantiation rather than duplicating it.

---

## Why split AICS out from PCS?

Before Bundle 3 Phase 3, every PCS doc had to re-state the active-ingredient evidence inline, even when ten different gummy SKUs all leaned on the same vitamin D3 study set. That meant:

- Ten places to update when a new study landed
- Ten chances for RA to miss one
- No single source of truth for the regulatory position on an ingredient

AICS centralizes the ingredient-level substantiation. A PCS doc for "Vit D3 Children's Gummy" inherits from `AICS-0004` **by reference**, not by copy. If the AICS evidence updates, every downstream PCS doc reflects it on next render. Multi-vitamin PCS docs reference multiple AICS docs (one per active ingredient).

---

## Document structure

Per the AICS-0004 v0.1 template (Gina's 2026-05-01 review draft), every AICS document has these sections:

### 1. Cover page

A revision history table:

| Version | Effective Date | Change Description | Responsible Department | Responsible Individual |
|---|---|---|---|---|

### 2. Table A — Applicable NN Raw Materials

The NN raw materials this AICS substantiates. Columns:

| FM PLM# | AI Source | AI Form | AI |
|---|---|---|---|

(`AI` = Active Ingredient; `FM PLM#` = Finished Material Product Lifecycle Management number.)

### 3. Table 1 — Claims & Min Dose by demographic

The core regulatory matrix. One row per claim × demographic combination:

| Claim Status | Claim # | Claim Text | Demographic | Min Dose | Grade |
|---|---|---|---|---|---|

`Grade` is the evidence grade (A/B/C) per Nordic's grading rubric.

### 4. Ingredient Safety Limits + Regulatory Review

Free-form RA narrative covering upper-limit safety thresholds, contraindications, and regulatory-body sign-off notes (FDA, Health Canada, EFSA where applicable).

---

## Demographic taxonomy harmonization

The AICS-0004 source doc used a **finer demographic split** than the platform's canonical set:

| AICS-0004 (source) | Platform canonical (Lauren Bosio, 2026-04-16) |
|---|---|
| Toddlers 1–3 | Children 1–3 |
| Children 4–8 | Children 4–12 |
| Pre-teen 9–12 | Children 4–12 |
| Teen 13–17 | Teens 13–17 |

The platform normalizes to Lauren's coarser canonical set. Lauren designated this taxonomy as the spec in her 2026-04-16 controlled-vocabulary doc, and PCS Claims and Evidence Packets already use it. Collapsing AICS to match keeps the join clean.

**Implication for RA:** when authoring an AICS doc whose source materials use the finer split, collapse rows on import. Where two finer rows have different min doses, take the **lower** of the two (most conservative for safety).

---

## Schema (Phase 3.1, shipped)

Defined in `db/migrations/003_aics_entity_ddl.sql`. Additive — no existing table altered. Tables:

| Table | Purpose |
|---|---|
| `aics_documents` | One row per AICS doc (e.g. AICS-0004). Headers: code, title, AI name, status, current version. |
| `aics_versions` | Version history per doc. Mirrors PCS Revisions DB pattern. |
| `aics_claims` | Table-1 rows: claim text × demographic × min dose × grade. |
| `aics_raw_materials` | Table-A rows: applicable NN raw materials per AICS. |
| `pcs_aics_references` | Many-to-many join. Lets a PCS doc reference one or more AICS docs. |

---

## What's wired vs. what isn't (as of 2026-05-03)

| Phase | Scope | Status |
|---|---|---|
| 3.1 | DDL migration (the 5 tables above) | Shipped 2026-05-03 |
| 3.2 | Entity helpers (`pcs-aics.js`), CRUD API routes, `/pcs/aics` list page | In flight (parallel worktree) |
| 3.3 | RA review queue UI, claim-by-claim diff vs. previous version | Not started |
| 3.4 | PCS doc inheritance render — show AICS-derived claims inline on `/pcs/documents/[id]` | Not started |
| 3.5 | AICS-driven evidence packet auto-fan-out on PCS doc creation | Not started |

The sidebar already has an `AICS` entry under researcher + RA roles (Wave 7.4), pointing at `/pcs/aics?status=pending`. The route 404s today; Phase 3.2 fills it.

---

## Open questions

- **RA Review Queue surface.** The sidebar entry `/pcs/aics?status=pending` is wired but the page is Phase 3.3. Until then, RA reviews happen against the source `.docx` files in the shared drive, then get back-filled to AICS rows once the schema and UI exist.
- **Versioning model.** `aics_versions` follows the PCS Revisions pattern (one row per field-level edit). For AICS we may want coarser version units (one row per RA-approved release), since AICS docs aren't continuously edited the way PCS docs are. TBD with Gina + the RA hires.
- **EndNote integration.** AICS substantiation cites studies that already live in the team's shared EndNote library. Open question: do we import EndNote citation IDs into `aics_claims` as a `citation_keys[]` column, or keep AICS standalone and resolve citations at render time? The shared EndNote library is non-trivial to programmatically read; deferring until Phase 3.4.
- **Demographic dose precision.** The platform canonical set collapses Toddlers 1–3 + Children 4–8 + Pre-teen 9–12 into Children 1–3 + Children 4–12. There may be ingredients (notably iron, zinc) where the finer split is regulatorily required. If so, we'll either (a) extend Lauren's vocabulary, or (b) allow AICS-level overrides. TBD.

---

## For the incoming RA hires

When you join, your first AICS-shaped tasks will be:

1. Read AICS-0004 v0.1 end-to-end. It's the template.
2. Pick the next active ingredient on Nordic's pipeline (likely vitamin C or omega-3) and draft AICS-0005 against the same template.
3. Once Phase 3.2 lands, your draft gets imported into `aics_documents` + `aics_claims` rows; you take over from there in the web UI.
4. Once Phase 3.3 lands, the RA review queue at `/pcs/aics?status=pending` becomes your daily work surface.

Your `ra` role already grants you all the capabilities you'll need for AICS read/write — see `role-aware-sidebar.md` for what your sidebar will look like, and `wave-7.1-capabilities-migration.md` for the capability model.
