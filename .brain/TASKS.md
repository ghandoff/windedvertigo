# Tasks

## Whirlpool actions — 2026-04-15 (harbour playtest + strategy sprint)
- [ ] **garrett** — send cold outreach campaign to remaining organisations after meeting
- [ ] **team** — hold writing retreat on monday (apr 21) focused on "play, aliveness, justice" substack piece
- [ ] **payton** — create miro board with topics and angles before monday's writing retreat
- [ ] **garrett** — move play date booking interface to "the port" with pre-meeting questions ("what made you book?" / "i'd love to talk about…")
- [ ] **garrett** — pilot 2–4 harbour games per category; deprioritise breadth in favour of quality
- [ ] **team** — research play therapists as target audience (UK play therapy association as potential partner)
- [ ] **team** — use one harbour game as opener for future whirlpool meetings (cycle through raft house categories over 10–12 sessions)

## Whirlpool actions — 2026-04-13 (the world prowl — play session)
*This session was a dedicated sandbox/play experience. No new business action items. All April 8 items carry forward to Wednesday's whirlpool (Apr 15).*

## Whirlpool actions — 2026-04-08 (w.v x press.play)
- [ ] **garrett** — set up google drive folder and share with press play team
- [ ] **team** — upload documentation of past conference experiences to shared folder
- [ ] **team** — organize documentation into buckets/categories (small engagements → full conferences)
- [ ] **garrett** — draft doc proposing service tiers for conference offerings
- [ ] **press play** — translate danish testimonials to english
- [ ] **garrett** — schedule next w.v x press play for april 22, same time
- [ ] **garrett** — set up email chain or slack channel for ongoing press play comms
- [ ] **team** — follow up on cold email outreach responses and refine approach

## Active
- [ ] **IDB Salvador documentation — April 10 deadline** — Submit to nadia.nochez@mined.gob.sv as single consolidated digital file.
  - **Legal docs (Garrett to pull):**
    - [ ] Articles of Incorporation / Certificate of Formation for WV LLC
    - [ ] Legal representative credential registered with Commercial Registry
    - [ ] Photocopy of Garrett's ID
    - [ ] EIN / Tax Registry document
  - **Project references — READY:**
    - [x] PPCS / PRME — Signed contract amendment in Google Drive
    - [x] Superskills! / LEGO — Contract + invoicing in Google Drive
  - **Project references — NEED FROM COLLECTIVE:**
    - [ ] Autism Education Trust (UK Dept of Education) — ask collective member who led this
    - [ ] ECO966 / CONOCER / DIF (Mexico) — ask collective member who led this
    - [ ] Solihull Inclusive Education Strategy — ask collective member who led this
    - [ ] NSIT / New School for Neurodiversity (Japan) — ask collective member who led this
  - **Assembly:**
    - [ ] Compile all docs into single consolidated PDF
    - [ ] Draft signed cover note to Director of Public Procurement
    - [ ] Final review with Maria before submission
- [x] ~~**PRME 2026 contract** — Signed. Approved PO received Thu Mar 27. First invoice submitted same day.~~ (2026-03-27)
- [ ] **Amna at 10 proposal** — Follow up on submission (sent Mar 26 to Jonelle and Walaa)
- [ ] **401k / CPA coordination** — Finalize TPA arrangement for final 5500 + year-end testing with ADP (Alyssa Wong)
- [ ] **Website feedback** — 2 responses collected via #website-feedback (both flag newcomer discoverability). Scope "what we do" clarity improvement → log for Claude Code.
- [ ] **Sesame Workshop close-out** — Received pass 31 March. Draft graceful close-out reply.
- [ ] **Amna at 10 follow-up** — 8 days since proposal submission (26 March). Send follow-up to Jonelle and Walaa.
- [ ] **Whirlpool promotion** — Post teaser for 06 April session on LinkedIn/Bluesky
- [ ] **Resend webhook registration** — Register webhook URL + set RESEND_WEBHOOK_SECRET in Resend dashboard to unblock campaign tracking
- [ ] **Attio CRM trial** — Trial ending. Decide: keep or cancel.
- [ ] **Populate financial memory** — Share CPA info, bank details, annual revenue targets, expense budget with Claude to complete financial.md

