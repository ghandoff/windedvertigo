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
| **Dedicated** | 1 business hour | 4 business hours | 24 h included + named-backup | $9,000 / mo |

Over-limit hours billed at $200 / hr (standard) or $175 / hr (priority+).

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
- Vacation coverage: Garrett provides 2 weeks' notice for absences > 3 days,
  designates backup contact (or reduced-SLA hold) during those windows

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

## Appendix A — Pricing worksheet (for Garrett's internal use)

**Retainer target income:** $72,000 / year = $6,000 / mo → Priority tier.

**Buyout protection:** $6k × 6 = **$36,000 exit fee** on accelerated termination.

**Wave 10 target budget:** 60 hours × $350/hr = **$21,000** (low end of the
$20-35k range). At $400/hr effective rate it's $24,000.

**First-year total to Nordic (including Wave 8 remainder + Wave 10):**
  - Wave 8 C-D: ~$10,000
  - Retainer (12 mo × $6,000): $72,000
  - Wave 10: ~$25,000
  - **Total: $107,000 / year-one**

**Insurance cost (Garrett pays):** ~$2,000 / year. Reimbursable by Nordic
if contract includes that clause (see §2 of liability analysis).

**Net to Garrett year-one:** ~$105,000 after insurance.

Sanity check: $105k for a solo consultant running a regulated-data platform
with documented SLA is market-consistent for 2026 in the US.
