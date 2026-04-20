# Handoff Notes — Cross-Environment Context

When Cowork or Claude Code finishes a significant session, drop a note here so the other environment picks up with full context. Most recent first.

> **cross-device convention:** this file is the source of truth when resuming work. say "pick up [project]" or "where did we leave off?" at the start of any Cowork or Claude Code session to trigger a read. the `context-sync` scheduled task updates the **live state** block below daily at 9pm PT.

---

## 🟢 live state
<!-- updated by context-sync daily 9pm PT, and manually at end of significant sessions. only this block is auto-refreshed. everything below is append-only history. -->

**last synced:** sat 18 apr 2026, 9pm PT (context-sync)

**where we are right now:**
quiet weekend — no git commits, no calendar events sunday. CPA tax situation remains the #1 urgent item: TaxDome reminder for missing docs + extension organiser still unactioned. PRME payment now 22 days outstanding — tue PRME hold with meredith is the escalation moment. cash last known $5,076.19 (apr 16). monday opens with weekly site check (7am), whirlpool (9am); tuesday is stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm). KiwiCo lead warm — forwarded to their international partnerships team, awaiting response. invoice processor dispatch still broken. ADP quarterly retirement statement now available.

### open threads

| project | last action | next action | link |
|---------|-------------|-------------|------|
| CPA / tax | 2 TaxDome reminders apr 18 (missing docs + extension organiser) | **urgent** — complete tax extension organiser + missing docs via TaxDome portal before penalties | gmail: notifications@taxdome.com |
| Nordic Naturals | lauren meeting done apr 16; PCS gap analysis complete; follow-up **wed apr 22 3pm** | close 4 critical schema gaps; review PCS template lauren sent by email | [gap analysis](https://www.notion.so/345e4ee74ba4819c8bbbc616067723c2) |
| PRME 2026 | first invoice submitted mar 27; PO #2069 approved | **raise payment tue PRME hold** — 22 days outstanding | [notion mail](https://mail.notion.so/inbox/19d69751a722cce5) |
| IDB Salvador | maria sync done apr 16; deadline was apr 10 | confirm status with maria at tue sync (10am PT) — 8 days past deadline | [notion mail](https://mail.notion.so/inbox/a99b1601-0090-4e61-98bd-a074c0d6665f) |
| KiwiCo | reply received apr 17 — forwarded to international partnerships team | monitor for follow-up; draft partnership brief if they respond | gmail: schoolsgroups@kiwico.com |
| harbour launch | depth pivot confirmed; writing retreat **mon apr 21** | pilot 2–4 games per category; whisper campaign — may 1 deadline | [tasks](.brain/TASKS.md) |
| Press Play collab | apr 8 items carried forward | schedule apr 22 session; set up google drive folder + slack channel | [tasks](.brain/TASKS.md) |
| Amna at 10 | proposal submitted mar 26 | follow-up overdue (23 days) — email jonelle and walaa **this week** | [tasks](.brain/TASKS.md) |

### waiting on external

- **PRME payment** — first invoice submitted to meredith / sam — since mar 27 (22 days); PO #2069 approved. tue PRME hold is the escalation point.
- **IDB submission receipt** — maria submitted apr 10 to MINEDUCYT; awaiting acknowledgement from nadia.nochez@mined.gob.sv — 8 days past deadline
- **Amna at 10 response** — proposal sent to jonelle and walaa — since mar 26 (23 days, overdue for follow-up)
- **KiwiCo international team** — inquiry forwarded apr 17; awaiting response from their partnerships division
- **IDB collective project docs** — AET, ECO966, Solihull, NSIT references — requested from collective members

### environment handoffs

**Cowork → Claude Code:**
- nordic naturals: close 4 critical PCS schema gaps identified in gap analysis — claim prefix separation, standardised ingredient nomenclature, benefit categories, demographics
- ops dashboard: wire quickbooks + gusto data via cowork dispatch → KV push
- CMO marketing module in ops dashboard — spec in `.brain/memory/marketing/claude-code-prompt.md`
- resend webhook URL still needs registering in resend dashboard (unblocks campaign tracking)
- prepare full-stack + tooling notion brief for maria (upstash discussion)

**Claude Code → Cowork:**
- ancestry app substantially built — review decisions needed (harbour integration? pricing? launch comms?)
- `wv-invoice-logged` gmail label application still manual (MCP limitation — 3 messages unlabeled)
- triage isabel rodríguez tejedo inbound (certificate of excellence inquiry via payton)
- CPA portal: complete tax extension organiser + missing docs (2 fresh reminders apr 18)
- invoice processor dispatch broken — gmail MCP stale + notion invoice tracker DB missing; reload session to fix
- attio CRM trial ending — decide: keep or cancel
- ADP quarterly retirement plan statement now available — review

### mobile bookmarks

- _source unavailable_ — slack MCP tools not available in this session; self-DMs from last 24h could not be checked

---

## history (most recent first)

---

## 2026-04-18 (night) — context-sync: second pass, state confirmed stable (Cowork)

**what happened:**
- second context-sync pass of the day — no material changes since 9pm run. no git commits, no new actionable emails beyond earlier TaxDome + KiwiCo.
- sunday calendar is empty. monday: weekly site check (7am), whirlpool (9am). tuesday stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm).
- notion: only World Bank procurement alerts in last 24h — no project status changes.
- gmail: TaxDome missing docs reminder (still unactioned), KiwiCo satisfaction survey (noise), ADP quarterly statement available.
- slack DM to garrett could not be sent — slack MCP tools not available in this session (recurring limitation).
- handoff live state refreshed and confirmed accurate.

---

## 2026-04-18 (evening) — context-sync: CPA reminders escalating, KiwiCo lead, quiet weekend (Cowork)

**what happened:**
- quiet weekend day — no git commits in last 48h.
- CPA tax situation escalating: two fresh TaxDome reminders landed (missing documents for tax return + 2025 individual tax extension organiser). this is now the #1 urgent item.
- KiwiCo replied to winded.vertigo partnership outreach (apr 17) — forwarded inquiry to their international partnerships team. genuine new lead to monitor.
- ADP quarterly retirement plan statement now available online.
- Torrance Festival of Ideas: CREATIVITY & AI — whova profile validation email received (apr 17).
- PRME payment now 22 days outstanding (was 20). tue PRME hold meeting with meredith is the escalation moment.
- Amna at 10 follow-up now 23 days overdue.
- IDB Salvador now 8 days past deadline.
- monday calendar: weekly site check (7am), whirlpool (9am). tuesday stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm).
- slack DM to garrett could not be sent — slack MCP tools not available in this session.