## Waiting On
- [ ] **Collective members — IDB project docs** — Requests sent for AET, ECO966, Solihull, NSIT references — since (today)
- [ ] **Amna proposal response** — Submitted to Jonelle and Walaa — since Mar 26
- [ ] **Website feedback** — Circulated to trusted contacts — since Mar 27

## Engineering (Claude Code)

### CRM — Phase 1: Data Visibility (this week)
- [x] ~~**Aggregate campaign dashboard**~~ (2026-03-29) — Stats strip on `/campaigns`: active / total, emails sent, avg open rate, avg click rate.
- [x] ~~**Resend webhook → Notion sync**~~ (2026-03-29) — Route was implemented but blocked by middleware (returning 401). Fixed public allowlist. **Still needed:** register webhook URL + `RESEND_WEBHOOK_SECRET` in Resend dashboard.

### CRM — Phase 2: Relationship Depth (next sprint)
- [x] ~~**Deal / opportunity pipeline**~~ (2026-03-29) — Kanban `/deals` (5 stages). Notion DB created. Drag-and-drop. Full CRUD API. Sidebar nav added.
- [x] ~~**Per-contact activity timeline**~~ (2026-03-29) — ActivityTimeline + LogActivityDialog wired into org detail page `/organizations/[id]`.
- [x] ~~**Won/lost reason capture**~~ (2026-03-29) — LostReasonModal in DealKanban intercepts drag to "lost", captures reason + notes before PATCH.

### CRM — Phase 3: Intelligent Outreach (after campaign data)
- [x] ~~**Email reply detection + sequence auto-pause**~~ (2026-03-29) — `lib/gmail.ts` + `api/cron/sync-replies` polls Gmail daily at 8:55am, writes "email received" Activities. Campaign cron filters replied orgs before each send. Gmail OAuth set up for garrett@windedvertigo.com; all 3 env vars live in Vercel production.
- [x] ~~**Sequence step scheduling**~~ (2026-03-29) — `api/cron/campaigns` runs daily at 9:07am (was incorrectly hourly — fixed). Evaluates `sendDate` or `campaignStart + cumulativeDelayDays` per step. Auto-marks campaign complete when all steps sent/skipped.

### CMO / Marketing Infrastructure (NEW)
- [ ] **Ops dashboard: marketing module** — content calendar widget, campaign metrics widget, pipeline summary widget. Full spec in `.brain/memory/marketing/claude-code-prompt.md`
- [ ] **CRM: content drafting workspace** — new `/content` route for drafting social posts and newsletter content, saves to Notion "content calendar" DB
- [ ] **CRM: campaign analytics enhancement** — weekly summary card on `/campaigns` page
- [ ] **Notion: create content calendar DB** — properties: title, channel, body, scheduled date, status, author
- [ ] **KV keys for marketing data** — add `marketing:content-calendar`, `marketing:campaign-metrics`, `marketing:pipeline-summary` to ops API
- [ ] **TypeScript types for MarketingSnapshot** — add to `ops/lib/types.ts`
- [ ] **Nav updates** — add "marketing" to ops sidebar, "content" to CRM sidebar

