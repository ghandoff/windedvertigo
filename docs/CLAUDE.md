# winded.vertigo Monorepo — Project Conventions

## Session Memory

Read these three files at session start — they are the single source of truth:

| File | What's in it |
|------|-------------|
| `memory/projects/creaseworks.md` | Machine-readable project state: DB IDs, migration log, feature status, architecture, session-start checklist |
| `docs/creaseworks-backlog-2026-02-28.md` | Consolidated backlog: what's done, what to build next, open questions |
| This file (`docs/CLAUDE.md`) | Project conventions, commands, deployment, design tokens |

**Design references** (read when working on specific features):

| File | When to read |
|------|-------------|
| `docs/creaseworks-engagement-system.md` | Wiring credit system, photo consent, or upsells into user flows |
| `docs/creaseworks-image-sync-scope.md` | Building image sync tiers 3-4 (file properties, body content) |
| `docs/creaseworks-paywall-strategy.md` | Pack visibility, entitlement security, promotion touchpoints |
| `docs/notion-database-map.md` | Notion DB IDs, sync architecture, env vars |
| `docs/CREASEWORKS-DESIGN.md` | Full technical design (v0.3) — architecture, data models, visibility |

**At session end**: update `memory/projects/creaseworks.md` with new migration numbers, file counts, feature status, and latest commit hash.

## Repository Structure

```
windedvertigo/
├── apps/
│   ├── site/              ← windedvertigo.com static site (HTML/CSS/JS)
│   ├── creaseworks/       ← creaseworks Next.js app (TypeScript)
│   └── nordic-sqr-rct/   ← sqr-rct Next.js app (JavaScript)
├── packages/
│   └── tokens/            ← shared design tokens (CSS + TS)
├── scripts/               ← shared Notion sync scripts
├── .github/workflows/     ← CI + Notion sync
└── docs/                  ← design docs, migration plans
```

## Mount Instructions

**One folder to mount**: `~/Projects/windedvertigo/`

This monorepo contains all three winded.vertigo projects. No more multi-mount confusion — everything lives here.

**Working directory convention**: All terminal commands run from the **monorepo root** (`windedvertigo/`), not from individual app directories. This supports cross-project work. Exception: scripts that depend on `.env.local` (e.g., migration runner) may need to run from `apps/creaseworks/` since that's where the env file lives.

**Git**: The sandbox can run git commands (commit, diff, status, log) but cannot push/pull due to DNS restrictions. Garrett must run `git push origin main` from his local terminal after commits.

## Apps

### apps/site — windedvertigo.com
- Static HTML/CSS/JS site
- Hosted on Vercel (migrated from GitHub Pages, Feb 2026)
- Vercel project: `prj_k02f1LutCsQLZEDIyM2xYJ1PGPCx`
- Content synced from Notion via `scripts/fetch-notion.js`
- Pages: `/`, `/do/`, `/we/`, `/what/`, `/portfolio/`, `/vertigo-vault/`, `/projects/`
- Data files in `apps/site/data/` are auto-generated — do not edit directly
- Images in `apps/site/images/vertigo-vault/` are auto-downloaded from Notion

### apps/creaseworks — windedvertigo.com/reservoir/creaseworks
- Next.js 16, TypeScript, React 19, Tailwind CSS 4
- Auth.js + Neon Postgres + Stripe + Resend
- Repo: `ghandoff/windedvertigo` (this repo), Vercel Root Directory: `apps/creaseworks`
- Run locally: `npm run dev:creaseworks` (from monorepo root)

### apps/nordic-sqr-rct — sqr-rct app
- Next.js 14, JavaScript, React 18, Tailwind CSS 3
- Uses @anthropic-ai/sdk, openai, recharts, pdfkit, @vercel/blob
- Auth: bcryptjs + jose (JWT)
- Run locally: `npm run dev:sqr-rct` (from monorepo root)

## Notion Integration

All editorial content is authored in Notion and synced to the static site:

- **Portfolio assets**: Fetched from the BD multi-database (parent ID: `5e27b792adbb4a958779900fb59dd631`) via `notion.search()` — NOT `databases.query()` (doesn't work with multi-databases)
- **Vertigo Vault**: Activities + cover images from dedicated Notion database
- **Package Builder**: Pack configurations from Notion
- **Members** (`/we/` page): Synced via `scripts/sync-notion-members.js`
- **Services** (`/do/` page): Synced via `scripts/sync-notion-services.js`
- **What page** (`/what/` page): Content from Notion database (ID: `311e4ee74ba480268ad9de5a14d6dce4`), synced to `apps/site/data/what-page.json` via `scripts/fetch-notion.js`

Scripts output to `apps/site/data/` and `apps/site/images/`. The Notion REST API returns `url` under its actual name, not `userDefined:url` (MCP-only convention).

Notion API rate limit is 3 req/sec — monitor as more projects sync.

## Notion-as-CMS Roadmap

Long-term, all copy/text across the monorepo should be Notion-authored:
- creaseworks landing page copy
- ~~windedvertigo.com `/what/` page text~~ ✅ (synced from Notion "what page content" database)
- windedvertigo.com `/we/`, `/do/` page text
- sqr-rct content
- All synced to JSON or directly into the apps via shared scripts

## Maria's Image Workflow

Maria uploads thumbnail images for portfolio and vertigo vault. Options:
1. **GitHub web UI**: Drag images into `apps/site/images/thumbnails/` or `apps/site/images/vertigo-vault/` via browser (no git CLI needed)
2. **Notion-based**: Extend `fetch-notion.js` to download portfolio thumbnails from Notion file properties (vault covers already sync this way)

## Git & CI Conventions

- **Always rebase before push in CI workflows.** Any workflow that commits should `git pull --rebase origin main` before `git push`.
- **Thorough comments on every commit to scripts.** Include inline code comments explaining what changed and why.
- The Sync Notion Content workflow runs on push to main (scripts changes only), manual dispatch, and daily at 6 AM UTC.
- CI runs tsc + lint for creaseworks only when `apps/creaseworks/**` files change.

### Commit Message Style
- **Title**: `type: concise summary under 70 chars` (feat, fix, docs, chore)
- **Description**: what changed and why, then a file manifest with one-line descriptions
- Keep it human-readable — explain the *purpose*, not just the diff

## Deployment & Operations

**Claude Code has full network access** — it can run git operations, migrations, smoke tests, npm install, and all CLI commands directly. MCP integrations are also available for Vercel, Stripe, Notion, Cloudflare, Slack, Gmail, and Google Calendar.

### Common Commands

```bash
# ── Git ──────────────────────────────────────────────────
git pull --rebase                 # sync with remote (run before push)
git push                          # push commits to origin/main

# ── Migrations (from apps/creaseworks/) ──────────────────
node scripts/apply-migrations-028-032.mjs
# Applies SQL migrations 028–033 to Neon. Reads POSTGRES_URL from .env.local.
# Skips already-applied migrations. Safe to re-run.

# ── Smoke Test (from apps/creaseworks/) ──────────────────
node scripts/smoke-test.mjs https://windedvertigo.com/reservoir/creaseworks
# Hits all 29 routes, checks HTTP status, title/og:title presence.
# No auth — tests public + redirect behavior for protected routes.

# ── Dependencies (from monorepo root) ────────────────────
npm install                       # install/update all workspace deps

# ── Dev Servers (from monorepo root) ─────────────────────
npm run dev:creaseworks           # http://localhost:3000
npm run dev:sqr-rct               # http://localhost:3001

# ── Notion Sync (from monorepo root) ─────────────────────
npm run sync                      # fetch all Notion content → data/ + images/
npm run sync:footer               # sync footer HTML to static site + TS wrapper

# ── Tests & Linting (from monorepo root) ─────────────────
npm run test                      # vitest for creaseworks
npm run test:a11y                 # axe-core accessibility audit (needs dev server running)
npm run lint                      # eslint for creaseworks
```

> **Why not MCP tools or Chrome?** These are all simple CLI commands that run faster and more reliably from a terminal than through Vercel/Neon/Cloudflare MCP connectors or browser automation. Claude should prefer preparing scripts and telling Garrett to run them over navigating dashboards.

**Vercel projects** (auto-deploy from `main` branch of `ghandoff/windedvertigo`):
- creaseworks: `prj_EoDpRvw1kdAqcGVrcaYclfWFeX7b`
- windedvertigo-site: `prj_k02f1LutCsQLZEDIyM2xYJ1PGPCx`
- nordic-sqr-rct: `prj_laAl3qm5w20CrtIjO2klc9dj180z`
- Team: `team_wrpRda7ZzXdu7nKcEVVXY3th`

Claude also has MCP tool access to Vercel, Stripe, Notion, Cloudflare, Slack, Gmail, and Google Calendar.

## Shared Design Tokens (`packages/tokens`)

Single source of truth for brand palette, semantic colours, spacing, typography, and accessibility primitives. All apps import `packages/tokens/index.css`; server-side code (PDF generation, emails) imports `packages/tokens/index.ts`.

### Colour rules
- **Never hardcode hex** in components. Use CSS custom properties from tokens (`--wv-cadet`, `--color-text-on-dark`, etc.).
- Brand palette: `--wv-cadet`, `--wv-redwood`, `--wv-sienna`, `--wv-champagne`, `--wv-white`.
- Semantic colours map brand to function and are tested to WCAG AAA (7:1) contrast.
- Dark card surfaces: `--color-surface-raised` (#1e2738).

### Inclusive design foundations (applied globally via tokens import)
- **prefers-reduced-motion**: global reset kills all animation when OS setting is on.
- **:focus-visible**: 3px blue (#3B82F6) outline, 2px offset, on all interactive elements.
- **Typography**: 16px base, line-height 1.6, letter-spacing 0.02em, max-width 70ch.
- **prefers-contrast: more**: bumps text-primary to pure black, secondary to gray-800.

### Nordic SQR-RCT
Stays platform-branded by Nordic. Does NOT import wv brand tokens. Has "powered by winded.vertigo" in footer for attribution only.

### Shared footer (`packages/tokens/footer.html`)
Single source of truth for the winded.vertigo footer used by every app. Edit this one file, then run `npm run sync:footer` to:
1. Regenerate `packages/tokens/footer-html.ts` (TS wrapper for creaseworks import)
2. Inject the footer HTML into all 10 static site pages in `apps/site/`

Creaseworks renders the footer via `dangerouslySetInnerHTML` — zero reconstruction, same HTML everywhere.

### Accessibility
- **Skip-to-content links** in creaseworks layout and static site pages.
- **ARIA landmarks**: `aria-label="main navigation"` on all navs, `aria-label="social links"` on footer nav.
- **Form accessibility**: all inputs have `aria-label` or associated `<label>`, error messages connected via `aria-describedby`, forms have `aria-label`.
- **Automated audit**: `npm run test:a11y` runs axe-core against the dev server (install deps first: `npm install`).
- **Contrast**: all text/bg combos tested to WCAG AAA (7:1). Accent-on-dark uses `--color-accent-on-dark` (#e09878, 5.5:1 AA).

## npm Workspaces

Root `package.json` declares `"workspaces": ["apps/*", "packages/*"]`. Convenience commands:
- `npm run sync` — run Notion fetch scripts
- `npm run sync:footer` — sync canonical footer to static site + TS wrapper
- `npm run dev:creaseworks` — start creaseworks dev server
- `npm run dev:sqr-rct` — start sqr-rct dev server
- `npm run test` — run creaseworks tests (vitest)
- `npm run test:a11y` — run accessibility audit against dev server
- `npm run lint` — run creaseworks linter

Each app keeps its own `package.json` and `node_modules`. Install at root: `npm install`.

## Vercel Configuration

Each app is its own Vercel project with monorepo Root Directory settings:
- **creaseworks**: Root Directory → `apps/creaseworks`
- **nordic-sqr-rct**: Root Directory → `apps/nordic-sqr-rct`
- **site**: Root Directory → `apps/site`, framework "Other" (migrated to Vercel Feb 2026)

## Infrastructure Decisions

- **Supabase evaluation**: Test on the next new project (possibly sqr-rct rebuild). Don't migrate creaseworks mid-flight. If Supabase wins, consolidate later.
- ~~**Vercel consolidation**: Plan to move static site to Vercel alongside apps.~~ ✅ Done (Feb 2026) — all three projects now deploy from Vercel.

## Tooling

### Smoke Test (`apps/creaseworks/scripts/smoke-test.mjs`)
Tests 29 routes: 5 public (expect 200), 14 protected (expect 200/302/303/307), 9 admin (expect 302/303/307/403), 1 API. Validates `<title>` and `og:title` presence on 200 responses. Run: `node scripts/smoke-test.mjs [base-url]`

### Migration Runner (`apps/creaseworks/scripts/apply-migrations-028-032.mjs`)
Applies SQL migration files 028–033 using `@neondatabase/serverless`. Strips `--` comments before splitting on `;` (critical — semicolons inside comments cause false splits). Skips already-applied migrations. Requires `DATABASE_URL` or `POSTGRES_URL` in env/.env.local.

### Gotchas
- **Neon serverless driver**: One SQL statement per HTTP call. Multi-statement SQL files must be split. Comments must be stripped first.
- **Next.js Metadata API**: Root layout uses `title: { template: "%s — creaseworks" }`. Route metadata only needs the page-specific part (e.g., `title: "packs"` renders as "packs — creaseworks").
- **Error boundaries**: Must be `"use client"`. Receive `{ error, reset }`. Brand colors via CSS custom properties. Dev-only error display via `process.env.NODE_ENV === "development"`.
