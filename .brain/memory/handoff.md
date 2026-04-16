# Handoff Notes — Cross-Environment Context

When Cowork or Claude Code finishes a significant session, drop a note here so the other environment picks up with full context. Most recent first.

> **cross-device convention:** this file is the source of truth when resuming work. say "pick up [project]" or "where did we leave off?" at the start of any Cowork or Claude Code session to trigger a read. the `context-sync` scheduled task updates the **live state** block below daily at 9pm PT.

---

## 🟢 live state
<!-- updated by context-sync daily 9pm PT, and manually at end of significant sessions. only this block is auto-refreshed. everything below is append-only history. -->

**last synced:** mon 13 apr 2026, 9:10pm PT

**where we are right now:**
Port restructure shipped (commit d0eec54, deployed apr 14): sidebar 12→7, dashboard, merged pages (opportunities, projects, campaigns), audience filters 7→4 (fit, relationship, source, segment), derived priority, skeleton fallbacks, URL-synced tabs, staggered kanban animations. All old URLs preserved via 308 redirects. Follow-on tasks in progress: Notion schema migration (native relationship property), mobile tab bar, dead code cleanup, memory updates.

PRME 2026 is live and invoiced (PO #2069 approved, first invoice mar 27 — payment still outstanding); PRME bi-weekly hold sits on tomorrow's calendar at 12pm PT, a good window to raise payment + comms reset. IDB Salvador docs went in apr 10 via Maria — awaiting acknowledgement from MINEDUCYT. New today: Nordic Naturals (Sharon Matheny / Lauren Bosio) granted access to their CAIPB claims database on Smartsheet — a fresh engagement surface to scope. Today's whirlpool was play-only ("the world prowl"); apr 8 press play action items remain parked for wednesday apr 15.

### open threads

| project | last action | next action | link |
|---------|-------------|-------------|------|
| IDB Salvador | maria submitted docs apr 10 (deadline day) | confirm receipt from nadia.nochez@mined.gob.sv; align with maria tue 10am | [notion mail](https://mail.notion.so/inbox/a99b1601-0090-4e61-98bd-a074c0d6665f) |
| PRME 2026 | first invoice submitted mar 27; meredith sent comms reset note apr 7 | raise payment + comms alignment at tue 12pm PRME hold | [notion mail](https://mail.notion.so/inbox/19d69751a722cce5) |
| Amna at 10 | proposal submitted mar 26 | follow-up overdue (19 days) — email Jonelle and Walaa this week | [tasks](.brain/TASKS.md) |
| Sesame Workshop | received pass mar 31 | draft graceful close-out reply | [tasks](.brain/TASKS.md) |
| Siyavula MEL proposal | soft pass apr 13 — alexandra prefers SA-based orgs | decide: respond further or close out | [gmail](https://mail.google.com) |
| CPA / Q1 CFO review | abhishek emailed + secure chat apr 13; tax extension organizer reminder landed overnight | book Q1 CFO review via Straight Talk CPAs portal; complete 2025 tax extension organizer | gmail: abhi@straighttalkcpas.com |
| Nordic Naturals / CAIPB | sharon + lauren granted smartsheet access apr 13 (CAIPB Database, AI Details for Qualified RMs, MASTER DATA) | open workspaces, scope "insights" deliverable, confirm cadence with sharon | gmail: lbosio@nordicnaturals.com |
| Press Play collab | apr 8 whirlpool items unresolved; carry forward to wed apr 15 | schedule apr 22 session; set up google drive folder + slack channel | [tasks](.brain/TASKS.md) |

### waiting on external

- **PRME payment** — first invoice submitted to meredith / sam — since mar 27; PO #2069 approved
- **IDB submission receipt** — maria submitted apr 10 to MINEDUCYT; awaiting acknowledgement from nadia.nochez@mined.gob.sv
- **Amna at 10 response** — proposal sent to jonelle and walaa — since mar 26 (19 days, overdue for follow-up)
- **IDB collective project docs** — AET, ECO966, Solihull, NSIT references — requested from collective members
- **Siyavula MEL decision** — alexandra indicated preference for SA-based orgs; may not hear back — since apr 13

### environment handoffs

**Cowork → Claude Code:**
- world prowl app build at `harbour/app/prowl/` — prompt in notion: [340e4ee7](https://www.notion.so/340e4ee74ba4814f83fccb603daea70a)
- ops dashboard: wire quickbooks + gusto data via cowork dispatch → KV push
- CMO marketing module in ops dashboard — spec in `.brain/memory/marketing/claude-code-prompt.md`
- resend webhook URL still needs registering in resend dashboard (unblocks campaign tracking)

**Claude Code → Cowork:**
- ancestry app substantially built — review decisions needed (harbour integration? pricing? launch comms?)
- ancestry app: `wv-invoice-logged` gmail label application still manual (MCP limitation — 3 messages unlabeled)
- nordic naturals engagement surface: scope whether the CAIPB claims work becomes a formal w.v project and what it implies for pipeline / invoicing

### mobile bookmarks

- _no unresolved self-DMs today_ — recent slack activity from garrett is outbound (to maria on whirlpool builds, to sharon / gina on nordic naturals credentials); nothing parked for self-reference

---

## history (most recent first)

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
