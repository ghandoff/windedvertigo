# Expert-in-the-Loop Gates — Platform-Wide Build Prompt

**Build prompt for the Nordic Research Platform (apps/nordic-sqr-rct) Claude Code session.**
Author: winded.vertigo · Date: 2026-06-13 · Status: ready to implement

---

## 0. TL;DR

Give the team **options with gates** — don't force review-only. Where the platform produces a record by AI/automation (PCS document extraction, claim standardization, evidence extraction, dossier generation), the expert can **let automation do the entry and review the result, or enter it by hand when the hands-on pass adds value** — and a **shared expert-review gate** sits behind both paths. Nothing AI-produced is "live" until a qualified person (researcher / RA / admin) approves it. The gate is **version-controlled**: every human touch is tracked, so review can be proven (not rubber-stamped), governed by team rules, shown to management, and measured (where gates earn their keep, and how much time they save). This is both the product value (Sharon's "let my team choose where their expertise goes") and the compliance safeguard (the FDA-accountability lesson: an expert must own what gets signed).

## 1. Why

Today the Research and Regulatory teams must hand-enter data from PCS documents whether or not that's the best use of their expertise, and any AI output still has to be vetted manually with no structure. We add a consistent **draft → expert review → approved** lifecycle, let experts choose when to lean on it, and keep a tracked history of every decision. The result: routine data entry becomes optional rather than mandatory, the hands-on pass stays available where it genuinely adds value, every automated step ends at an accountable person, and leadership gets provable oversight plus a real ROI signal.

## 2. The shared pattern (build this once, reuse everywhere)

Introduce a single, reusable review-gate concept rather than bespoke logic per feature:

- **Review status** on any AI/automation-produced record: `pending_review` → `approved` / `needs_changes` / `rejected`. Records that aren't `approved` are clearly non-authoritative. Hand-entered items pass through the same (fast) approval so the audit trail is uniform.
- **Confidence signal** carried alongside each draft (reuse existing extraction/standardization confidence — the claim-standardization queue already produces ratings). Surface it so experts can triage.
- **Configurable gate modes, one shared gate.** Each step / record type can be set to the mode that fits it — don't hard-wire a single flow:
  - *Human-first* — an expert reads and enters by hand; no AI.
  - *Human-first + AI verification* — the expert enters, then AI runs an alignment / QA pass and flags discrepancies for the expert to resolve. **This is Sharon's preferred default for reading articles into PCS documents: a person reads and enters every article first, and AI checks for alignment afterward.**
  - *AI-first + expert review* — automation extracts, the expert confirms or corrects.
  - *AI-auto above confidence T* — high-confidence items auto-approve with expert spot-checks; everything below routes to review.
  Which mode applies where is set by the rules engine (§5.2), so the team decides where automation helps and where the human touch comes first.
- **Approve / correct / reject actions**, gated to expert roles only (see §4). Approving stamps **who**, **when**, **how long the review took**, and **what (if anything) changed**.
- **Bulk-approve** for high-confidence batches; **focus mode** surfacing low-confidence / conflicting items first.
- **Unified Review Queue** so an expert sees everything awaiting them, filterable by type and confidence.

Implement status + the versioned audit log + the gate helper in a shared module (e.g. `src/lib/review-gate.js`) and reuse it; don't fork the logic per feature.

## 3. Where to apply it

1. **PCS document ingestion / entry** — supports all modes above. Sharon's preferred default: the research team **reads and enters every article by hand first** (the human touch up front), then AI runs an **alignment / QA check** on the entered record and flags anything that doesn't match the source. Other steps can run the other way (AI-first → expert review) where that's more useful. Either way the gate and audit apply. This is the headline win.
2. **Claim standardization** — bring the existing AI redundancy/standardization queue under the same gate vocabulary and audit trail.
3. **Evidence extraction** — auto-pulled study metadata / classifications reviewed before they count.
4. **Dossier / document generation** — generated dossiers/panels stay `DRAFT` (watermarked) until an expert signs off (shared with the Budget C preview prompt — keep the gate identical).

## 4. Access & accountability (use what exists)

- Gate **approve/reject** to expert roles via `src/lib/auth/capabilities.js` — e.g. a `pcs.review:approve` capability for `researcher`, `ra`, `admin`, `super-user`, **not** `pcs-readonly`. Enforce server-side via `require-capability.js`; use `hasAnyRole`/`ROLE_SETS` for UI gating.
- Status badges everywhere a record renders: `Draft` / `Pending review` / `Approved by [name] · [date]`. Nothing reads as authoritative without the approved badge.

## 5. Governance, audit & metrics (prove it, rule it, measure it)

The gate is also a **version-controlled record of human involvement** — review with history, like version control. This turns the gate from a checkbox into governance leadership can see.

### 5.0 Super-user toggle — default OFF

The entire governance layer in this section sits behind a **feature toggle that only a super-user can flip** (Garrett / August). It ships **OFF** so it can be walked through as a tutorial with leadership *before* it's switched on for the team. When OFF: the underlying gate still works (experts review/approve as normal) and review history is still captured quietly in the background, but rule **enforcement**, the management dashboard, and the surfaced metrics are inactive/hidden. When a super-user flips it ON: rules enforce, and the dashboards and metrics appear. Capturing history while OFF is recommended (it's low-risk and append-only) so the eventual demo and go-live have real data to show — but make that behavior configurable. Implement the toggle through the existing capability/role system (super-user-only), **not** a loose env flag, so no other role can enable it.

