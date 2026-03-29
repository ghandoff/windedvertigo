# Tasks

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
- [ ] **Website feedback** — Collect responses from soft launch circulation (Payton sent Mar 27)
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
- [ ] **Email reply detection + sequence auto-pause** — Detect replies by thread ID via Gmail/Resend webhook; halt further campaign steps for that contact.
- [ ] **Sequence step scheduling** — Timed multi-step follow-up with configurable delays. Vercel Cron evaluates pending steps daily. Requires reply detection first.

### Ops / Infrastructure
- [ ] **Verify ops OAuth flow** — Garrett: visit ops.windedvertigo.com incognito → should redirect to /login → SSO → dashboard with sign-out button
- [x] ~~**Set up Cloudflare KV for ops data**~~ — KV wired: API routes read from KV with static fallback, POST /api/kv for dispatch writes (2026-03-29)
- [x] ~~**Connect wv-ops to GitHub**~~ — Auto-deploy: `ghandoff/windedvertigo` → rootDirectory `ops/` (2026-03-29)
- [x] ~~**Ops dashboard: project tracker**~~ — Notion integration fetches from shared projects DB with static fallback (2026-03-29)
- [ ] **Set env vars on Vercel for ops** — CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_WRITE_TOKEN, NOTION_TOKEN
- [ ] **Wire QuickBooks into ops dashboard** — Dispatch task pushes P&L, cash flow, invoices to KV → API routes read from KV
- [ ] **Wire Gusto into ops dashboard** — Dispatch task pushes payroll, team, contractor data to KV
- [ ] **Shared auth package** — Consider extracting Auth.js config to `packages/auth` for CRM + ops reuse
- [ ] **Middleware → proxy migration** — Next.js 16 deprecation. Not urgent. Migrate CRM + ops together when proxy convention stabilizes.

## Someday
- [ ] **Monthly close scheduled task** — Build dispatch task for 1st-of-month P&L generation
- [ ] **Weekly ops review task** — Build dispatch task for Friday/Sunday operational review
- [ ] **Daily briefing task** — Build dispatch task for morning priorities + calendar overview
- [ ] **Meeting prep automation** — Build dispatch tasks for pre-meeting context preparation
- [ ] **CRM build-out** — Expand package builder and client relationship tracking
- [ ] **Quarterly strategic review** — Design the template and schedule

## Done
- [x] ~~Ops auth fix + design system + API routes~~ (2026-03-28) — Auth was broken because static page bypassed middleware. Converted to server component with auth gate. Added sign-out, user email, dynamic date. Imported shared tokens. Created 6 API routes. Deployed.
- [x] ~~Second brain architecture — CLAUDE.md, memory/, TASKS.md built~~ (2026-03-28)
