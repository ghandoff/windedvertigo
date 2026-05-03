# Scope Deferred to 2027 — Nordic Naturals SQR-RCT + PCS Platform

**Author:** Garrett Jaeger (Winded Vertigo)
**Date:** 2026-05-03
**Purpose:** Companion to `retainer-and-buyout-proposal.md` §10.6. This is the canonical list of work that is **explicitly out of scope for 2026** under both Budget A ($50K platform build) and Budget B (retainer R&D), and would land in 2027 either as a new SOW or as part of a renewed retainer.
**Audience:** Garrett's tech-contracts attorney + Nordic procurement (sanitized version is shareable; raw is internal-use).

---

## 1. Why this list exists

Sharon's research VP has hesitation around the $6K/mo Priority-tier retainer. To make the conversation concrete, this doc enumerates what's available, what's not, and what would shift if the retainer downgraded. It also pre-empts scope-creep questions during the proposal review by stating which features are explicitly **post-2026**.

A clear deferred list also protects Garrett: if Nordic later asks "is X in scope?" the answer for anything in this doc is "no, it's in the 2027 SOW pile."

---

## 2. Categories

### A. Genuinely deferred — not blocked by budget; just not 2026 priorities

These are real platform improvements that don't fit in the 2026 cap and aren't urgent enough to commission as new SOWs mid-year.

| Item | Estimate | Why deferred |
|---|---|---|
| **Wave 9 — real-time collaborative editing (CRDT multi-user)** | 60–100h, $25–45K | Lauren and Sharon don't co-edit PCS docs simultaneously today; the platform's audit-trail revert covers their actual workflow. Wave 9 is for a hypothetical future where multiple researchers edit in tandem. |
| **Public reviewer-facing portfolio pages** | 40–60h, $14–21K | External reviewers earning published profile pages with portfolio. Tied to growing the reviewer network to ≥50 active reviewers — Nordic isn't there yet (~10 active reviewers as of 2026-04). |
| **Cross-language label content support** | 80–120h, $28–42K | Nordic ships into FDA DSHEA, Health Canada NHP, and EU EFSA regulatory regions. Each has different label conventions. Multi-region label-extraction tooling is bigger than the AICS work and isn't a 2026 priority. |
| **Phase 4.5 — full PCS form-driven entry replacing .docx upload entirely** | 30–50h, $10–17K | Today the form coexists with the upload path (live as of Bundle 4 P2). Full replacement requires Lauren's complete controlled-vocab import + Nordic-side RA training + a deprecation runway for legacy .docx submissions. Sequencing: ship 4.4 in Budget B, then evaluate 4.5 in Q1 2027. |

### B. Conditional on Nordic budget — moves from Budget B to 2027 if retainer downgrades

These are R&D items currently scoped into the Priority-tier ($6K/mo) retainer. If Nordic chooses Standard tier ($4K/mo) or no retainer, they shift to 2027.

| Item | Hours | Budget B fit (Priority) | If Standard tier | If no retainer |
|---|---|---|---|---|
| **Phase N2** — Notion → Supabase backfill of existing PCS corpus | 30–50h | fits in months 2–4 of the retainer | partially fits; takes 6–10 months | full deferral to 2027 |
| **Phase N3** — dual-write hooks in API write paths | 20–30h | fits in months 4–5 | partially fits | full deferral |
| **Phase N4 + N5** — RLS + cutover + drop legacy TEXT columns | 15–25h | fits in months 5–6 | deferred to 2027 | deferred |
| **Wave 10.1 Phases 1B–1D** — deterministic parsers, TF-IDF claim similarity, content-hash caching (~30–40% LLM cost reduction) | 30–40h | fits in months 6–8 | partial — only the highest-volume call sites get migrated | full deferral |
| **DNS cutover** from Vercel to CF Workers (after canary parity verifies) | 8–12h | fits in months 1–2 (low effort, just operational) | fits | full deferral — Nordic stays on Vercel |
| **Bundle 5 — RA Review Queue + assignment workflow** | 24–36h | fits in months 3–5 | deferred to 2027 | deferred |
| **Bundle 6 — three-perspective dashboards** (by-AI / by-benefit, supplementing existing by-product) | 24–40h | fits in months 7–10 | deferred to 2027 | deferred |
| **Phase 4.4** — Smartsheet API integration for AI master import | 8–12h | fits in months 1–2 | fits but with delay | full deferral; Lauren maintains via CSV scaffold |

