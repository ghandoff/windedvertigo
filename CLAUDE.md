# Memory

> Deep memory, tasks, and operational files live in `.brain/`
> Tasks: `.brain/TASKS.md` | Memory: `.brain/memory/` | Archive: `.brain/archive/`

> **What's new (2026-05-12, second pass):** Re-activated the three site routes that briefly broke in the morning cleanup. **CUTS Catalog** (`/harbour/cuts-catalogue`) now serves as a static HTML page directly from `wv-site` (file at `site/public/harbour/cuts-catalogue/index.html`) — needed for Thursday demo. **Rubric Co-Builder** staged for CF Worker `wv-harbour-rubric-co-builder` (full OpenNext config, deploy script, secrets list); user runs `./scripts/deploy-rubric-co-builder.sh` from laptop to bring it live. **Values-auction** and **vertigo-vault** already on CF (no changes). Added `docs/pocket-prompts-cf-migration.md` + `scripts/pocket-prompts-migrate.sh` — turnkey playbook for the separate `ghandoff/pocket-prompts` repo. Morning pass: full Vercel decommission — all `vercel.json` files, stale deploy scripts, `@vercel/*` runtime deps, and `VERCEL_URL` fallbacks removed; wv-claw Slack agent moved into `wv-port` Worker at `/api/agent/slack/events`. Only remaining Vercel project: `pocket-prompts`. Once that lands on CF, Vercel team can be deleted.

## Me
Garrett Jaeger, Founder & Legal Representative of winded.vertigo LLC — a learning design collective. Based in San Francisco, CA (Pacific time). Email: garrett@windedvertigo.com

## People
| Who | Role |
|-----|------|
| **Payton** | Payton Jaeger, w.v collective — comms, website circulation, outreach |
| **Lamis** | Lamis Sabra, w.v collective — weekly sync Tuesdays 4pm UTC |
| **Maria** | Maria Altamirano Gonzalez, w.v collective — operations, IDB Salvador lead. Weekly Tuesdays 6pm UTC |
| **Apoorva** | Apoorva Shivaram — formerly w.v collective (inactive) |
| **Kristin** | Kristin Lansing — formerly w.v collective (inactive) |
| **James** | James Galpin, w.v collective |
| **Randall** | External — weekly call Tuesdays 5pm UTC |
| **Gina** | Gina Jaeger — family |
| **Meredith** | Meredith Storey, UN Global Compact / PRME — key client contact |
| **Sam** | Sam at PRME — works with Meredith on contracts |
→ Full list: .brain/memory/glossary.md, profiles: .brain/memory/people/

## Terms
| Term | Meaning |
|------|---------|
| **w.v** | winded.vertigo |
| **whirlpool** | Monthly community learning event (public-facing) |
| **fruitstand** | Internal team meeting |
| **campfire** | Studio discussion format |
| **PRME** | Principles for Responsible Management Education (UN Global Compact program) |
| **PPCS** | PRME Pedagogy Certificate System — evidence infrastructure + AR program |
| **creaseworks** | w.v product — creativity platform |
| **GoTCHA!** | w.v product/project |
| **eddyy** | w.v product/project |
| **perp labs** | w.v studio initiative — perpetual labs |
| **toy lab** | w.v studio initiative |
| **play, fair** | w.v studio initiative — play and fairness research |
| **IDB** | Inter-American Development Bank — El Salvador ed-tech procurement |
| **MINEDUCYT** | El Salvador Ministry of Education, Science and Technology |
| **the collective** | The Winded Vertigo Collective — the full team |
| **Press Play** | Partner or program — joint whirlpool sessions |
| **stack audit** | Annual review of tools, DNS, hosting, subscriptions (first Monday of Jan) |
→ Full glossary: .brain/memory/glossary.md

