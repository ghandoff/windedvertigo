# Scope Reconciliation — Nordic Naturals SQR-RCT + PCS Platform

**Author:** Garrett Jaeger (Winded Vertigo)
**Date:** 2026-04-30
**Purpose:** Reconcile shipped work against Nordic's verbal $50,000 platform-build budget. Classify each shipped wave as Budget A (platform build, fixed-fee) or Budget B (retainer R&D / maintenance) so the contract reset has an auditable foundation.
**Status:** Internal worksheet for Garrett's tech-contracts attorney. NOT a Nordic-facing document.

---

## 1. Anchor assumptions

- **Hourly rate:** $350/hr per `retainer-and-buyout-proposal.md` Appendix A.
- **Verbal budget cap:** $50,000 platform build "for the rest of the year" (Nordic, conversational, no signed SOW).
- **Reconciliation date:** 2026-04-30 (last Nordic-repo commit `b8799ce`; codebase frozen for this snapshot).
- **Hour estimates:** rough — derived from wave plan docs in `docs/plans/` and commit-density review. Within ±20% on any single line.

---

## 2. Shipped work — classified

| Wave / phase | Hours | $ @ $350 | Budget | Rationale |
|---|---:|---:|:---:|---|
| Wave 4.x — initial PCS pipeline + SQR-RCT scoring | ~40 | $14,000 | A | Core operator workflow. Pre-dates current budget conversation but remains in platform-build scope. |
| Wave 5.5 — AI claim copy drafter | ~10 | $3,500 | A | Operator-facing feature (`/api/pcs/labels/[id]/draft-copy`). Already cost-gated; daily operator value. |
| Wave 5.6 — AI reformulation suggester | ~8 | $2,800 | A | Operator-facing (`/api/pcs/labels/[id]/suggest-reformulation`). Same pattern as 5.5. |
| Wave 7.0.5 — multi-profile + T2.5 merge script | ~12 | $4,200 | A | Auth + canonical-claim hygiene. Operator-touching. |
| Wave 7.0.7 — security hardening | ~20 | $7,000 | A | bcrypt backfill, split access/refresh tokens, live role re-verify. Required for production posture. |
| Wave 7.1 — roles + capabilities scaffold | ~10 | $3,500 | A | Foundation for Wave 7.5 migration. |
| Wave 7.3.0 — email-as-key migration (Phase A audit + Phase B banner) | ~16 | $5,600 | A | Operator data model fix. |
| Wave 7.4 — role-aware sidebar preview | ~8 | $2,800 | A | Operator UX, feature-flagged at `/admin/sidebar-preview`. |
| Wave 7.5 — capability migration (3 batches, ~110 routes) | ~24 | $8,400 | A | Auth-gate consolidation; closes a duplicate code path. |
| Wave 8 — Living PCS (versioning + inline edit + revert + dedupe UI) | ~24 | $8,400 | A | Headline operator feature. Highest-value Wave 8 deliverables. |
| **Budget A subtotal** | **~172h** | **~$60,200** | | **Already $10K over the $50K cap.** |
| Wave 10.1 — LLM adapter Phase 1A scaffold | ~6 | $2,100 | B | Harness only. No call sites migrated. Architectural R&D. |
| Phase N1 — Supabase initial schema (`001_initial_schema.sql`) | ~12 | $4,200 | B | DDL only; application code does not read it yet. Migration optionality. |
| Phase N1.5 — DDL-only slice (`002_normalize_relations_ddl.sql`) | ~4 | $1,400 | B | Empty join tables + nullable FK columns + `current_user_id()`. Forward-progress-only. |
| Monorepo merge + CF Workers parity canary (Phase C + F.1–F.3, Nordic share) | ~16 | $5,600 | B | Cross-app infrastructure restructure. Nordic benefits but doesn't drive. |
| **Budget B subtotal** | **~38h** | **~$13,300** | | Folds into retainer R&D. |
| **Total shipped** | **~210h** | **~$73,500** | | |

---

## 3. Headroom against $50K cap

Budget A subtotal: **$60,200** at $350/hr.

Two ways to reconcile:

**Option 1 — Honor the verbal cap as fixed-fee.**
- Nordic owes $50,000 on signature for everything classified Budget A above (already shipped + remaining build deliverables).
- Garrett absorbs the ~$10K overrun as cost-of-discovery for the verbal-only budget arrangement.
- Remaining build deliverables (Wave 7.x chained track, Wave 8 polish, runbook completion) ship inside the $50K with **negative headroom of ~$10K** — i.e. Garrett finishes them on goodwill / inside the fixed fee.
- **Recommendation:** this is the cleanest framing for a Nordic-facing proposal. The overrun is invisible to Nordic; the contract cap protects them.

**Option 2 — Re-anchor to actual hours.**
- Disclose the ~$60K Budget A subtotal to Nordic; argue the $50K verbal cap was set before scope was understood.
- Ask for a $10K addendum or fold the overrun into Q1-2027 retainer hour pool.
- **Recommendation:** only if Nordic demonstrates appetite for transparent rate-card billing. Higher friction.

---

## 4. Remaining build work (Budget A only)

These remain in the $50K cap regardless of which option above is chosen:

| Item | Est. hours | $ @ $350 | Notes |
|---|---:|---:|---|
| Wave 7.2.0 — WorkspaceShell refactor | ~6 | $2,100 | Gated on Phase B email burn-in (≥1 wk) |
| Wave 7.2.1 — route relocation | ~4 | $1,400 | Sequential after 7.2.0 |
| Wave 7.3.1 — `/login` extraction | ~4 | $1,400 | Sequential after 7.2.1 |
| Wave 7.3.2 — `/welcome` + sticky-role | ~4 | $1,400 | Sequential after 7.3.1 |
| Wave 7.4 — full sidebar adoption | ~4 | $1,400 | Removes feature flag |
| Wave 8 final polish + audit-trail export | ~6 | $2,100 | UX cleanup |
| Operator runbook completion | ~4 | $1,400 | `docs/runbooks/` |
| **Remaining Budget A** | **~32h** | **~$11,200** | |

Combined with the $60.2K already shipped, total Budget A delivery is **~$71.4K** of work for **$50K** fixed fee. Garrett's effective rate on the platform build alone is **~$245/hr**.

This is acceptable *only* because Budget B (retainer) brings the blended year-one rate back to market level (see year-one cash table in `~/.claude/plans/ethereal-crunching-marshmallow.md`).

---

## 5. Open questions

Mirrors the open questions in the plan file. The four answers convert this worksheet into a final exhibit for the contract:

1. August's full name + contractor status + vendor access matrix.
2. $50K timing — "rest of 2026" vs. "12 months from start."
3. Nordic procurement signature path.
4. Hourly rate validation — confirm Nordic's expectation matches the $350/hr anchor.

---

## 6. Audit trail

This document is regenerated whenever:
- A new Nordic-touching wave ships (update Section 2).
- The hourly rate anchor changes (re-cost everything).
- Nordic challenges the classification (Budget A vs. B per row).

Source-of-truth files for hour estimates:
- `docs/plans/wave-*.md` — official hour anchors per wave.
- `docs/runbooks/wave-*.md` — completion markers.
- `git log --since="2026-01-01" --oneline apps/nordic-sqr-rct/` (in monorepo) — commit volume cross-check.
