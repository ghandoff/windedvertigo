# winded.vertigo Monorepo — Project Conventions

## Repository Structure

```
windedvertigo/
├── apps/
│   ├── site/              ← windedvertigo.com static site (HTML/CSS/JS)
│   ├── creaseworks/       ← creaseworks Next.js app (TypeScript)
│   └── nordic-sqr-rct/   ← sqr-rct Next.js app (JavaScript)
├── scripts/               ← shared Notion sync scripts
├── .github/workflows/     ← CI + Notion sync
└── docs/                  ← design docs, migration plans
```

## Mount Instructions

**One folder to mount**: `~/Projects/windedvertigo/`

This monorepo contains all three winded.vertigo projects. No more multi-mount confusion — everything lives here.

The `.git` directory is NOT visible through the Cowork mount. All git operations (commit, push, pull) must be run by Garrett in his local terminal.

## Apps

### apps/site — windedvertigo.com
- Static HTML/CSS/JS site
- Hosted on GitHub Pages (CNAME: windedvertigo.com)
- Content synced from Notion via `scripts/fetch-notion.js`
- Pages: `/`, `/do/`, `/we/`, `/what/`, `/portfolio/`, `/vertigo-vault/`, `/projects/`
- Data files in `apps/site/data/` are auto-generated — do not edit directly
- Images in `apps/site/images/vertigo-vault/` are auto-downloaded from Notion

### apps/creaseworks — creaseworks.windedvertigo.com
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

Scripts output to `apps/site/data/` and `apps/site/images/`. The Notion REST API returns `url` under its actual name, not `userDefined:url` (MCP-only convention).

Notion API rate limit is 3 req/sec — monitor as more projects sync.

## Notion-as-CMS Roadmap

Long-term, all copy/text across the monorepo should be Notion-authored:
- creaseworks landing page copy
- windedvertigo.com `/what/`, `/we/`, `/do/` page text
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

## npm Workspaces

Root `package.json` declares `"workspaces": ["apps/*"]`. Convenience commands:
- `npm run sync` — run Notion fetch scripts
- `npm run dev:creaseworks` — start creaseworks dev server
- `npm run dev:sqr-rct` — start sqr-rct dev server
- `npm run test` — run creaseworks tests (vitest)
- `npm run lint` — run creaseworks linter

Each app keeps its own `package.json` and `node_modules`. Install at root: `npm install`.

## Vercel Configuration

Each app is its own Vercel project with monorepo Root Directory settings:
- **creaseworks**: Root Directory → `apps/creaseworks`
- **nordic-sqr-rct**: Root Directory → `apps/nordic-sqr-rct`
- **site** (when moved to Vercel): Root Directory → `apps/site`, framework "Other"

## Infrastructure Decisions

- **Supabase evaluation**: Test on the next new project (possibly sqr-rct rebuild). Don't migrate creaseworks mid-flight. If Supabase wins, consolidate later.
- **Vercel consolidation**: Plan to move static site to Vercel alongside apps, enabling shared header/footer/brand system with path-based routing.