## Active Projects
| Name | What | Status |
|------|------|--------|
| **IDB Salvador** | Ed-tech modernization procurement SDP 01/2026. Deadline: **April 10, 2026** | Active — docs requested |
| **PRME 2026** | Contract with UN Global Compact. Signed. PO approved Mar 27. First invoice submitted. | Active — invoicing |
| **Amna at 10** | Evidence synthesis & impact report proposal submitted Mar 26 | Proposal submitted |
| **LEGO / Superskills!** | Cross-cutting skills certification with Learning Economy Foundation | Active |
| **Sesame Workshop** | Learning design engagement | Active |
| **UNICEF** | Learning design engagement | Active |
| **Website launch** | windedvertigo.com circulated to trusted contacts for feedback Mar 27 | Active — soft launch |
| **401k / CPA** | Plan #156733 with ADP. Final 5500 + year-end testing needed | Active — admin |
→ Details: .brain/memory/projects/

## Recurring Meetings
| Meeting | When | Who |
|---------|------|-----|
| whirlpool | Mon & Wed 4pm UTC (9am PT) | Lamis, Payton, Maria, + (Mon "x Press Play" includes Jan, Casper) |
| weekly = lamis x garrett | Tue 4pm UTC | Lamis |
| Randall | Tue 5pm UTC | Randall, Gina |
| garrett x maria (part i) | Tue 6pm UTC | Maria |
| PRME hold | Tue 7pm UTC | Meredith, Sam, + |
| R&D meeting | Fri 6pm UTC | Gina, + |
| bi-weekly strategy playdates | Every 2 weeks | Team |

## Scheduled Tasks (AI Automation)
| Task | Schedule | What |
|------|----------|------|
| **weekly-cfo-review** | Mon 9:05am | Cash position, revenue pipeline, CPA liaison, action items |
| **invoice-processor** | Daily 9am | Scans Gmail for invoices, logs to Notion, labels in Gmail |
| **weekly-cmo-review** | Wed 9am | Content calendar, social media, campaigns, outreach pipeline, brand review |
| **whirlpool-agenda-generator** | Sun & Tue 8pm PT | Auto-generates whirlpool agenda from last meeting's action items, project updates, Slack threads, and calendar context. Creates Notion entry + Slack DM for Garrett to review. Hub: notion.so/33ae4ee74ba481b1a391fed914baa05b |

## Tool Stack
| Tool | What we use it for |
|------|-------------------|
| **Notion** | Central knowledge base, project management, invoice tracker, wiki |
| **Slack** | Team communication, async coordination |
| **Gmail** | External comms, client correspondence, invoice capture |
| **Google Calendar** | Scheduling, meeting cadence, time blocking |
| **Google Drive** | Document storage, shared folders, proposals |
| **Cloudflare** | Primary hosting for ALL production apps (Workers via OpenNext: site, harbour, depth-chart, port, ops, nordic, creaseworks, vault, ancestry), DNS, R2 storage, edge |
| **Vercel** | Decommissioning. Only `pocket-prompts` remains; account to be deleted once that migrates to CF |
| **Cowork (Claude)** | CFO/COO operations, memory system, scheduled tasks, file management |
| **Otter AI** | Meeting transcription (archived in Notion) |
| **ADP** | 401k plan administration |

## AI Roles (Second Brain C-Suite)
- **CFO**: Financial reporting, cash flow, invoicing, CPA coordination, revenue pipeline, budget monitoring
- **COO**: Task management, meeting prep, project health, team coordination, process automation
- **CMO**: Brand voice enforcement, content calendar, social media strategy, campaign planning, outreach pipeline, event promotion, competitive positioning → `.brain/memory/marketing/`
- Scheduled tasks = "dispatch" — autonomous operations that run without prompting

## Dual-Environment Architecture

The second brain operates across two Claude environments with a shared memory layer.

### Cowork (Desktop App) — Operations Layer
**Role:** CFO/COO copilot. Runs the business.
- Financial reviews via QuickBooks + Gusto MCPs
- Email triage, drafts, invoice processing (Gmail MCP)
- Meeting prep + calendar management (GCal MCP)
- Team coordination (Slack + Notion MCPs)
- Document creation (proposals, reports, decks, PDFs)
- Scheduled dispatch tasks (invoice-processor, weekly-cfo-review)
- Cross-tool search and synthesis (enterprise search)
- Project tracking, task management, memory updates
- Google Drive document retrieval

