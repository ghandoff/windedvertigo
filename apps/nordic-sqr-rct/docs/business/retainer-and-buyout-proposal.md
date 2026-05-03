# Ongoing Services Retainer + Buyout Proposal

**Author:** Garrett Jaeger (Winded Vertigo)
**For:** Nordic Naturals — SQR-RCT + PCS Platform
**Date:** 2026-04-22
**Status:** Draft for internal review before contract negotiation

---

## 1. The shape of this contract

The work to date has delivered a production platform with live integrations into
Nordic's research operations (PCS documents, canonical claims, label import,
SQR-RCT scoring, weekly digests, nightly re-pings, ingredient-safety
escalations, in-app feedback, feedback Slack fan-out, bcrypt-authenticated
multi-role auth with 1h access tokens and live role re-verification, audit
trail for mutations). That platform does not stand still. Three categories of
ongoing work are unavoidable and warrant a recurring commercial relationship
rather than a one-time build fee:

1. **Security maintenance** — password policy, token rotation, dependency
   patches, vendor-breach response, regulatory updates (FDA DSHEA, FTC Green
   Guides, GDPR, CCPA), penetration-test findings, audit-log reviews.
2. **LLM ecosystem churn** — Claude, OpenAI, and every downstream LLM
   provider ship breaking changes on ~quarterly cadence (pricing, rate limits,
   retention defaults, API shape, model deprecations). Every one of these is
   a live risk to the platform's extraction pipelines and auto-scoring.
3. **Nordic-side data hygiene and evolution** — new products, new claim
   templates, label format revisions, Lauren's template updates, canonical
   claim deduplication, formula line backfills, study intake changes.

A one-time build fee does not cover any of these. A project-based engagement
creates a feast/famine dynamic where Nordic only pays when something is already
broken. A **retainer** aligns incentives: I have a predictable revenue base
that funds proactive maintenance and rapid incident response, and Nordic has
a committed owner for the platform without having to renegotiate every quarter.

---

## 2. What the retainer covers (and doesn't)

### Included in the monthly retainer

| Category | Scope |
|---|---|
| **Security patching** | Dependency updates, CVE response within agreed SLA, token and credential rotation, Notion / Vercel / Anthropic vendor-breach assessment and mitigation. |
| **LLM vendor management** | Monitor Claude/OpenAI API changelogs, model deprecations, pricing shifts. Adjust prompts and pipelines to stay within budget and compliance. Negotiate addenda (ZDR, BAA) on Nordic's behalf. |
| **Data hygiene assistance** | Operate the existing backfill scripts, duplicate audits, and canonical-claim merges. Triage intake-queue anomalies. |
| **Minor feature work** | Small additive features (≤ ~4 hours each), UI polish, copy changes, role adjustments, new Slack channel wiring, label template tweaks. Cap: 8 hours / month, carryover 1 month max. |
| **Incident response** | Triage production issues within defined response-time SLA (see §6). Revert via Wave 8 Phase A audit trail when appropriate. After-action writeup. |
| **Quarterly security review** | Review of audit logs, access patterns, capability assignments, Notion workspace membership, Vercel env var hygiene. Written report to Nordic leadership. |
| **Light advisory time** | Up to 2 hours / month of strategy conversations, vendor selection advice, architectural recommendations on Nordic-initiated questions. |

### NOT included (scoped separately as project work)

| Category | Scope |
|---|---|
| **Major feature builds** | New waves (e.g. Wave 8 C-D inline editing, Wave 9 real-time collaboration, Wave 10 Supabase migration, future analytics, new workflows). Each scoped as its own SOW with fixed fee or T&M. |
| **LLM platform migration** | See §5 — specific open-source migration project. |
| **Nordic-driven data migrations** | Large imports (hundreds of PCS docs), one-time integrations with other Nordic systems (SAP, ERP), large-scale taxonomy reworks. |
| **Training + documentation deliverables** | Written runbooks beyond what's already in `docs/runbooks/`, video walkthroughs, onboarding sessions for new Nordic hires. Hourly. |
| **Custom integrations** | Bespoke connectors to Nordic's warehouse, accounting, LIMS, etc. Each is a project. |
| **Legal or compliance attestations** | SOC 2 preparation, HIPAA BAA preparation, FDA regulatory documentation. Nordic engages legal + compliance specialists; I collaborate as consultant at hourly rate. |