### C. Genuinely 2027-only — outside any 2026 budget envelope

These are large engagements that need their own dedicated SOW + Nordic legal review + (in some cases) external counsel. They cannot be folded into either 2026 budget.

| Item | Estimate | What it requires beyond the platform |
|---|---|---|
| **Wave 11 — Supabase migration cutover (Phase N2 → N5 compressed delivery)** | 80–160h, $28–56K | Only if Nordic wants the cutover faster than the Priority-tier retainer can absorb (5–10 months). Otherwise this fits inside Budget B at retainer pace. |
| **Wave 12 — HIPAA BAA preparation + SOC 2 Type 1** | 60–120h tech + legal, $30–60K platform-side, plus Nordic-engaged legal/compliance specialists | Nordic engages legal + compliance specialists; Garrett collaborates as platform-side consultant. Required only if Nordic wants to pursue regulated-data partnership (e.g. with healthcare providers). |
| **Wave 13 (proposed) — multi-tenant platform support** | 100–160h, $35–56K | Only if Nordic wants to license the platform to other supplement brands as a SaaS offering. No internal driver today. Pure Garrett-side speculation; flagged here for visibility. |

---

## 3. What this list deliberately **does not** include

To avoid confusion in negotiation:

- **Anything that's already shipped through 2026-05-03** — that's all in Budget A regardless of retainer tier choice.
- **Bug fixes for shipped features** — those are Budget B / retainer territory regardless of tier (it's literally the maintenance line item).
- **Operator training sessions** — Lauren / Gina / RA team are already trained via the operator runbooks (`docs/runbooks/`); ad-hoc training questions fit in retainer's 2h/mo advisory time.
- **Notion DB schema additions / Smartsheet ↔ Notion sync** — these are research-team operational work, not platform-engineering work. Out of scope for both budgets.

---

## 4. Decision matrix for Sharon's VP

| Scenario | Total 2026 cost to Nordic | What ships in 2026 | What waits for 2027 |
|---|---:|---|---|
| **Priority retainer ($6K/mo)** + Budget A fixed-fee | $122,000 | All of Budget A + most of Budget B (everything in §B above) | Everything in §A and §C only |
| **Standard retainer ($4K/mo)** + Budget A fixed-fee | $98,000 | All of Budget A + half of Budget B (half the migration phases, Wave 10.1 partial, no Bundle 5/6) | §A + §C + half of §B |
| **No retainer, hourly-only** ($200–250/hr) + Budget A fixed-fee | $50,000 + reactive hours | Budget A only; reactive maintenance billed when something breaks | §A + §C + all of §B |
| **Quarterly retainer review** ($18K/quarter) + Budget A fixed-fee | $50,000 + $18K Q3 = $68K through Q3, reassess | Q3 portion of Budget B (security patching + first migration phase) | Whatever doesn't ship in Q3, plus §A + §C |

---

## 5. Recommendation

If the VP's hesitation is about the $6K/mo monthly burn rate but they're open to a relationship structure that protects the platform:

**Lead with the quarterly retainer review** ($18K Q3, reassess at end of Q3). It demonstrates Garrett's confidence in delivering value in 90 days while giving Nordic an explicit decision point. If Q3 lands well, Q4 + 2027 retainer commitment becomes much easier. If it doesn't, both parties walk with minimal friction.

Fallback: Standard tier $4K/mo. Half the cash outlay; preserves the relationship; explicitly defers Bundle 5/6 to 2027. Better than no retainer because it keeps Garrett on call for security CVEs and LLM ecosystem churn.

---

## 6. Companion docs

- `retainer-and-buyout-proposal.md` §10.6 — bundle-level mapping (this doc's complement)
- `scope-reconciliation-2026-04-30.md` — wave-by-wave hours/cost classification
- `august-backup-clause.md` — named-backup contractor clause (draft, awaiting full name)