### 5.1 Versioned, append-only review history
- Every gate event is an immutable record: the automation's suggestion, what the expert did (**approved unchanged / corrected — with the diff / rejected / entered by hand**), the actor, timestamp, and review duration.
- Crucially, distinguish **"reviewed and confirmed"** from **"reviewed and corrected"** from **"approved without opening."** A rubber-stamp must be *visible*, not hidden — that's the proof a human meaningfully touched the record, which is exactly what an auditor (and Sharon) will want. Records carry a full version history so any past state and who changed it can be reconstructed.

### 5.2 Rules the team can set on gates
- Admins / RA can define rules over gates — including which **mode** (§2) applies to each record type — e.g.: "articles are read and entered by a human first, then AI-verified," "canonical claims require RA sign-off before publish," "[high-risk benefit category] requires manual entry or dual review," "auto-approve only above confidence T — everything below must be opened."
- A rule can require a path (manual vs automated-review) for certain record types, or require a second reviewer. Violations are flagged or blocked, and the chosen path (manual vs automated) is recorded against the rule so adherence is measurable.

### 5.3 Management view (for Sharon)
- A dashboard showing **adherence**: who is following the gate rules, the manual-vs-automated mix per person/team, throughput, and rubber-stamp signals (e.g. approvals with near-zero review time, or below-threshold confidence approved without a diff).
- Frame it for **process oversight and coaching, not surveillance** — surface patterns and where rules help, not individual "gotchas." Adherence is reported at team and individual level because that's what departmental rules require, but the tone is constructive.

### 5.4 Learning metrics (where gates earn their keep)
- Per gate type / confidence band / record type, track the **correction rate** — how often experts change the automation's output. High-correction gates are where human review is most valuable; gates approved-unchanged ~100% of the time are candidates for raising the auto-approve threshold (the extraction is trustworthy there).
- This is a feedback loop: it tells the team where to keep gates tight and where to let automation run, and it improves the platform over time.

### 5.5 Time-saved / ROI estimation
- Estimate time saved by reviewing vs. entering by hand: `(baseline manual-entry minutes per record) − (actual review minutes)`, summed per person / team / period, and split by record type.
- Baselines and per-field assumptions must be **explicit and configurable** (set with Sharon's team), and the figure shown as an estimate with its assumptions visible — never a hard claim. Surface it as a simple line: "the platform saved the team ~X hours this period."

## 6. Conventions & housekeeping

- Read `apps/nordic-sqr-rct/CLAUDE.md` first; match the `pcs.<resource>:<action>` capability pattern, caching headers, and `loading.js` skeletons.
- Treat the audit log as append-only / immutable (no destructive edits); model it so historical states are reconstructable.
- Add `tests/review-gate.verify.mjs` (assert: non-experts can't approve; unapproved excluded from authoritative reads; every action writes an immutable audit row distinguishing confirmed/corrected/rejected/hand-entered with duration; a rule violation is blocked/flagged; correction-rate and time-saved aggregates compute correctly; the governance toggle is super-user-only and the gate still works when it's OFF) and wire into `verify:all`.
- Update `.brain/handoff.md` and `.brain/TASKS.md`.
- Branch `feat/expert-in-the-loop-gates`; **do not push to `main`** until Garrett reviews (push auto-deploys).

## 7. Acceptance criteria

- [ ] A shared review-gate module is reused by extraction, claims, evidence, and dossier flows.
- [ ] Both entry paths exist (automation→review AND hands-on entry) and both pass the same gate.
- [ ] AI-produced records are non-authoritative until an expert approves; status visible in the UI.
- [ ] Only expert roles can approve/reject; readonly cannot; server re-verifies.
- [ ] Every gate event is append-only and distinguishes **confirmed / corrected (with diff) / rejected / hand-entered**, with actor, timestamp, and review duration; full version history is reconstructable.
- [ ] Admins can define gate rules; violations are flagged/blocked; the manual-vs-automated choice is recorded.
- [ ] A management dashboard shows rule adherence, manual/automated mix, throughput, and rubber-stamp signals.
- [ ] Learning metrics report correction rate by gate type/confidence; a time-saved estimate computes with configurable, visible assumptions.
- [ ] The governance layer (rule enforcement, dashboard, metrics) sits behind a super-user-only toggle, default OFF; flipping it requires a super-user, and the gates still function when it's OFF.
- [ ] `npm run verify:review-gate` passes; `verify:all` green.

## 8. Out of scope / never

- **No auto-publish without review.** No path makes AI output authoritative without an expert approval.
- **Don't remove the hands-on option.** Automation is assistive; experts must always be able to enter or fully rework a record by hand.
- **No punitive individual scoring.** Metrics serve process improvement and compliance, not ranking people.
- No changes to the underlying evidence/claims data model beyond adding review-status, audit/version, and rule fields.

---

*Companion: `budget-c-preview-build-prompt.md` (the marketing interface preview — uses the same sign-off gate) and `ingredient-ai-coverage-matrix.md` (the anti-drift capability tracker). Business framing in the Notion docs "Addendum A — …Research Intelligence Foundation" and "Phase 3 Scope Estimate (Addendum B)…".*