### Claude Code (Terminal) — Engineering Bench
**Role:** Builder. Ships code.
- Monorepo code changes: `harbour/`, `crm/`, `ops/`, `packages/`
- Build fixes, dependency management, config files
- Git operations (commit, push, branch, PR)
- Deployment via Wrangler/OpenNext for all apps (site, harbour, depth-chart, port, ops, nordic, vault, creaseworks, ancestry on CF Workers)
- New features for ops dashboard, CRM, website
- Infrastructure (Cloudflare workers, D1, KV if needed)
- Debugging build/runtime errors
- Any task that needs `git push` or `npm run`

### Shared Foundation
Both environments read the same repo, same `CLAUDE.md`, same `.brain/`.
- Memory updates happen in whichever environment finishes a significant session
- When Cowork identifies engineering work → log it in `TASKS.md` under `## Engineering (Claude Code)`
- When Claude Code finishes building → update `TASKS.md` and note what's deployed
- Handoff notes go in `.brain/memory/handoff.md` for cross-environment context

## Deploys

All apps deploy via wrangler. Two entry points:

1. **From your laptop**: `bash scripts/ship.sh` (site only), `--rubric` (also rubric worker), `--va-pages` (also values-auction SPA), or `--all`. Auto-stashes WIP, syncs branch, deploys, restores stash. See `scripts/ship.sh --help`.
2. **From GitHub Actions** (manual trigger): <https://github.com/ghandoff/windedvertigo/actions/workflows/deploy.yml> → Run workflow → pick target. Same scripts under the hood. Needs CF API token + account ID as repo secrets (see `docs/cf-token-setup.md`). Workflow file: `.github/workflows/deploy.yml`. workflow_dispatch only — never auto-deploys on push.

**Smoke audit after any deploy**: `bash scripts/smoke-test.sh` — hits all production harbour-app URLs and reports pass/fail in plain English.

## Monorepo Structure
```
windedvertigo/
  harbour/          — main website (windedvertigo.com)
  crm/              — client relationship manager (port.windedvertigo.com)
  ops/              — command center dashboard (ops.windedvertigo.com)
  packages/         — shared packages
  scripts/          — wrangler/OpenNext deploy scripts (deploy-site.sh, deploy-ops.sh, deploy-nordic.sh, deploy-ancestry.sh, deploy-vault.sh, deploy-creaseworks.sh, deploy-read-the-room.sh)
```

**Tech stack:** Next.js 16 + Turbopack, Tailwind v4, Auth.js v5 (Google OAuth), npm workspaces (no turborepo), Cloudflare Workers (OpenNext) hosting + DNS + R2.