---

## 3. Proposed retainer structure

Dollar figures are anchor estimates for conversation; Garrett's attorney and
Nordic's procurement will adjust.

### Baseline monthly retainer

**Range: $4,000 – $7,000 / month** depending on SLA tier (§6) and monthly
feature-work allowance. Invoiced monthly, net 15.

Rationale anchor: at 10–20% of estimated first-year build value, a retainer
of ~$60k – $85k / year is standard for a production platform of this scope
with regulated-data characteristics.

### Tiered SLA options

| Tier | Response time (P1 incident) | Response time (P2) | Monthly hours | Approx fee |
|---|---|---|---|---|
| **Standard** | 24 business hours | 3 business days | 8 h included | $4,000 / mo |
| **Priority** | 4 business hours | 1 business day | 16 h included | $6,000 / mo |
| **Dedicated** | 1 business hour | 4 business hours | 24 h included | $9,000 / mo |

**Named backup contractor — included at every tier.** All three tiers include a named backup (currently August [LAST NAME]) who provides secondary on-call coverage during Garrett's vacation, illness, or travel. Coverage shape, access provisioning, billing, and successor handling are detailed in §3a below. (Previously named-backup was a Dedicated-tier-only differentiator; promoting it to all tiers closes Nordic's bus-factor risk regardless of tier choice.)

Over-limit hours billed at $200 / hr (standard) or $175 / hr (priority+).

### 3a. Named backup contractor

Every tier of this retainer includes a named backup contractor — currently **August [LAST NAME]** — who provides secondary on-call coverage during Garrett's planned absences (vacation > 3 days), unplanned absences (illness, emergency), or sustained unreachability (international travel without reliable connectivity).

**Coverage scope.** August acknowledges and triages P1/P2 incidents within the tier's stated SLA when Garrett is unreachable. Resolution may extend beyond Garrett's normal SLA window when work-product depth (deep platform changes, security forensics, novel LLM debugging) genuinely requires Garrett's return. August's role is to keep Nordic informed, contain damage, and execute well-documented runbook procedures — not to substitute for Garrett's full skill surface.

**Access provisioning.** August maintains a named contractor account with read-write access to the Nordic technology stack: Vercel, Cloudflare, Supabase, Notion (workspace member), and Anthropic (org member). All access is provisioned under a contractor-of-Winded-Vertigo agreement, not a direct Nordic-issued account. Audit logs distinguish Garrett's actions from August's.

**Billing.** August's hours bill against the retainer's monthly hour pool at the same effective rate. There is no separate Nordic-facing invoice line for August. Garrett pays August directly out of retainer revenue and represents to Nordic that this arrangement does not increase Nordic's effective cost per hour of coverage.

**Vacation notification.** Garrett gives Nordic ≥ 2 weeks' notice for absences > 3 days, identifies August (or named successor — see below) as the on-call contact for the absence window, and communicates the contact channel (Slack handle, email, phone for P1).

**Successor clause.** If August becomes unavailable (declines coverage, ends contractor relationship with Winded Vertigo, or suffers his own absence), Garrett identifies a replacement named-backup with **30 calendar days' notice** to Nordic. Nordic acknowledges in writing (email is sufficient). The replacement provisions equivalent vendor access before the new arrangement takes effect.

**Mutual non-solicitation.** Nordic agrees not to engage August directly outside the Winded Vertigo retainer for the term of the contract + 12 months post-termination. August is bound to the same generic non-reverse-engineering norms as Garrett (§4) for any code, prompt, or schema he touches under the retainer.

### Term

- **12-month initial term**, auto-renewing in 12-month increments.
- **60-day mutual notice** for non-renewal or tier change.
- **Price adjustment clause:** CPI-linked annual review (capped at 5%/yr).

---

## 4. Buyout / termination / transition

This is the most important section for Garrett's risk posture: what happens
if Nordic decides to stop paying?

### Two paths: wind-down vs. buyout

**Path A — Wind-down (simpler, cheaper for Nordic):**

If Nordic gives notice, a 90-day wind-down begins. During wind-down:

