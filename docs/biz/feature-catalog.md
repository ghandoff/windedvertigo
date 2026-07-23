# biz — feature catalog

> the borrowable-feature backlog for **Biz** (winded.vertigo's business-development
> agent) and the **RFP Lighthouse** dashboard. mined from a targeted scan of
> proposal-authoring SaaS (loopio, responsive, ombud, arphie, autogenai, deeprfp,
> inventive, grantassistant, instrumentl, govwin, shipley) and cross-referenced
> against what already exists in port.
>
> **this doc is the source of truth that seeds the `biz_roadmap` table.** when a
> feature ships, flip its status here *and* in `biz_roadmap`. Biz reads `biz_roadmap`
> and surfaces `upgrades_available` in its briefing — so you (or Biz) can ask "what
> upgrades are available?" at any time, and Biz reminds the collective when there's
> headroom. ask about any row by id, e.g. "tell me about BIZ-D2".

## legend

- **status** — ✅ have · 🟡 partial (scaffolding exists in the db, no driver/UI yet) · ⬜ gap
- **surface** — 🤖 Biz tool (agent behaviour) · 📊 dashboard (UI) · ⚙️ pipeline/generator (ingest/draft)
- **fixes** — the real winded.vertigo pain point it addresses (from the RFP-intake review)

the central finding: the RFP Lighthouse already carries rich tables
(`rfp_requirements` + `rfp_coverage` view, `rfp_milestones`, `rfp_assignments`,
`collective_cv` + `isCvCurrent()`, `bid_decision` + `bid_decision_score`,
`computeWinProbability()`, `notifyNewRfps()`). most "features to steal" are 🟡 —
they need a **driver** (Biz) and a **surface** (dashboard), not a greenfield build.
only a handful are true ⬜ gaps (conflict detection, portal tracker, partner db).

---

## A. intake & requirements

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-A1 | auto-shred TOR → structured `rfp_requirements` rows (kind/weight/required) | 🟡 table+view exist, populator+UI absent | ⚙️📊 | coverage blind spots | grantassistant, responsive |
| BIZ-A2 | compliance/requirements matrix UI with click-to-traceback | 🟡 `rfp_coverage` view exists | 📊 | "is every requirement answered" | grantassistant |
| BIZ-A3 | auto-built submission checklist (kind=submission) | 🟡 data exists | 📊 | missed admin items | grantable |
| BIZ-A4 | smartfill into procurement portals | ⬜ | 📊 | portal re-keying | loopio |

## B. content library & CVs

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-B1 | CV de-dup — block identical copy-pasted experience entries | ✅ shipped (phase 3) | 🤖⚙️ | maria's #1 credibility issue | loopio ai librarian, ombud |
| BIZ-B2 | CV/content freshness + review cycles | ✅ `collective_cv` + `isCvCurrent()` | 📊 | stale bios | qvidian, loopio |
| BIZ-B3 | per-person, role-specific CV selection | 🟡 `teamMembersForCvs` exists | ⚙️ | generic CVs | ombud |

## C. drafting & grounding

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-C1 | inline per-claim source citations | ✅ shipped — `citationTrace` on `ProposalDraft`, appended to the Notion draft + surfaced in `biz_qc_review` | ⚙️ | hallucination risk | arphie, responsive trace |
| BIZ-C2 | traceability/confidence score on AI sections | ✅ shipped — `computeTraceabilityScore()`, persisted in `rfp_proposal_traceability`, gate 6 in the QC recipe | 🤖📊 | trust on institutional bids | responsive trace score |
| BIZ-C3 | draft-strictly-from-source guardrail | 🟡 prompt-level | ⚙️ | fabricated facts | grantassistant, deeprfp |

## D. AI review / QC — **flagship**

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-D1 | `biz_qc_review`: red-team draft vs the funder's own evaluation rubric | ✅ shipped (phase 3) | 🤖 | **no QC gate** | deeprfp color, autogenai gamma, granter |
| BIZ-D2 | **cross-source conflict detection** (deal-page ↔ docs ↔ within-draft) | ✅ shipped (phase 3, via align-narrative skill) | 🤖📊 | "60 countries vs asia-pacific / 8wk vs 7mo" | inventive ai (market whitespace) |
| BIZ-D3 | requirements-coverage / materials checklist | ✅ shipped (phase 3) | 🤖📊 | incomplete bids | ombud, responsive |
| BIZ-D4 | self-score draft vs award criteria pre-submission | ⬜ | 🤖 | weak sections ship | granter.ai |