## Infrastructure State
| Service | Domain | Host | Project / Worker | Status |
|---------|--------|------|------------------|--------|
| Site | windedvertigo.com | CF Workers (OpenNext) | `wv-site` | Live (migrated from Vercel 2026-04-25) |
| Harbour | (apps under windedvertigo.com) | CF Workers (OpenNext) | `wv-harbour-harbour` (R2 binding for tile images, Auth.js host in Pool A SSO) | Live — magic-link signin live; security headers via @windedvertigo/security wrapper |
| Depth-chart | windedvertigo.com/harbour/depth-chart/* | CF Workers (OpenNext) | `wv-harbour-depth-chart` (own CF routes, bypasses site router) | Live — Pool A SSO; security headers via wrapper |
| wv-launch-smoke | wv-launch-smoke.windedvertigo.workers.dev | CF Workers | `wv-launch-smoke` (cron `*/30 * * * *`, KV `SMOKE_LATEST`) | Live — 40-target probe, posts to wv-claw on red |
| Port (CRM) | port.windedvertigo.com | CF Workers (OpenNext) | `wv-port` (R3 bindings: PROPOSAL_QUEUE, TIMESHEET_QUEUE, RFP_DOCUMENT_QUEUE; R2 `port-assets`; AUTH_TRUST_HOST=true; hosts `wv-claw` Slack agent at `/api/agent/slack/events`) | Live — Vercel `wv-crm` deleted |
| Port agent (wv-claw) | Slack DM @wv-claw | CF Workers (inside `wv-port`) | Slack events handler at `port/app/api/agent/slack/events`. App `A0AUA3VQHFH` / bot `U0AUPLEA8RL` / audit DB `f2f48a9998d84cd69598efdc79a44f1e` | Live — migrated from Vercel into wv-port |
| Nordic | nordic.windedvertigo.com | CF Workers (OpenNext) | `wv-nordic` (6 cron triggers, R2 `nordic-pcs` binding, route `nordic.windedvertigo.com` custom_domain) | Live — Vercel project deleted 2026-05-12 |
| Ops | ops.windedvertigo.com | CF Workers (OpenNext) | `wv-ops` (KV `SMOKE_LATEST` binding, route `ops.windedvertigo.com` custom_domain repo-tracked 2026-05-12) | Live — Vercel project deleted 2026-05-12 |
| Vault | windedvertigo.com/harbour/vertigo-vault/* | CF Workers (OpenNext) | `wv-vault` (sub-path under harbour proxy, daily 06:00 cron, Pool A SSO) | Live — Vercel project deleted 2026-05-12 |
| Creaseworks | windedvertigo.com/harbour/creaseworks/* | CF Workers (OpenNext) | `wv-harbour-creaseworks` (sub-path under harbour proxy, 3 cron triggers, Pool A SSO) | Live — Vercel project deleted 2026-05-12. Old `creaseworks.windedvertigo.com` subdomain → 301 redirect to canonical path |
| Ancestry | ancestry.windedvertigo.com | CF Workers (OpenNext) | `wv-ancestry` (R2 `ancestry-media`, 2 cron triggers, route `ancestry.windedvertigo.com` custom_domain repo-tracked 2026-05-12) | Live — migrated from Vercel earlier 2026-05-12 |
| Rubric Co-Builder | windedvertigo.com/harbour/rubric-co-builder/* | CF Workers (OpenNext) | `wv-harbour-rubric-co-builder` (sub-path under harbour proxy, Anthropic + Neon; no Auth.js; no crons) | **Staged** 2026-05-12 — config committed, awaiting user deploy via `./scripts/deploy-rubric-co-builder.sh`. Secrets needed: `POSTGRES_URL`, `ANTHROPIC_API_KEY` |
| CUTS Catalog | windedvertigo.com/harbour/cuts-catalogue | wv-site static asset | Served from `site/public/harbour/cuts-catalogue/index.html` (no separate worker) | Live after next `./scripts/deploy-site.sh` — single static HTML, no build |
| Values Auction | windedvertigo.com/harbour/values-auction + /portfolio/assets/values-auction | CF Pages + Worker | `values-auction-hub` (Pages SPA) + `wv-values-auction-relay` (Durable Object session sync) | Live — already on CF since 2026-04-27 |
| pocket-prompts | (pending) | TBD `wv-pocket-prompts` Worker | Separate `ghandoff/pocket-prompts` repo. Migration playbook: `docs/pocket-prompts-cf-migration.md`; turnkey script: `scripts/pocket-prompts-migrate.sh` | Pending — last live Vercel project; user runs script from pocket-prompts repo |

**Canonical image bucket:** R2 `creaseworks-evidence` (in garrett CF account `097c92553b268f8360b74f625f6d980a`, migrated 2026-04-25 from anotheroption). Public URL: `https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev`. Used by site, harbour, vault, creaseworks.

## Preferences
- Continuous copilot mode — don't wait to be asked, surface relevant info proactively
- All domains integrated: work, personal, creative, health, financial/CPA
- Lowercase aesthetic in brand voice (winded.vertigo style)
- Financial clarity is top priority — "where do we stand?" should always have an answer
- Memory should always be updated after significant sessions
- Engineering work → Claude Code. Operations work → Cowork. Don't fight the tools.