- Retainer continues at current rate.
- I deliver a **transition package**:
  - Complete handoff runbook (`docs/handoff/*` written during wind-down)
  - Credentials transfer to Nordic-named successor (Notion, Vercel, Anthropic,
    Slack webhooks, GitHub repo admin)
  - Live walkthrough sessions (up to 8 hours) with Nordic's designated team
  - Dependency / vendor map + cost attribution
  - 30-day post-termination email/Slack availability for critical questions
    (no billable hours, short answers only)
- **Open-source migration NOT included** in wind-down. If the platform's
  LLM features matter to Nordic after I leave, they either (a) keep the
  Anthropic contract themselves, or (b) commission the migration project
  separately (§5) BEFORE terminating.

**Path B — Buyout / accelerated exit:**

If Nordic wants to end the relationship immediately (no 90-day wind-down),
a buyout fee applies:

- **Exit fee = 6 × current monthly retainer**, paid on termination.
- Includes everything in Path A compressed into 30 days.
- Protects Garrett's revenue runway while transitioning to next engagement.

### Termination for cause

If termination is for documented cause (Garrett breach of contract, gross
negligence, confirmed willful misconduct), neither path's fees apply; contract
ends per the cause clauses. Ordinary performance disagreements do NOT
constitute cause.

### Non-reverse-engineering clause

I retain the right to re-use generic patterns, libraries, and non-Nordic-
specific code in future client engagements, consistent with standard
contractor-IP norms. Nordic retains full ownership of Nordic-specific code,
data, schemas, and branding.

### Non-solicitation (optional but recommended)

If Nordic signs the retainer, I agree not to accept commercial engagements
from direct Nordic Naturals competitors (US supplement category, top 20 by
revenue) for the term of the contract + 12 months post-termination. This
addresses Nordic's IP-leak concern directly and gives them comfort on
exclusivity without requiring exclusivity everywhere.

---

## 5. The LLM dependency problem — and how to neutralize it

### The risk (frank assessment)

The platform's most valuable capabilities — PCS document extraction,
ingredient extraction from label images, auto-scoring in SQR-RCT, claim
drafting, reformulation suggestions — all depend on Anthropic's Claude API.
If that dependency breaks (pricing shock, account suspension, Anthropic goes
bust, regulatory ban, model deprecation without an equivalent replacement,
or Nordic decides to stop paying for it), the affected features fail within
hours. This is *vendor concentration risk* in its clearest form.

It's also the single biggest reason Nordic should keep me on retainer rather
than build-and-abandon: most of the hard work of the platform is not in the
React code or the Notion schema — it is in the prompt engineering,
confidence-gate logic, extraction-validation pipelines, and the accumulated
corpus of "what Claude gets wrong on Nordic's specific template." That
institutional knowledge is not recoverable from a code read-through.

### Mitigation strategy — phased, not all-or-nothing

I will propose a dedicated **Wave 10 — Evergreen Extraction** project
(scoped separately, see §7) that reduces LLM dependency with this sequence:

1. **Deterministic parsers first.** Replace LLM calls for well-structured
   fields with rule-based extraction. Today the platform uses `mammoth` for
   .docx → Markdown and Claude for the rest; we can bring more fields under
   deterministic parsers (SKU codes, FMT codes, PCS IDs, SAP material numbers,
   dose amounts with unit regex, formula-line structure when tables are
   present). Deterministic parsers are free, fast, version-stable, and never
   hallucinate.
2. **Open-source LLMs via managed hosts.** For remaining LLM calls, add
   Llama 3 / Mistral / DeepSeek via Groq, Together.ai, or Replicate as a
   second provider. Adapter pattern — the rest of the codebase doesn't know
   which model ran. Costs drop ~80–95% vs. Claude, and the models are
   fungible (swap one OSS model for another without code changes).
3. **Self-hosted OSS fallback.** For the most sensitive content where even
   managed OSS has egress risk, a self-hosted Llama variant on Vercel Fluid
   Compute or a cheap EC2 GPU. Only warranted if Nordic's DPO posture
   requires zero third-party inference.
4. **Vision holdout.** Claude vision is currently the best open model for
   structured label extraction. Until OSS vision models catch up (watch
   Qwen-VL, InternVL, Pixtral), keep Claude for label OCR specifically and
   move everything else to OSS. Clear line of audit: "Nordic label images
   visit Anthropic; nothing else does."
