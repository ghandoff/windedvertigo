# Tasks

## Completed 2026-04-26 — harbour launch-readiness session

- [x] **Phase 0 wrap-up complete** — image-failure counter on harbour cron, sweep guard + restored 5 seeded SKUs (migration 053), doc drift closed.
- [x] **Phase 1 SSO verification** — Pool A (creaseworks/vault/depth-chart/harbour), Pool B (port), Pool C (ops) all verified via Chrome MCP. Three-pool architecture documented at `harbour-apps/docs/security/auth-pool-audit-2026-04-25.md`.
- [x] **Phase 2 + 2.5** — port AUTH_URL verified, /crm 308 verified, creaseworks AUTH_URL fix shipped (silenced env-url-basepath warnings).
- [x] **Phase 3a** — harbour magic-link signin live; joined Pool A SSO as 4th app. Same `userId f0e3ec80-…` across all four. `apps/harbour/lib/auth.ts` uses `createHarbourAuth({ appName: "" })`. 7 secrets on `wv-harbour-harbour` Worker.
- [x] **Phase 3b code + deploy** — Google OAuth on harbour. Reuses existing OAuth client `160968051904-ud88va6odnnjlp76j5dlc4qfd8upq2lp`. Worker version `8f5edc0d-…` live; `/api/auth/providers` lists both google + resend. *Functional click-through verification pending user adding redirect URI to Google Cloud Console.*
- [x] **Phase 4a security audit** — full audit at `harbour-apps/docs/security/launch-audit-2026-04-26.md`. 7 must-fix, 22 should-fix initially.
- [x] **Phase 4b Vercel-side** — vault headers, frame-ancestors on creaseworks/site/ops/port. Closed 7 should-fix items.
- [x] **Phase 4b harbour + depth-chart wrapper** — `@windedvertigo/security` package (`packages/security/`) ships `wrapWithSecurityHeaders` + `HARBOUR_DEFAULT_CSP`. harbour and depth-chart Workers wrapped, all 6 headers emitting. Closed 4 must-fix items + many should-fix.
- [x] **Phase 5a smoke script** — `harbour-apps/scripts/launch-smoke.mjs` covers 40 production targets with 3-retry backoff. 40/40 green at last run.
- [x] **Phase 5b smoke Worker deployed** — `wv-launch-smoke` Worker live, cron `*/30 * * * *`, KV `b67fcfef…`. Reads + writes to `latest` key; emits Slack digest on red when `WV_CLAW_WEBHOOK` secret is set. *Webhook URL pending user.*
- [x] **A2 prep — 16 CF Worker apps configured with security wrapper** — bias-lens, code-weave, deep-deck, emerge-box, liminal-pass, market-mind, mirror-log, orbit-lab, paper-trail, pattern-weave, proof-garden, raft-house, rhythm-lab, scale-shift, tidal-pool, time-prism. Each has `worker.ts`, updated `wrangler.jsonc` main field, tsconfig exclude, package.json dep. Deploy via `harbour-apps/scripts/deploy-cf-wrappers.sh`. Commit `042392e`.
- [x] **B1 — vault static CSP removed from vercel.json** — vault's `proxy.ts` (commit `79db6c3`) had a working nonce-based CSP that was being overridden at the edge by `vercel.json`'s static CSP. Removed the static entry; nonce-CSP becomes sole emitter on next vault deploy. Commit `dcbe3ab`.
- [x] **B4 — CSP nonce investigation doc** — `harbour-apps/docs/security/csp-nonce-investigation.md`. Recommendation: keep `'unsafe-inline'` on CF Workers fleet for launch; validate nonce pattern on vault first, then propagate post-launch.
- [x] **C2 partial — DNS audit** — SPF doesn't include `_spf.resend.com` (Resend emails fail SPF alignment), DMARC has no `rua=` reporting. Findings in `harbour-apps/docs/runbooks/launch-monitoring.md`.
- [x] **C4 — launch monitoring runbook** — `harbour-apps/docs/runbooks/launch-monitoring.md`. Triage trees, monitoring URLs, wrangler tail filters, smoke worker KV inspection, rollback procedures.
- [x] **Forward-roadmap plan written** — `~/.claude/plans/partitioned-painting-pascal.md` Phase A/B/C/D, sequencing, risks, done-when criteria. ONE 30-second user gate (A.1) for the entire pre-launch path.

