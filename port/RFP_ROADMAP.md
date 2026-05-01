# RFP Radar — Dev Roadmap

Informed by the most-used features of Qvidian, Responsive (RFPIO), Loopio, and the specific workflow needs of winded.vertigo (5-person consultancy, 5–20 RFPs/month).

**Last updated:** 2026-04-02

---

## What's already built

- RFP discovery via RSS feeds and manual entry
- Kanban pipeline (radar → reviewing → pursuing → interviewing → submitted → won/lost/no-go/missed deadline)
- Auto-generated proposal drafts via Inngest + Claude when an opportunity moves to "pursuing"
- Proposal draft status, generation timing, and Notion deal page link visible on kanban cards
- Duplicate detection on deal kanban
- BD assets database (content library)
- Deal tracking with org name, value, close date, proposal link, document links
- Proposal guidelines (`lib/ai/proposal-guidelines.md`) governing all auto-generated drafts
- Named team members with SME tags in proposals
- Real citations auto-added to annotated bibliography
- Gaps-to-fill tasks auto-created in tasks database with assigned owners

---

## Tier 1 — Highest ROI

### ✅ 1. RFP document ingestion
**Status:** in progress
**Effort:** medium | **Impact:** very high

All three enterprise tools do this first. Currently Claude generates proposals from a title, fit score, and manually-typed `requirementsSnapshot`. Feeding the actual RFP document dramatically improves specificity — especially Understanding of Requirements and Proposed Approach.

**Implementation:**
- Add `rfp document` URL property to RFP Radar Notion database
- `POST /api/rfp-radar/[id]/document` — accept PDF/TXT upload → store to R2 → extract requirements via Claude → update `requirementsSnapshot` on Notion record
- Inngest proposal job: if `rfpDocumentUrl` exists and `requirementsSnapshot` is sparse, fetch and extract before generating
- Upload button on RFP kanban cards and/or detail view

---

### ✅ 2. BD asset health monitoring
**Status:** in progress
**Effort:** low | **Impact:** high

Loopio's most-cited quality feature. BD assets get stale — a 2022 case study described as "ongoing" in a 2026 proposal is a credibility problem.

**Implementation:**
- Weekly Inngest cron job (`bd-assets/health.check`)
- Queries all BD assets, finds ones with `lastEditedTime` > 12 months ago
- Posts a Slack digest to Garrett listing stale assets with Notion links
- Future: add `needsRefresh` checkbox to BD assets Notion schema, surface in `/assets` page

---

### ✅ 3. Win/loss analytics
**Status:** in progress
**Effort:** low–medium | **Impact:** high

Qvidian sells this as a premium feature. The pipeline data is all in Notion. Surfacing conversion rates by source, fit tier, and opportunity type shows where the pipeline leaks and which lead sources are worth investing in.

**Implementation:**
- New section in `/analytics` page: "RFP pipeline"
- Stats: total active, total pipeline value, win rate, avg time to outcome
- CSS bar chart: conversion by source (RFP Platform / Google Alert / Partner Referral / etc.)
- CSS bar chart: win rate by fit score tier (high / medium / low)
- Recent outcomes table (last 5 won + lost with value and source)

---

### ✅ 4. Submission follow-up reminders
**Status:** in progress
**Effort:** low | **Impact:** medium–high

No current mechanism prompts follow-up after submission. Enterprise tools track "expected decision date" and alert at T-7 and T-0.

**Implementation:**
- Inngest cron job (`rfp/submission.followup`) — runs daily
- Queries submitted RFPs where `dueDate` is >7 days in the past and status is still "submitted"
- Posts Slack nudge to Garrett listing each stale submission with opportunity name, value, and Notion link

---

## Tier 2 — Next quarter

### 5. Go/no-go structured scorecard
**Status:** not started
**Effort:** medium | **Impact:** medium

Currently `wvFitScore` is a single-select gut call. A five-factor rubric (budget fit, capability match, relationship warmth, strategic alignment, competition level) makes the rating defensible and consistent.

**Implementation:**
- Modal triggered when an RFP is created or moves to "reviewing"
- Five scored questions (1–3 each) auto-calculate a composite score
- Composite maps to high/medium/low/TBD and writes to `wvFitScore`

---

### 6. RFP question set parser + BD asset matching
**Status:** not started
**Effort:** high | **Impact:** high (especially for IDB/UN formal RFPs)

Responsive and Loopio's core bread-and-butter feature. Upload an Excel or Word questionnaire → tool matches each question to content library entries → Claude synthesises into a response list.

**Implementation:**
- Parse uploaded RFP documents for discrete numbered questions
- Semantic search of BD assets for each question
- Pre-populate a "question bank" response list Claude can reference during proposal generation
- Especially relevant for IDB, MINEDUCYT, UN-format procurement documents

---

### 7. Deadline → Google Calendar integration
**Status:** not started
**Effort:** low | **Impact:** medium

Auto-create a Google Calendar event when an RFP moves to "pursuing", with reminder 5 days before the due date. The GCal MCP is already available.

**Implementation:**
- In the PATCH route for pursuing status change, call GCal MCP to create an event
- Event title: `[RFP] {opportunityName} — submission due`
- Reminder: 5 days before `dueDate`

---

## Tier 3 — When volume justifies it

### 8. Content reuse tracking
**Status:** not started
**Effort:** low | **Impact:** medium

When Inngest writes `relevantExperience` to the Notion deal page, increment a `timesUsed` counter on the referenced BD asset. After several months this shows which assets are load-bearing and which are never cited. Pairs with health monitoring (item 2) to identify what to retire or refresh.

---

### 9. Lightweight review workflow
**Status:** not started
**Effort:** low | **Impact:** medium

A `ready-for-review` status between generating and complete triggers a Slack message to Garrett with a direct Notion link. Prevents half-baked drafts from being treated as submission-ready.

---

### 10. Win/loss debrief capture
**Status:** not started
**Effort:** medium | **Impact:** high (long-term)

When a deal is marked won or lost, prompt for a structured debrief: what did the client respond to, what fell flat, what was missing. Link back to the proposal draft. Over 12–18 months this becomes a feedback loop that improves proposals in ways the content library alone can't.

---

### 11. Annotated bibliography semantic search
**Status:** not started
**Effort:** medium | **Impact:** differentiation

A semantic search over the annotated bibliography, wired into proposal generation as a `relevantCitations` input alongside BD assets. None of the enterprise competitors treat academic rigour as a surfaceable capability. This is a genuine moat for w.v. in the sub-$5M consultancy space.

---

## Technical notes

- **Background jobs:** Inngest (free tier: ~2,000 fn calls/month). Register all functions in `port/app/api/inngest/route.ts`.
- **File storage:** Cloudflare R2 via `lib/r2/`. Pattern: `uploadAsset(buffer, key, contentType)`.
- **Proposal guidelines:** `lib/ai/proposal-guidelines.md` — governs all auto-generated drafts, referenced by system prompt in `lib/ai/proposal-generator.ts`.
- **Notion schema changes:** Use `PATCH /v1/databases/{id}` with the Notion REST API. RFP Radar DB ID: `685b0a16-d861-4380-b04a-f6ac276b9319`.
- **Slack:** `lib/slack.ts` — `postToSlack(text)`.