5. **Aggressive caching.** Every extraction result persists with a content
   hash. Re-uploading the same PDF doesn't re-hit any API. This is mostly
   already in place; Wave 10 formalizes and extends it.

### Why this is a separate deliverable, not folded into retainer

The migration is ~40–80 hours of implementation + evaluation + comparison
testing + prompt rewriting. That's a project, not maintenance. It also
delivers measurable value (LLM spend drop, vendor-risk reduction, compliance
posture improvement) that justifies its own fee.

**Estimated Wave 10 budget: $20,000–$35,000**, one-time, delivered over 6–10
weeks. Retainer continues throughout — the migration is the retainer's
purpose, not its replacement.

### What happens if Nordic terminates BEFORE Wave 10 ships

This is the scenario the retainer is specifically designed to protect Garrett
from: "build the hard thing, then get kicked off before the evergreen version
lands."

Three protections:

1. **The retainer itself.** If Nordic wants the LLM-dependent features to
   keep working, they need ongoing maintenance. Terminating without
   replacement means those features degrade (prompt drift, model
   deprecation, pricing changes unmanaged). Nordic's own interest aligns
   with retaining me through the transition.
2. **Buyout fee (§4).** 6× monthly retainer on accelerated exit recoups some
   of the investment Garrett has made in platform-specific IP.
3. **Wave 10 pre-commitment.** Strong recommendation: Wave 10 scoping
   conversation happens in the first 90 days of the retainer. If Nordic
   commits to Wave 10 funding up front, both parties have aligned incentive
   to see it through.

---

## 6. SLA specifics

### Incident severity

- **P1 — Production down or data loss in progress.** Platform unreachable, auth
  broken for all users, data being corrupted, breach in progress.
- **P2 — Significant feature broken, workaround exists.** e.g. PCS imports
  failing, scoring workflow stuck, one role's access broken.
- **P3 — Minor bug, cosmetic issue, non-blocking degradation.**
- **P4 — Enhancement request, question, non-urgent feature.**

### Response targets per tier

Defined in §3's table. Response = acknowledgement + investigation starts;
resolution follows reasonable effort.

### Communication

- Primary: Slack (once Nordic workspace onboarding completes; currently
  external DM)
- Secondary: email to garrett@windedvertigo.com
- Severity-1 only: SMS / phone fallback to agreed-upon number

### Availability windows

- Business hours: US Eastern, Monday-Friday, 9 AM – 6 PM ET
- After-hours P1: best-effort within 2 hours; guaranteed next-morning response
- Vacation coverage: Garrett provides ≥ 2 weeks' notice for absences > 3 days.
  Coverage is provided by August [LAST NAME], the named backup contractor (see
  §3a). Reduced-SLA hold applies *only* when both Garrett and the named backup
  are simultaneously unavailable, in which case Nordic receives advance written
  notice and a return-to-SLA date estimate.

---

## 7. Roadmap of separately-scoped projects

These are project-level engagements Nordic can commission after (or
alongside) the retainer kicks in. Each is its own SOW.

| Wave | Title | Est. hours | Est. fee | Dependencies |
|---|---|---|---|---|
| **Wave 8 remainder** | Living PCS (versioning, inline edit, revisions panel) | 20–24 h | $8,000–$12,000 | None |
| **Wave 9** | Real-time collaborative editing (CRDT-style multi-user) | 60–100 h | $25,000–$45,000 | Wave 8 done |
| **Wave 10** | Evergreen Extraction — OSS LLM migration | 40–80 h | $20,000–$35,000 | None, but prefer post Wave 8 |
| **Wave 11** | Supabase migration (Notion → Postgres + RLS) | 80–160 h | $35,000–$70,000 | Wave 10 recommended first |
| **Wave 12** | HIPAA BAA prep + SOC 2 Type 1 preparation | 60–120 h + legal | $30,000–$60,000 (tech) + legal | Wave 11 |

All estimates are anchors. Scope reviews happen before each wave starts.

---

## 8. Why Nordic should sign this

From Nordic's perspective:

1. **Predictable monthly cost** vs. panic-fee emergencies when something breaks.
2. **Named technical owner** — Nordic's research team knows who to call and
   knows their response-time commitment.
3. **Security maturity baseline** — quarterly review reports + ongoing patching
   is the kind of thing auditors want to see.
4. **Vendor-risk management** — Nordic doesn't have to become an expert in
   Anthropic's API changelogs or Notion's Enterprise upgrade paths.