### raft.house — Next Waves
- [x] ~~**Wave 1: core platform**~~ (2026-03-31) — PartyKit server, 4 activity types (poll, prediction, reflection, open-response), facilitator dashboard, participant mobile view, join flow, timer, pause/resume
- [x] ~~**Wave 2: puzzle + asymmetric activities**~~ (2026-03-31) — Collaborative sequencing puzzles, asymmetric info role-play. 2 whirlpool session templates (play as pedagogy, sunk cost trap)
- [x] ~~**Deploy + CMS**~~ (2026-03-31) — Live at windedvertigo.com/harbour/raft-house. Notion sessions database. QR code sharing. ISR facilitate page.
- [x] ~~**Wave 3: canvas + sorting + rule-sandbox**~~ (2026-03-31) — Canvas (spatial pin placement with zones/axes), sorting (card categorization with solution scoring), rule-sandbox (parameter sliders + safe arithmetic evaluator). "Systems thinking" demo template.
- [x] ~~**Session results export**~~ (2026-03-31) — Markdown report with per-activity responses, poll tallies, prediction scoring, puzzle sequence comparison. Browser-side Blob download.
- [x] ~~**WebSocket reconnect fix**~~ (2026-03-31) — Exponential backoff (1s → 16s, 10 max attempts), connectTrigger state counter, visual reconnecting/failed states.
- [x] ~~**Custom session builder**~~ (2026-03-31) — Facilitator designs activity sequences from scratch with config editors for all 9 activity types. Replaces "coming soon" placeholder.
- [x] ~~**Session history**~~ (2026-03-31) — Auto-saves completed sessions to Notion "session results" DB. Facilitator can browse past sessions at /facilitate/history and view detailed results.

### Ops / Infrastructure
- [ ] **Verify ops OAuth flow** — Garrett: visit ops.windedvertigo.com incognito → should redirect to /login → SSO → dashboard with sign-out button
- [x] ~~**Set up Cloudflare KV for ops data**~~ — KV wired: API routes read from KV with static fallback, POST /api/kv for dispatch writes (2026-03-29)
- [x] ~~**Connect wv-ops to GitHub**~~ — Auto-deploy: `ghandoff/windedvertigo` → rootDirectory `ops/` (2026-03-29)
- [x] ~~**Ops dashboard: project tracker**~~ — Notion integration fetches from shared projects DB with static fallback (2026-03-29)
- [x] ~~**Set env vars on Vercel for ops**~~ (2026-03-29) — All 10 env vars set including CLOUDFLARE_API_TOKEN. Redeployed.
- [ ] **Wire QuickBooks into ops dashboard** — Cowork dispatch task pushes P&L, cash flow, invoices to KV → ops reads from KV (Cowork task)
- [ ] **Wire Gusto into ops dashboard** — Cowork dispatch task pushes payroll, team, contractor data to KV (Cowork task)
- [x] ~~**Shared auth package**~~ (2026-03-29) — Extracted to `packages/auth`. CRM + ops re-export from `@windedvertigo/auth`.
- [ ] **Middleware → proxy migration** — Scoped: ~1hr, low risk. Rename middleware.ts → proxy.ts in both apps. Park until next deploy cycle.

## Someday
- [x] ~~**Monthly close scheduled task**~~ (2026-03-29) — Runs 1st of month 9am ET. Pulls P&L + cash flow from QuickBooks, pushes to ops KV.
- [x] ~~**Weekly ops review task**~~ (2026-03-29) — Runs Sundays 6pm ET. Full operational review: finance, projects, calendar, team → pushes all data to ops KV + Slack summary.
- [x] ~~**Daily briefing task**~~ (2026-03-29) — Runs weekdays 8am ET. Calendar, priorities, deadlines, overnight emails → Slack DM.
- [x] ~~**Meeting prep automation**~~ (2026-03-29) — Runs weekdays 7:30am ET. Gathers context for each meeting: recent emails, Notion notes, CRM history → Slack DM.
- [ ] **CRM build-out** — Expand package builder and client relationship tracking
- [x] ~~**Quarterly strategic review**~~ (2026-03-29) — Runs first Monday of Jan/Apr/Jul/Oct at 10am ET. Full portfolio review: financials, projects, pipeline, team, next-quarter priorities.

## Done
- [x] ~~Ops auth fix + design system + API routes~~ (2026-03-28) — Auth was broken because static page bypassed middleware. Converted to server component with auth gate. Added sign-out, user email, dynamic date. Imported shared tokens. Created 6 API routes. Deployed.
- [x] ~~Second brain architecture — CLAUDE.md, memory/, TASKS.md built~~ (2026-03-28)