## E. go/no-go & fit

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-E1 | `biz_go_no_go`: pass/fail eligibility → weighted scorecard | ✅ shipped (phase 4) | 🤖📊 | should-we-bid, fuzzy ownership | shipley scotsman |
| BIZ-E2 | weighted P-win + auto-verdict bands (<40 no / 40–70 conditional / >70 pursue) | ✅ shipped (phase 4) | 🤖📊 | gut-feel bids | loopio p-win, goveagle |
| BIZ-E3 | explainable fit-score breakdown (sector/region/history/budget) | 🟡 `wv_fit_score` + `decision_notes` | 📊 | opaque "high fit" | govwin smart fit |

## F. pipeline / forecast

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-F1 | value-weighted forecast (Σ value × P-win) | 🟡 both inputs exist | 📊 | no honest pipeline number | instrumentl |
| BIZ-F2 | portfolio analytics (win-rate, ask vs awarded, cycle time) | ⬜ | 📊 | no learning signal | grantable, responsive bi |
| BIZ-F3 | named-stage board | ✅ kanban | 📊 | — | instrumentl |

## G. deadlines / portals / submission

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-G1 | typed deadlines (EOI/full/report) + multi-touch reminders + calendar sync | 🟡 `rfp_milestones`/`rfp_assignments` exist | 📊→PaM | deadlines slip | instrumentl |
| BIZ-G2 | **funder-portal registration tracker that GATES a bid** | ⬜ novel | 📊 | ungm/unicef dead-ends | market whitespace |
| BIZ-G3 | real-time slack alert on new high-fit RFP | 🟡 `notifyNewRfps()` batched | ⚙️ | missed early window | devex/instrumentl |
| BIZ-G4 | delta alerts when a tracked opp's date/status changes | ✅ shipped — due-date deltas only (status changes already alerted elsewhere); `sync-rfp-pilot` | ⚙️ | silent slippage | govwin |

## H. funder & relationship intel

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-H1 | funder profile (past awardees, typical award size, prior bids, contact) | 🟡 `organizations` exist | 📊 | cold each time | instrumentl, devex |

## I. win/loss & learning

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-I1 | structured win/loss + debrief → methodology library | ✅ shipped (phase 4) | 🤖 | lessons not queryable | autorfp |
| BIZ-I2 | P-win calibration check | ⬜ | 🤖 | uncalibrated scoring | win-loss analytics |

## J. teaming / partners

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-J1 | persistent partner/teaming db (country, local/intl, capability, NDA/TA) | ⬜ | 📊🤖 | local-partner vetting (payton) | civio, capture2proposal |
| BIZ-J2 | capability-gap → partner recommendation | ⬜ | 🤖 | consortium gaps | civio |

## K. budget

| id | feature | status | surface | fixes | source |
|----|---------|--------|---------|-------|--------|
| BIZ-K1 | defensible budget range from real rates (← Fin) + margin rationale | ✅ shipped (phase 4, fin_briefing handoff) | 🤖 | 74% spread | capture tools |

## L. discovery subscriptions (backlog, not a feature)

| id | item | status | notes |
|----|------|--------|-------|
| BIZ-L1 | UNGM Pro (~$158/yr) push feed | ⬜ | business case in drive; decide separately |

---

## top features to steal (shortlist, by leverage ÷ effort)

1. **BIZ-D1** — `biz_qc_review`, the QC gate (red-team vs the funder's rubric)
2. **BIZ-D2** — cross-source conflict detection (novel; fixes the deal-page↔draft drift)
3. **BIZ-A2** — compliance matrix UI (on the existing `rfp_coverage` view)
4. **BIZ-B1** — CV de-dup (maria's #1 credibility issue)
5. **BIZ-G2** — funder-portal registration tracker (novel; fixes ungm/unicef dead-ends)
6. **BIZ-E1/E2** — go/no-go + P-win bands (on existing `bid_decision*` cols)
7. **BIZ-K1** — defensible budget range via Fin
8. **BIZ-G1** — typed deadlines → PaM handoff
9. **BIZ-F1** — value-weighted forecast
10. **BIZ-I1** — structured win/loss feeding the methodology library

## the two market gaps that are our edge

the SaaS category is weakest in exactly the two places we most need:
**BIZ-D2 conflict detection** (deal-page-vs-docs drift) and **BIZ-G2 portal-registration
tracking**. almost no incumbent ships these well — yet they're the precise failures
that bit us on oxfam denmark and unicef. building them isn't catching up; it's a
differentiated BD capability tuned to UN / IDB / foundation work.

---

*maintained alongside the Biz agent. roadmap phases (see the approved plan) draw down
this backlog; `biz_roadmap` mirrors these rows for machine-readable reminders.*