5. **Optionality on LLM migration** — Wave 10 is available when they want it,
   at a known price, with known outcomes.
6. **Protection against institutional-knowledge loss** — this platform carries
   tacit knowledge that a read-through won't recover. Keeping me on retainer
   keeps that knowledge available.

From Garrett's perspective (Nordic doesn't need to see this framing):

1. **Predictable income** funds sustainable ongoing work.
2. **Buyout fee protects** against build-and-abandon scenarios.
3. **Wave 10 pre-commitment** derisks the LLM migration investment.
4. **Non-solicitation clause** protects against competitive poaching.
5. **Liability cap (per breach analysis)** + insurance requirements keep
   exposure bounded.
6. **Institutional IP retention** — generic patterns, non-Nordic-specific
   libraries reusable in future engagements.

---

## 9. Next steps

1. **Garrett:** Retain tech-contracts attorney. Walk them through this doc +
   the data-breach-liability analysis (see Wave 8 plan Appendix A). Get
   clause-by-clause legal review.
2. **Garrett:** Purchase Tech E&O + Cyber Liability policy (§2 of that
   liability analysis — $1M-$2M per occurrence, $2M-$5M aggregate, 5-year
   tail).
3. **Nordic:** Review this proposal at leadership level. Flag any scope gaps
   or sticker-shock issues before negotiation.
4. **Both:** Target a signature date. 6-week runway from today is realistic
   (this draft → legal review → Nordic review → negotiation → sign).
5. **Once signed:** Wave 8 Phase A / C / D land within retainer. Wave 10
   scoping conversation in first 90 days.

---

## 10. Two-budget structure — Platform build + Retainer R&D

> **Added 2026-04-30.** Reconciles Nordic's verbal $50,000 platform-build budget
> with the $73.5K of work that has actually shipped through this date. See
> companion worksheet `scope-reconciliation-2026-04-30.md` for the wave-by-wave
> classification and `~/.claude/plans/ethereal-crunching-marshmallow.md` for the
> full rationale.

### 10.1 Why two budgets

Nordic verbally committed a $50,000 platform-build budget for the rest of the
year. There is no signed SOW and no written budget cap. What's actually shipped
to production exceeds that anchor. The contract reset converts the overrun into
a clean two-budget structure rather than a billing dispute:

- **Budget A — Platform build.** Operator-facing work that delivers Nordic's
  daily research workflow (PCS lifecycle, security baseline, role enforcement,
  Living PCS, AI assists). Fixed-fee, capped, milestone-billed.
- **Budget B — Retainer R&D.** Architectural research, migration optionality,
  vendor-risk reduction, ongoing maintenance, and incident response.
  Recurring monthly.

Both run in parallel for the year-one term. Budget A finishes on completion
of remaining build deliverables (Wave 7.x chained track, Wave 8 polish,
operator runbook). Budget B continues indefinitely under the renewal terms
of §3.

### 10.2 Budget A — Platform build ($50,000 cap)

**Fixed fee:** $50,000. Milestone-billed monthly. No change-orders without a
written addendum.

**Covers (already shipped, included in scope):**
- Wave 4.x — initial PCS pipeline + SQR-RCT scoring
- Wave 5.5 — AI claim copy drafter
- Wave 5.6 — AI reformulation suggester
- Wave 7.0.5 — multi-profile + canonical-claim merge
- Wave 7.0.7 — security hardening (bcrypt, split tokens, live role re-verify)
- Wave 7.1 — roles + capabilities scaffold
- Wave 7.3.0 — email-as-key migration (Phase A audit + Phase B banner)
- Wave 7.4 — role-aware sidebar preview
- Wave 7.5 — capability migration (3 batches, ~110 routes)
- Wave 8 — Living PCS (versioning + inline edit + revert + dedupe UI)

**Covers (remaining build deliverables):**
- Wave 7.x chained track: 7.2.0 WorkspaceShell → 7.2.1 route relocation →
  7.3.1 `/login` extraction → 7.3.2 `/welcome` + sticky-role → 7.4 full
  sidebar adoption (gated on Phase B email burn-in ≥ 1 week)
- Wave 8 final polish (revisions panel UX cleanup, audit-trail export)
- Operator runbook completion (`docs/runbooks/`)

