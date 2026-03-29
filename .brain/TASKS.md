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
- [ ] **Verify ops OAuth flow** — Garrett: visit ops.windedvertigo.com incognito → should redirect to /login → SSO → dashboard with sign-out button
- [ ] **Set up Cloudflare KV for ops data** — Create namespace, wire to dispatch tasks
- [ ] **Wire QuickBooks into ops dashboard** — Dispatch task pushes P&L, cash flow, invoices to KV → API routes read from KV
- [ ] **Wire Gusto into ops dashboard** — Dispatch task pushes payroll, team, contractor data to KV
- [ ] **Connect wv-ops to GitHub** — Enable auto-deploy on push (currently CLI-only)
- [ ] **Shared auth package** — Consider extracting Auth.js config to `packages/auth` for CRM + ops reuse
- [ ] **Ops dashboard: project tracker** — Pull active projects from Notion into ops view
- [ ] **Middleware → proxy migration** — Next.js 16 deprecation. Not urgent — middleware works for dynamic routes. Migrate CRM + ops together when proxy convention stabilizes

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