---

## 2026-04-16 (evening) — context-sync: nordic meeting done, PCS gap analysis shipped, invoice processor broken (Cowork)

**what happened:**
- nordic naturals meeting with lauren bosio completed (3:15pm). PCS gap analysis finished — 4 critical gaps, 4 important gaps, 4-phase roadmap. follow-up booked **wed apr 22 3pm**. lauren sent PCS template by email. project moved from "scoping" to active delivery.
- 11 git commits: website feedback improvements (phases 1–4), playdate intake form replacing external booking, systems-thinking simulator overhaul (reactive canvas, dark theme, burnout map), security fixes (4 npm vulns), monorepo dependency alignment.
- invoice processor dispatch broken — gmail MCP stale definitions + notion invoice tracker DB not found in search. needs cowork session reload.
- garrett discussed full-stack tooling access with maria (upstash, MCP integrations, notion brief for tech stack understanding).
- michael renvillard replied to website feedback email — gracious close, offered further help.
- cash: $5,076.19 ($3,500 owner contribution offset by -$496 operating MTD).

---

## 2026-04-15 (evening) — context-sync: whirlpool pivot, nordic call tomorrow, CPA urgent (Cowork)

**what happened:**
- whirlpool session produced harbour strategy pivot: depth over breadth (pilot 2–4 games per category), play therapists as beachhead audience. writing retreat booked mon apr 21.
- lauren bosio (nordic naturals) confirmed working call for thu apr 16 at 3pm PT — first real session since SOW approval.
- CPA: 3 unread emails from straight talk CPAs — tax extension organizer reminder, missing docs request, vivek ghelani secure chat. needs immediate attention.
- CMO weekly review flagged 21-day social silence; harbour phase 1 whisper campaign behind schedule for may 1 launch.
- git: 3 commits on systems-thinking simulator (lakeshore sync, dosage sliders, stacked trade-off charts).
- stripe unrecognised device sign-in alert — needs verification.
- invoice sweep: all quiet, nothing new logged.

---

## 2026-04-15 — engagement tracking shipped + email-draft backfill (Claude Code)