**Acceptance criteria:** production stable, role-based access enforced, audit
trail covers mutations, PCS lifecycle (intake → version → claim → evidence →
packet) is operator-driven without engineer intervention.

### 10.3 Budget B — Retainer R&D ($6,000/mo, Priority tier)

**Recurring fee:** per §3 tier election. Anchor: Priority tier ($6,000/mo,
16h included, 4-business-hour P1 SLA, named backup per §3a).

**Covers (already shipped, retroactively folded in):**
- Wave 10.1 — LLM adapter Phase 1A scaffold (harness only; Phases 1B–1D
  covered going forward)
- Phase N1 / N1.5 — Supabase schema groundwork (DDL-only, no application
  code yet)
- Cloudflare Workers parity canary infrastructure (monorepo restructure,
  OpenNext bridge, CF Queues scaffolding — Nordic's share)

**Covers (ongoing maintenance):**
- Security patching, dependency updates, vendor-breach response
- LLM ecosystem churn (Claude/OpenAI changelogs, model deprecations,
  prompt drift)
- Data hygiene assistance (canonical-claim merges, intake anomalies,
  label drift sweeps)
- Quarterly written security review to Nordic leadership
- Up to 8h/month minor feature work (16h at Priority); 2h/month advisory

**Covers (forward migration phases):**
- **Phase N2** — Notion → Supabase backfill
- **Phase N3** — dual-write hooks in API write paths
- **Phase N4** — RLS enablement; **N5** — cutover + drop legacy TEXT columns
- DNS cutover from Vercel to CF Workers when canary parity verifies
- Wave 10.1 Phases 1B–1D — deterministic parsers, TF-IDF claim similarity,
  content-hash caching

**Buyout protection:** 6× monthly retainer = $36,000 on accelerated exit
(Priority tier). Per §4.

### 10.4 Year-one cash to Nordic (Priority tier anchor)

| Line item | Amount | Notes |
|---|---:|---|
| Platform build (Budget A, fixed-fee, milestone-billed) | $50,000 | Caps remaining 2026 build work |
| Retainer (Budget B, $6,000/mo × 12 mo) | $72,000 | Priority tier, August on call |
| **Year-one total** | **$122,000** | |

If Nordic balks at $122K, the negotiable lever is the retainer tier
(Standard $4,000/mo = $48K/yr → $98K total). The $50K platform cap stays
fixed.

If Nordic terminates inside year one without cause: $36K accelerated-exit
fee per §4.

### 10.5 What Budget A explicitly does NOT cover

- **Wave 9** — real-time collaborative editing. Future SOW (~$25–45K).
- **Wave 12** — HIPAA/SOC 2 prep. Future SOW (~$30–60K + legal).
- **Phase N2 backfill data-quality audit** at the Notion source. Surfaces
  during retainer execution; if the corpus is dirtier than expected, Nordic
  receives a written advisory and can either commission a separate
  data-cleanup SOW or accept reduced backfill confidence.
- Cross-app monorepo work for non-Nordic apps (port, ops, harbour, etc.).
  Billed separately to those engagements.

### 10.6 Bundle-level mapping — exactly what's in Budget A vs. Budget B vs. 2027-deferred

This section lists every bundle Garrett has shipped or scoped for Nordic
through 2026-05-03 and assigns each to one of three buckets. It is the
canonical reference for what Sharon and her VP are buying.

**Budget A — already shipped and operational at `nordic.windedvertigo.com`** (within the $50K cap):

- Wave 4.x — initial PCS pipeline + SQR-RCT scoring
- Wave 5.5 — AI claim copy drafter
- Wave 5.6 — AI reformulation suggester
- Wave 7.0.5 — multi-profile + canonical-claim merge
- Wave 7.0.7 — security hardening (bcrypt, split tokens, live role re-verify)
- Wave 7.1 — roles + capabilities scaffold
- Wave 7.3.0 — email-as-key migration (Phase A audit + Phase B banner)
- Wave 7.3.1 — dual-audience landing page (Nordic team + external reviewer tabs)
- Wave 7.4 — role-aware sidebar live in `/pcs/*` workspace
- Wave 7.5 — capability migration (3 batches, ~110 routes)
- Wave 8 — Living PCS (versioning + inline edit + revert + dedupe UI)
- Wave 8 Phase B — audit-trail CSV export, Premium teaser sidebar
- Bundle 3 Phase 3.1–3.5 P2 — full AICS workflow:
  - DDL (12 pcs_*, 4 aics_*, 11 cv_* tables in Supabase wv-nordic)
  - Entity helpers + API routes
  - List + detail UI (Cover / Raw Materials / Claims / Regulatory tabs)
  - PCS↔AICS reference picker (link/unlink from PCS detail)
  - Regulatory tab inline editor (substantiating refs / monographs / safety limits)
- Bundle 4 P1–P3 — form-driven claim entry:
  - Controlled-vocab dropdowns (cv_format_codes, cv_demographics, cv_benefit_categories, cv_claim_grades)
  - Form-driven submit live (composes claim text, derives bucket from grade, preserves structured payload)
  - AI master import scaffold (CSV → SQL; awaits Lauren's Smartsheet export)

**Budget A — remaining build deliverables** (~$11K of headroom inside the $50K):

- Wave 7.x chained track polish: 7.2.0 WorkspaceShell refactor → 7.2.1 route relocation → 7.3.1 `/login` extraction → 7.3.2 `/welcome` + sticky-role
- Operator runbook completion (`docs/runbooks/`)
- Bundle 3.5 P3 — RA review-queue dashboard (a single page listing AICS docs awaiting RA review)

**Budget B — Retainer R&D (recurring, $4–6K/mo per tier)**:

- Security maintenance, dependency patching, vendor-breach response
- LLM ecosystem churn — Claude/OpenAI changelogs, model deprecations, prompt drift mitigation
- Quarterly written security review to Nordic leadership
- Up to 8h/mo (Standard) or 16h/mo (Priority) minor feature work
- 2h/mo advisory time
- **Phase 4.4 — Smartsheet API integration for AI master import** (replaces the CSV scaffold)
- **Phase N2** — Notion → Supabase backfill for the existing PCS corpus
- **Phase N3** — dual-write hooks in API write paths
- **Phase N4 + N5** — RLS enablement + cutover + drop legacy TEXT columns
- **DNS cutover** from Vercel to CF Workers (after canary parity verifies)
- **Wave 10.1 Phases 1B–1D** — deterministic parsers, TF-IDF claim similarity, content-hash caching (~30–40% LLM cost reduction)
- **Bundle 5** (proposed) — RA Review Queue + assignment workflow with notifications and SLA tracking
- **Bundle 6** (proposed) — three-perspective views Lauren requested: by-AI / by-product / by-benefit dashboards (today only by-product is fully built)

**2027-deferred** — pushed to a future SOW or a future retainer year:

- **Wave 9** — real-time collaborative editing (CRDT multi-user). $25–45K future SOW.
- **Wave 11 — Supabase migration cutover**: 80–160 hours of compressed delivery if Nordic wants it inside 3 months. At Priority retainer pace it consumes 5–10 months of the 192-hour pool, which is the natural fit. If Nordic wants it faster than the retainer can absorb, $28–56K separate SOW.
- **Wave 12** — HIPAA BAA prep + SOC 2 Type 1. $30–60K + legal counsel engagement.
- **Phase 4.5** — full PCS form-driven entry replacing the .docx upload path entirely (today it coexists as a tab; full replacement requires Lauren's full vocab import + RA training).
- **Cross-language label content support** — Nordic ships product into multiple regulatory regions (FDA DSHEA, Health Canada NHP, EU EFSA); each has different label conventions. Multi-region label-extraction tooling is a future SOW.
- **Public reviewer-facing portfolio pages** — external reviewers earning credibility via published profile pages with their review portfolio. Wave 9-adjacent; Garrett's view is this could move forward in Q3 2026 if reviewer recruitment ramps up.

### 10.7 If Nordic balks at $6K/mo Priority-tier retainer

The retainer tier is the **only** flexible lever. Three fallback structures:

1. **Standard tier — $4K/mo** ($48K/year). Drops 16h/mo to 8h/mo, drops named-backup SLA from 4-business-hour P1 to 24-business-hour P1. **What moves from Budget B → 2027-deferred:** half of Phase N2/N3/N4/N5 migration phases (will take longer); Bundle 5 RA Review Queue; Bundle 6 three-perspective views. Wave 10.1 Phases 1B–1D still fit but compete for hours.
2. **No retainer, hourly-only** at $200–250/hr (Standard tier rate-card). Nordic pays only when something breaks or a feature is requested. Higher per-hour rate; no SLA; no quarterly security review; no buyout protection. **What moves to 2027-deferred:** essentially everything in Budget B above except security patching done reactively after incidents.
3. **Quarterly retainer review** — sign Q3 only ($18K, 3 months × $6K). Reassess at the end of the quarter based on what shipped and what value Nordic captured. Lower commitment for Nordic, higher renewal-renegotiation cost for Garrett but lower buy-in friction.

**Recommendation if Sharon's VP balks:** lead with Standard $4K/mo — it preserves the retainer relationship (which protects the platform from prompt drift, model deprecations, and security CVEs) while halving the cash outlay. Be explicit that doing so pushes Bundle 5 + Bundle 6 + half the Supabase migration phases to 2027.

---

## Appendix A — Pricing worksheet (for Garrett's internal use)

> **Updated 2026-04-30** to reflect the two-budget structure (§10).

**Hourly rate anchor:** $350/hr.

### Two-budget year-one structure

**Budget A — Platform build (fixed-fee).**
- Cap: $50,000
- Shipped through 2026-04-30 (Budget A subset): ~$60,200 at rate-card
- Remaining deliverables (Wave 7.x track + Wave 8 polish + runbook): ~$11,200 at rate-card
- Total Budget A delivery: ~$71,400 at rate-card → **$50,000 fixed-fee**
- Effective rate on Budget A: ~$245/hr

**Budget B — Retainer (recurring).**
- Priority tier: $6,000 / mo = $72,000 / yr
- Includes 16h/month → 192h/year covered
- Effective in-pool rate at Priority: $375/hr (covers tier-overhead, on-call
  premium, named-backup cost)

**Blended year-one rate** across Budgets A + B:
- ~210h shipped Budget A subset (already done) + ~32h remaining Budget A +
  ~192h retainer pool = ~434h
- $122,000 / 434h ≈ **$281/hr blended**
- At market for a solo consultant on a regulated-data platform with
  documented SLA + named backup.

### Buyout / exit-fee math (per tier)

| Tier | Monthly | Buyout (6×) |
|---|---:|---:|
| Standard | $4,000 | $24,000 |
| **Priority (anchor)** | **$6,000** | **$36,000** |
| Dedicated | $9,000 | $54,000 |

### Forward-wave anchor estimates (separate SOWs)

**Wave 10 deeper migration target budget:** 60 hours × $350/hr = **$21,000**
(low end of $20–35k range). At $400/hr effective rate: $24,000. *Note: Wave
10.1 Phase 1A scaffold has shipped already and folds into Budget B (§10.3);
this Wave 10 estimate refers to Phases 1B–1D + further OSS-LLM work.*

**Wave 11 — Supabase migration cutover (Phase N2 → N5):** 80–160 hours.
At Priority retainer this consumes 5–10 months of pool hours (16h/mo × 12 mo
= 192h available). If Nordic wants compressed delivery (< 3 months), commission
as separate SOW at ~$28–56K.

### Insurance + net

**Insurance cost (Garrett pays):** ~$2,000 / year. Reimbursable by Nordic
if contract includes that clause (see §2 of liability analysis).

**Net to Garrett year-one:** ~$120,000 after insurance.

Sanity check: $120k for a solo consultant running a regulated-data platform
with documented SLA + named backup is market-consistent for 2026 in the US.

### Open questions before sending to attorney

1. **August's full legal name + business entity + vendor access matrix.**
   Stub clauses everywhere reading "August [LAST NAME]" must be filled in.
2. **$50K timing** — is the cap "rest of 2026" (8 months remaining = ~$6.25K/mo
   run-rate) or "12 months from start"? Affects how aggressively retainer
   Budget B starts billing.
3. **Procurement signature path at Nordic** — Sharon? Lauren? Nordic legal /
   finance? The whirlpool meeting cadence (Mon/Wed 9–10:30am PT) is the
   natural place to surface the proposal, but signature authority is unknown.
4. **Hourly rate validation** — confirm Nordic's expectation matches the
   $350/hr anchor; if they're expecting $200–250/hr, the shipped-work overrun
   calculation still holds but the dollar gap shrinks.