### Pending (user actions to unblock)

- [ ] **A.1 (30 sec)**: add `https://www.windedvertigo.com/harbour/api/auth/callback/google` redirect URI to Google OAuth client `160968051904-ud88va6odnnjlp76j5dlc4qfd8upq2lp`.
- [ ] **A2 + A4 deploy**: run `cd harbour-apps && ./scripts/deploy-cf-wrappers.sh --include-depth-chart` (rolls out wrapper to 16 apps + redeploys depth-chart with new AUTH_URL).
- [ ] **A3**: create incoming webhook on wv-claw Slack app, then `echo "$URL" | wrangler secret put WV_CLAW_WEBHOOK --name wv-launch-smoke`.

## Completed 2026-04-25 — port infra consolidation session

- [x] **CF DNS zone consolidation** — windedvertigo.com zone activated 2026-04-25T01:43 UTC at garrett CF account (`097c92553b268f8360b74f625f6d980a`); migrated from anotheroption account.
- [x] **Port agent (wv-claw) deployed** — end-to-end tested in Slack DM. App `A0AUA3VQHFH` / bot `U0AUPLEA8RL` / audit DB `f2f48a9998d84cd69598efdc79a44f1e`.
- [x] **windedvertigo.com → Cloudflare Workers** — `wv-site` Worker live via OpenNext; Vercel `windedvertigo-site` project deleted.
- [x] **Harbour → Cloudflare Workers** — `wv-harbour-harbour` Worker live with R2 binding for tile images.
- [x] **Depth-chart on CF Workers** — fully wired with all secrets, direct CF routes (bypasses site router), end-to-end auth verified via shared `.windedvertigo.com` cookie.
- [x] **nordic.windedvertigo.com** — custom domain added on Vercel (project `nordic-sqr-rct`, kept on Vercel for Workflow DevKit + Vercel Blob).
- [x] **Vault image bucket public access restored** — after R2 account migration to garrett account.
- [x] **Vault read-time cover_url refactor** — computes from `cover_r2_key` at read time; future R2 migrations are env-var-only.
- [x] **Creaseworks R2 credentials repaired** — production now uses garrett-account keys.
- [x] **Harbour tile images centralized in R2** — admin sync endpoint at `/harbour/api/admin/sync-tiles`.

## Infrastructure / platform (queued — needs focused session)

Two related infrastructure projects surfaced during the R2 token-rotation incident on 2026-04-23. Both are medium-effort and should be tackled together in a single focused session, not piecemeal.

### Project: Cloudflare account consolidation

**Current state**: Assets split across two Cloudflare accounts.
- `garrett@windedvertigo.com` account: DNS zones, domain registrar ("Gearbox"/Cloudflare Registrar)
- `anotheroption@gmail.com` account (ID: `4f33ee381364bce6959bdea092f046bb`): R2 buckets (`crm-assets`, `creaseworks-evidence`), Workers, AI Gateway, etc.

**Target**: Everything under `garrett@windedvertigo.com`.