**what happened:**
- **Engagement tracking deployed** (commit 2bbeddd, deployed to production apr 15):
  - Engagement profile on org pages — shows email activity (sends, opens, clicks), campaign history, and engagement score per organisation.
  - Recipient transparency — email drafts now track `sentTo` (email address) and `contactId` (when sent to a contact vs org-level email).
  - Resend webhook activity logging — incoming webhook events (delivered, opened, clicked, bounced, complained) are logged and update draft metrics in real time.
  - UTM attribution — outbound email links are tagged with utm_source/medium/campaign/content for click-through tracking.
  - Campaign recipients page — view all recipients for a campaign with per-recipient open/click stats.
- **Backfill script created** (`port/app/api/admin/backfill-email-drafts/route.ts`): one-shot GET endpoint to populate `sentTo` on existing email drafts from the first campaign (`33be4ee7-4ba4-81be-b832-d045290c5a30`). Fetches org email for each draft that has an `organizationId` but empty `sentTo`, writes it back with 350ms rate-limit delay.
- Memory: updated handoff live state, cleaned up port rename thread.

---

## 2026-04-14 (evening) — context-sync: nordic SOW approved, port rename shipped, PRME inbound (Cowork)

**what happened:**
- nordic naturals SOW approved (garrett told payton via slack DM). contract signing expected this week or next — moves from "scoping" to "closing" in pipeline.
- crm/ → port/ monorepo rename shipped (3 commits: bf7bea7 refactor rename, bd66fba vercel.json fix, 5102e9b .vercelignore fix).
- garrett rescheduled maria sync from tue to wed after 1:30pm her time.
- payton forwarded an inbound from isabel rodríguez tejedo (universidad de navarra) re: "certificate of excellence" — likely PPCS/PRME-adjacent, needs triage.
- siyavula MEL and sesame workshop threads appear dormant — removed from open threads (siyavula soft pass, sesame received pass).
- gmail: only 2 unread (payton's fwd + notion 3.4 newsletter). no urgent external replies.
- no unresolved self-DMs in slack.

---

## 2026-04-14 — port restructure shipped + follow-on tasks (Claude Code)

**what happened:**
- **Port restructure complete** (commit d0eec54, deployed to production): sidebar 12→7, dashboard with pipeline kanban, merged pages (opportunities, projects, campaigns), audience filters simplified 7→4 (fit, relationship, source, segment), derived priority system (fit × relationship matrix), skeleton fallbacks, URL-synced tabs, staggered kanban animations. All old URLs preserved via 308 redirects.
- **Follow-on tasks shipped same session:**
  - Notion schema: added native "relationship" select property to organizations database (7 stages: stranger→champion), backfill script created, mapper updated to prefer native value with derivation fallback
  - Mobile tab bar: updated 5 tabs (pipeline, contacts, log, today, work), redirect → /m/pipeline
  - Dead code cleanup: deleted status-badge.tsx, org-edit-dialog.tsx; removed PriorityBadge from priority-badge.tsx (FitBadge kept)
  - Memory: fixed crm→port references in operational.md, added project row
- **Key architecture decision:** relationship is now a first-class Notion property. On create/update, the app computes relationship from connection/outreach/friendship and writes it. On read, it prefers the native value but falls back to derivation for any un-backfilled rows.

---

## 2026-04-13 (evening) — context-sync: nordic naturals engagement surface appeared (Cowork)

**what happened:**
- sharon matheny (nordic naturals) had lauren bosio grant garrett viewer access to three smartsheet workspaces: CAIPB Database, AI Details for Qualified RMs, CAIPB Database — MASTER DATA. framed as "insights" request — scope + cadence not yet defined.
- garrett shared SQR-RCT x PCS platform credentials with sharon + gina via slack group DM (nordic naturals workspace).
- tax extension organizer reminder from straight talk CPAs landed overnight — needs completion alongside the Q1 CFO review booking.
- whirlpool "the world prowl" was play-only; no business agenda; apr 8 press play actions remain the live list for wed apr 15.
- git: only housekeeping commits on windedvertigo repo (submodule / gitignore tidy).
- tomorrow's hot window: PRME bi-weekly at 12pm PT — natural moment to raise invoice payment and meredith's comms reset note from apr 7.

---

## 2026-04-13 — context-sync: first live-state refresh (Cowork)

**what happened:**
- first context-sync run — live state block fully populated from Gmail, Slack, git, Notion, and TASKS.md
- IDB Salvador: Maria submitted documentation on apr 10 (deadline met) — receipt confirmation still needed from MINEDUCYT
- Siyavula MEL proposal received a soft pass (prefers SA-based orgs) — Garrett replied
- ancestry app: significant Claude Code build activity this week (photo gallery, GEDCOM 7.0 export, AI research assistant, DNA/ethnicity, census timeline, collaborative comments, mobile redesign, merge wizard)
- PRME survey showing 94 responses; Meredith sent comms reset note apr 7
- CPA Q1 CFO review request from Abhishek — needs booking

---

## 2026-03-29 — ops dashboard redesigned, KV + Notion wired, auto-deploy enabled (Claude Code)

**What happened:**
- **Dashboard redesign:** Complete UX overhaul — financial strip at top with hero cash number, computed runway bar, auto-derived alerts (low runway, deadline countdown, blocked projects). Two-column layout: actions + projects (left), schedule + dispatch (right). Interactive task checkboxes with localStorage persistence. Collapsible sections. Expandable project rows.
- **Cloudflare KV integration:** All 6 API routes now try KV first (`ops:finance`, `ops:projects`, etc.), fall back to static data. KV read/write utilities in `ops/lib/kv.ts`.
- **KV write endpoint:** `POST /api/kv` accepts `{ key, data }` with bearer token auth (`KV_WRITE_TOKEN`). This is how Cowork dispatch tasks push data.
- **Notion integration:** `ops/lib/notion/projects.ts` fetches projects from the shared Notion projects DB. Falls back to static data if Notion unavailable. `page.tsx` calls `fetchProjects()` server-side.
- **GitHub auto-deploy:** wv-ops Vercel project connected to `ghandoff/windedvertigo` monorepo with `rootDirectory: ops` and `sourceFilesOutsideRootDirectory: true`. Pushes to main auto-deploy.

**Env vars needed on Vercel (not yet set):**
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with KV read access
- `KV_WRITE_TOKEN` — arbitrary secret for the POST /api/kv endpoint
- `NOTION_TOKEN` — Notion integration token (same one CRM uses)

**How Cowork dispatch should push data:**
```bash
curl -X POST https://ops.windedvertigo.com/api/kv \
  -H "Authorization: Bearer $KV_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"ops:finance","data":[...]}'
```
Keys: `ops:finance`, `ops:projects`, `ops:team`, `ops:calendar`, `ops:tasks`, `ops:dispatch`

**What needs doing next:**
- [ ] Set env vars on Vercel (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_WRITE_TOKEN, NOTION_TOKEN)
- [ ] Build Cowork dispatch task to push dashboard snapshots to KV after weekly-cfo-review
- [ ] Resolve Notion project lead person IDs → names (owner field currently undefined for Notion-sourced projects)

---

## 2026-03-28 — ops auth fixed, hardened, design system integrated (Claude Code)

**What happened:**
- **Auth fix (critical):** Root cause — `page.tsx` was a `'use client'` static component. Next.js prerendered it at build time (`○`). On Vercel, static pages bypass middleware entirely (served from CDN). The middleware was correct but never ran. Fixed by converting to server component calling `auth()` → forces dynamic rendering (`ƒ`) → middleware now executes.
- Added sign-out button + user email display in header
- Made header date dynamic (was hardcoded "mar 28")
- Imported `@windedvertigo/tokens/index.css` — shared brand palette, semantic colors, spacing, typography, accessibility primitives
- Replaced all hardcoded hex colors with ops-specific CSS custom properties via `@theme inline`
- Removed unnecessary `'use client'` from 7 presentational components (now server components, smaller JS bundle)
- Simplified `tailwind.config.ts` — moved colors to CSS-native `@theme` block (Tailwind v4 pattern)
- Created 6 API routes: `/api/finance`, `/api/projects`, `/api/team`, `/api/calendar`, `/api/tasks`, `/api/dispatch`
- Extracted TypeScript interfaces to `lib/types.ts` (shared by components + API routes)

**What's deployed:**
- Auth-protected dashboard at ops.windedvertigo.com — redirects to /login if no session
- Google SSO with @windedvertigo.com domain restriction + ALLOWED_EMAILS allowlist
- Sign-out button + user email in header
- Dynamic date in header
- 6 API endpoints returning static data (ready for live data integration)
- Shared design tokens from `@windedvertigo/tokens`

**Middleware deprecation note:**
Next.js 16 warns `middleware.ts` is deprecated in favor of `proxy.ts`. The middleware still works for dynamic routes. CRM uses the same pattern. Not migrating yet — `proxy` convention is too new and the CRM would need to migrate simultaneously.

**Data layer architecture recommendation:**

The ops dashboard needs live data from QuickBooks, Gusto, Notion, and Google Calendar. The ops Next.js app should NOT hold OAuth tokens for these services — that's Cowork's job via MCPs.

**Recommended: Cowork dispatch → Cloudflare KV → Ops reads**

1. Cowork dispatch tasks (weekly-cfo-review, invoice-processor, etc.) already run on schedule with MCP access to QuickBooks, Gusto, Notion, GCal.
2. After each run, dispatch pushes a pre-computed "dashboard snapshot" JSON blob to Cloudflare KV (one key per data domain: `ops:finance`, `ops:projects`, `ops:team`, etc.).
3. Ops API routes read from KV at request time (sub-10ms). If KV key is empty/missing, return the static fallback from `lib/data.ts`.
4. Optional: a manual "refresh" button in the dashboard triggers an on-demand KV update via a dispatch task.

**Why this approach:**
- Cowork already has the MCPs and runs on schedule — no new auth tokens needed
- KV reads are fast and cheap — dashboard stays snappy
- Data freshness matches business cadence (daily invoices, weekly CFO review)
- Ops never needs direct access to QuickBooks/Gusto APIs
- Static fallback means the dashboard always renders even if KV is empty

**What needs doing next:**
- [x] ~~Verify OAuth flow~~ — confirmed working in incognito (2026-03-28)
- [x] ~~Set up Cloudflare KV namespace~~ — `wv-ops-data` created (id: d740788337354d738e1be321d2c4b277)
- [ ] Build Cowork dispatch task to push dashboard snapshot to KV after weekly-cfo-review
- [ ] Update API routes to read from KV with static fallback
- [ ] Connect wv-ops Vercel project to GitHub for auto-deploy on push
- [ ] **Cash position alert**: $2,072 cash with ~$4,275/mo burn. PRME invoice outstanding — revenue needs to land.

**Brand alignment (2026-03-28):**
- Login: cadet bg, champagne text, branded SSO button
- Header: shared .wv-header chrome from tokens
- Footer: shared .wv-footer chrome
- Surface colors: cadet-derived darks (not generic grays)
- Section dividers: redwood gradient accent
- Financial data: live from QuickBooks + Gusto

---

## 2026-03-28 — ops dashboard deployed (Cowork → Claude Code)

**What happened:**
- Built ops command center as new monorepo workspace (`ops/`)
- Configured Vercel project `wv-ops` with custom domain `ops.windedvertigo.com`
- Set up Auth.js v5 Google OAuth (shared with CRM)
- Cloudflare DNS CNAME added for ops subdomain
- Three deploys to fix build issues:
  1. First deploy failed: PostCSS config used Tailwind v3 syntax (`tailwindcss` as plugin)
  2. Second deploy failed: `globals.css` used `@tailwind` directives + `@apply` — Tailwind v4 needs `@import "tailwindcss"` and chokes on `@apply` with certain utility classes
  3. Third deploy succeeded after converting to plain CSS values

**What's deployed:**
- Login page with Google SSO button at ops.windedvertigo.com
- Dashboard shell with placeholder "awaiting data" cards
- Edge middleware checking session cookie for auth

**What needs doing next (Claude Code):**
- [ ] Verify Google OAuth flow works end-to-end (Garrett needs to test in browser)
- [ ] Address Next.js 16 middleware deprecation warning (`middleware.ts` → `proxy.ts`)
- [ ] Wire QuickBooks data into financial dashboard cards (API routes)
- [ ] Wire Gusto payroll data into team/payroll cards (API routes)
- [ ] Connect Vercel project to GitHub repo for auto-deploy on push
- [ ] Consider: should ops share Auth.js config with CRM via `packages/auth`?

**Key files:**
- `ops/lib/auth.ts` — Auth.js v5 config
- `ops/middleware.ts` — edge auth (deprecated convention, works for now)
- `ops/app/globals.css` — Tailwind v4 with `@import "tailwindcss"`
- `ops/postcss.config.mjs` — uses `@tailwindcss/postcss`
- `scripts/deploy-ops.sh` — Vercel deploy script

**Vercel env vars (set in dashboard, not in repo):**
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, AUTH_TRUST_HOST, AUTH_URL, ALLOWED_EMAILS

**Commits:**
- `5da6b98` — feat(ops): add ops command center as monorepo workspace
- `f4db54e` — fix(ops): use @tailwindcss/postcss for Tailwind v4
- `37d14a2` — fix(ops): use Tailwind v4 CSS import and remove @apply directives