**Why it matters**: Split accounts mean two logins, two token sets, two billing surfaces, and ongoing confusion when rotating creds (like today's incident). Consolidation reduces cognitive load and blast radius.

**Plan outline** (needs refinement before execution):
1. Audit assets in both accounts — list every zone, bucket, worker, KV namespace, AI Gateway, etc.
2. Move DNS zones + domain registrations to `garrett@windedvertigo.com` via CF's transfer-between-your-accounts flow (low-risk — zones update propagate over minutes)
3. Recreate R2 buckets in target account (R2 buckets are not transferable; must rclone the data over)
4. Update Vercel env vars: `CF_ACCOUNT_ID`, `R2_*`, `R2_PUBLIC_URL`
5. Redeploy port + harbour; verify uploads + reads
6. Migrate Workers, KV, D1, AI Gateway bindings — recreate + redeploy
7. Delete old account's assets once verified
8. Rotate/deactivate old API tokens

**Effort**: 60–90 minutes once started; most time is the R2 object sync.

### Project: Rename "CRM" → "port" across infrastructure

**Current state**: Legacy "CRM" naming in places where code/config was renamed but infrastructure wasn't.
- R2 bucket name: `crm-assets` (should be `port-assets`)
- Vercel domain aliases: `wv-crm.vercel.app`, `crm.windedvertigo.com` (alongside `wv-port-*` + `port.windedvertigo.com`)
- Possibly Notion databases or other references

**Target**: Everything reads "port" (matches the in-app brand language).

**Plan outline**:
1. Audit every reference to "crm" / "CRM" across repos, Vercel project, Cloudflare, Notion
2. Bucket rename (recreate + sync, like the consolidation — R2 doesn't support direct rename)
3. Remove stale Vercel aliases (`wv-crm.vercel.app`, `crm.windedvertigo.com`) once nothing points at them
4. Update `R2_BUCKET_NAME` env var + `R2_PUBLIC_URL` if that's re-branded too
5. Redeploy; verify no broken links (especially user-shared URLs that embed the old domain)

**Effort**: 30–60 minutes if bundled with the consolidation work (same bucket-sync action).

### Recommendation

Bundle both into a single session titled "port infra consolidation" — the R2 bucket work only happens once (move to new account AND rename). Do it on a low-traffic evening with port users warned that uploads will be briefly unavailable during the sync cutover.

## Whirlpool actions — 2026-04-22 (w.v x press play)
- [ ] **garrett + team** — review and refine the w.v x press play proposal document as shared alignment tool for both teams
- [ ] **payton** — develop marketing materials hitting pain points ("have you ever felt disconnected at a conference?"), with digestible content + links to deeper pieces
- [ ] **garrett + press play** — explore co-branded social media posts combining Press Play event footage with Winded Vertigo research backing
- [ ] **both teams** — secure video documentation and testimonials at future events in real-time (not after the fact)
- [ ] **garrett** — explore design solutions for gathering engagement metrics at events (e.g., RFID badge tracking for play zone dwell time)
- [ ] **casper (press play)** — pursue Hotel Legoland + Danish conference hotel union organizer connections
- [ ] **garrett** — follow up with Paul Ramchandani on Pedal conference proposal (sent over holiday, no response yet)
- [ ] **press play** — add assets and documentation to the shared Google Drive folder
- [ ] **garrett + payton** — build co-branded landing page for w.v x press play conference injection offering; point campaigns to it
- [ ] **payton** — start drafting first campaign; prepare draft campaign + co-branded website for review at next w.v x press play whirlpool (May 11)

## Whirlpool actions — 2026-04-20 (writer's room)
- [ ] **Jamie** — split the "unfolding" document into 5 digestible Substack posts by end of day Tuesday (Apr 21)
- [ ] **Team** — review Jamie's unfolding document and flag particularly resonant sections
- [ ] **garrett** — discuss with Maria about designing interactive experiences and video content for Substack
- [ ] **Payton** — coordinate posting Jamie's content on Substack, LinkedIn, and website
- [ ] **Team** — plan structure for monthly public play dates (30–60 minutes: 20 min playing, 20 min reflecting, 20 min connecting to theory)
- [ ] **garrett** — use Claude to generate a 500-word summary of the transformative theory of change

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

### Urgent — deploy to CF Workers
- [ ] **Redeploy site to Cloudflare Workers** — `ppcs-launch` countdown tool + `next.config.ts` redirect rule committed and pushed to GitHub (commit `350c772`) but site DNS points to CF Workers (`wv-site`), not Vercel. Need Wrangler/OpenNext deploy to get `windedvertigo.com/tools/ppcs-launch` live. **Needed before Monday 9am PT whirlpool.** File: `site/public/tools/ppcs-launch/index.html`. Redirect: `/tools/ppcs-launch` → `/tools/ppcs-launch/index.html`.

### Infrastructure follow-ups (post 2026-04-25 consolidation)
- [ ] **Notion content work — page covers** — Add page covers to playdates/packs/collections in Notion (creaseworks side, ~85 pages).
- [ ] **Phase 1 refactor for creaseworks** — Apply same read-time URL pattern as vault (compute from R2 key on read).
- [ ] **Phase 3: body-content image sync** — In vault and creaseworks, parse `body_html` and sync inline images to R2.
- [ ] **Revoke temp CF API token** — "Edit Cloudflare Workers" token, after stable.
- [ ] **Delete DNS API token** — `(cfut_H1x9...903e3, redacted — token literal in CF dashboard)`, after stable.
- [ ] **Close anotheroption CF account** — empty after migration.
- [x] ~~**Documentation sync**~~ (2026-04-25) — TASKS.md updated to reflect 2026-04-25 work.

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

### PRs pending Garrett merge (2026-05-01 — plan reconfigured)

> Full reconfigured plan: `~/.claude/plans/graceful-popping-willow.md`
> Monitor running: task `bo2te4fe8` watches #20/#21/#22 (wv-port) + #25 (monorepo) for merge

**wv-port (`ghandoff/wv-port`) — merge in order:**
- PR #20 `feat/rfp-proposals-supabase-atomic-v2` — Phase G.1 complete: all list-GET routes → Supabase + atomic proposal claim ✅ green
- PR #21 `feat/campaign-weekly-analytics` — weekly pulse summary card on /campaigns ✅ green
- PR #22 `feat/agent-write-tools-v2` — createCampaign + updateContact agent write tools ✅ green
- ~~PR #19~~ closed ✓ | ~~PR #17~~ closed ✓ | ~~PR #14~~ closed ✓

**Monorepo (`ghandoff/windedvertigo`) — merge in order:**
1. PR #25 `restructure/phase-a1-cleanup-and-ops-merge` — Phase E.2+E.3: `@windedvertigo/email-templates` + `@windedvertigo/notion-crm` ✅ green
2. PR #26 `feat/ops-marketing-module` — CMO marketing module (base: PR #25) ✅ green
3. PR #28 `feat/booking-package-e4-clean` — Phase E.4: `@windedvertigo/booking` (base: PR #25) ✅ green
4. PR #30 `feat/systems-thinking-portfolio` — systems-thinking simulator + teacher guides ✅ green
5. PR #16, #17, #13 — lines-become-loops fixes + ops Supabase wiring (any order) ✅ green
6. ~~PR #29~~ — **close** (superseded by direct main commit beefb4f)
7. ~~PR #9~~ — **close** (stale draft, security audit reversal)
- ~~PR #27~~ closed ✓ | ~~PR #14~~ closed ✓

### After PRs merge — autonomous (Claude Code)

- [ ] **Site CF Workers redeploy** — after PR #25 merges: `cd site && npx opennextjs-cloudflare build && wrangler deploy`
  (PPCS launch countdown tool + systems-thinking redirect need this deploy)
- [x] ~~**Phase A.2: port nested-clone resolution**~~ (2026-05-01) — `port/.git` dissolved; archive ref pushed to `wv-port-archive`; `gh repo archive ghandoff/wv-port` complete.
- [ ] **Vercel project cleanup** — delete ~22 dormant projects after Garrett confirms list (see plan file)
- [x] ~~**Phase G.2.1: port → CF Workers (OpenNext)**~~ (2026-05-01) — `wv-port.windedvertigo.workers.dev` live; middleware.ts naming fix; wrangler.jsonc with queue producer bindings + hourly cron.
- [x] ~~**Phase G.2.2: Inngest functions → CF Queue consumers (port-jobs)**~~ (2026-05-01) — `port-jobs/src/index.ts` implements proposalConsumer, proposalDlqConsumer, timesheetConsumer, rfpDocumentConsumer. `seedProcessEnv()` bridge pattern. Native R2 binding for rfp-document consumer.
- [x] ~~**Phase G.2.3: Inngest send() → CF Queues dual-dispatch (all 6 call sites)**~~ (2026-05-01) — All 6 inngest.send() replaced with `publishJob()` + `getCloudflareContext()` in port API routes. `port/lib/cf-env.ts` augments `CloudflareEnv` global. CF canary confirmed live with all 3 queue producer bindings. commit `14f5a71`.
- [ ] **Phase G.2.4: 7-day parity canary** — started 2026-05-01. Compare `wv-port.windedvertigo.workers.dev` vs Vercel prod. Ends ~2026-05-08. After: G.2.5 DNS cutover.
  - **`wv-port-jobs` deploy (Garrett action needed)**: Run `cd port-jobs && bash deploy.sh` to provision 7 secrets + deploy CF Queue consumer. Script is safe — secrets piped directly into wrangler, never printed to stdout. Queues have 1 message each from G.2.3 testing that will process immediately on deploy.
  - Bugs fixed pre-deploy: R2_PUBLIC_URL was pointing at `creaseworks-evidence` bucket instead of `port-assets` (commit `57267e8`). Now reads from `wrangler.jsonc [vars]` with correct domain `pub-ae6933715be744649a1f2fd99346225a.r2.dev`.
- [ ] **Phase B: harbour-apps subtree merge** — BLOCKED: 7 open PRs in harbour-apps (gate requires 0). Close stale PRs then re-run Phase 0 check.

### Vercel cleanup — pending Garrett confirmation

~22 dormant Vercel projects identified. Full list in `~/.claude/plans/graceful-popping-willow.md` under "Vercel project cleanup". Projects that are safe to delete are all now live on CF Workers. Key ones: `harbour`, `depth-chart`, `harbour-apps`, `wv-crm`, `port`, `systems-thinking`, and 16 individual harbour app projects.

**Confirm these are OK to delete, then Claude Code handles the rest.**

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
- [x] ~~**Ops dashboard: marketing module**~~ (2026-05-01) — content calendar, campaign metrics, pipeline widgets in `ops/app/marketing/page.tsx`. PR #26 pending merge.
- [x] ~~**CRM: content drafting workspace**~~ (2026-04-30) — `/content` route live; merged to wv-port main in `cf4056b`. Uses Notion contentCalendar DB (env-var driven).
- [x] ~~**CRM: campaign analytics enhancement**~~ (2026-05-01) — weekly pulse card on `/campaigns` (this week vs last week deltas). PR #21 pending merge.
- [ ] **Notion: create content calendar DB** — properties: title, channel, body, scheduled date, status, author ← **Cowork action**: create DB + set `NOTION_CONTENT_CALENDAR_DB_ID` in wv-port Vercel env
- [x] ~~**KV keys for marketing data**~~ (2026-05-01) — `marketing:campaign-metrics`, `marketing:pipeline-summary` in `ops/app/api/marketing/route.ts`. PR #26.
- [x] ~~**TypeScript types for MarketingSnapshot**~~ (2026-05-01) — `ContentItem`, `CampaignMetrics`, `PipelineSummary` in `ops/lib/types.ts`. PR #26.
- [x] ~~**Nav updates**~~ (2026-05-01) — ops: marketing tab in DashboardShell (PR #26). CRM: "content" nav item in `app/components/nav-config.ts` (merged in cf4056b).

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
