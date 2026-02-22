# Monorepo Migration Plan

## Goal

Consolidate windedvertigo-site, creaseworks, and nordic-sqr-rct into a single GitHub monorepo (`ghandoff/windedvertigo`) so there's one folder to mount, one source of truth, and one place to work.

## Tonight's scope

Prepare the monorepo structure locally. No DNS changes, no Vercel project reconfiguration. Everything keeps working on its current hosting until you're ready to flip.

---

## Target Structure

```
windedvertigo/
├── apps/
│   ├── site/                  ← windedvertigo.com static site (HTML/CSS/JS)
│   │   ├── data/              ← generated JSON (portfolio, vault, package-builder)
│   │   ├── images/            ← brand assets, thumbnails, vault covers
│   │   ├── portfolio/
│   │   ├── vertigo-vault/
│   │   ├── do/ we/ what/ projects/
│   │   ├── styles/
│   │   ├── index.html
│   │   ├── 404.html
│   │   ├── robots.txt
│   │   └── sitemap.xml
│   │
│   ├── creaseworks/           ← creaseworks Next.js app
│   │   ├── src/
│   │   ├── migrations/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── vercel.json
│   │
│   └── nordic-sqr-rct/       ← sqr-rct Next.js app
│       ├── src/
│       ├── public/
│       ├── next.config.js
│       └── package.json
│
├── scripts/
│   ├── fetch-notion.js        ← existing site sync (portfolio, vault, package-builder)
│   ├── notion-config.js       ← shared Notion DB IDs
│   └── sync-notion-services.js
│
├── .github/
│   └── workflows/
│       ├── sync-notion.yml    ← existing daily sync, updated paths
│       └── ci.yml             ← creaseworks tsc + lint + test
│
├── docs/
│   ├── CREASEWORKS-DESIGN.md
│   ├── INFRASTRUCTURE-MIGRATION.md
│   └── NOTION-INTEGRATION.md
│
├── package.json               ← root: npm workspaces, Notion client dep
├── CLAUDE.md                  ← single project instructions file
└── README.md
```

## What moves where

| Current location | New location | Notes |
|---|---|---|
| `windedvertigo-site/` root HTML/CSS/JS | `apps/site/` | Static site pages, styles, images, data |
| `windedvertigo-site/scripts/` | `scripts/` | Notion sync scripts (shared, not per-app) |
| `windedvertigo-site/.github/` | `.github/` | Workflows updated with new paths |
| `windedvertigo-site/CLAUDE.md` | `CLAUDE.md` | Rewritten for monorepo |
| `windedvertigo-site/*.md` docs | `docs/` | Design docs, migration plan |
| `~/Projects/creaseworks/` | `apps/creaseworks/` | Full app, preserving all files |
| `~/Projects/nordic-sqr-rct/` | `apps/nordic-sqr-rct/` | Full app, preserving all files |
| `windedvertigo-site/creaseworks/` | DELETED | Stale copy, source of confusion |
| `windedvertigo-site/creaseworks-project/` | DELETED | Legacy copy |

## What does NOT move

- `node_modules/` — each app keeps its own; root gets one for scripts
- `.git/` histories — we start fresh (old repos stay archived on GitHub)
- `.next/` build outputs — gitignored

## Maria's image workflow

Currently Maria uploads thumbnails to the Google Drive folder. In the monorepo:

**Option: keep it simple with a shared Google Drive → git sync**

Maria keeps uploading images to a Google Drive folder. A script (or GitHub Action) pulls them into `apps/site/images/`. But this adds complexity.

**Better option: Maria commits images directly**

Give Maria GitHub access to the repo. She drags images into `apps/site/images/thumbnails/` or `apps/site/images/vertigo-vault/` via the GitHub web UI (no git CLI needed — GitHub lets you upload files via browser). The push triggers a deploy. This is simpler, auditable, and she can see the full image library.

If Maria isn't comfortable with GitHub, a Notion-based image workflow is the long-term answer anyway (vault covers already sync from Notion). Portfolio thumbnails could too — the fetch-notion.js script already downloads vault cover images. Extending it to download portfolio thumbnails from Notion file properties would eliminate the manual upload entirely.

## Notion-as-CMS direction

The monorepo doesn't change this plan, but it positions you well for it:

- `scripts/fetch-notion.js` already generates JSON for portfolio, vault, and package-builder
- Creaseworks already syncs patterns/materials/packs/runs from Notion
- The natural next step: creaseworks landing page copy, site /what/ /we/ /do/ page text, and sqr-rct content all authored in a Notion "copy" database and synced to JSON or directly into the apps
- Having all sync scripts in one `scripts/` folder makes it easy to share the Notion client, config, and rate-limit logic

## npm workspaces setup

Root `package.json`:
```json
{
  "name": "windedvertigo",
  "private": true,
  "workspaces": ["apps/*"],
  "scripts": {
    "sync": "node scripts/fetch-notion.js",
    "dev:creaseworks": "npm run dev -w apps/creaseworks",
    "dev:sqr-rct": "npm run dev -w apps/nordic-sqr-rct",
    "build:creaseworks": "npm run build -w apps/creaseworks",
    "build:sqr-rct": "npm run build -w apps/nordic-sqr-rct",
    "test": "npm run test -w apps/creaseworks",
    "lint": "npm run lint -w apps/creaseworks"
  },
  "dependencies": {
    "@notionhq/client": "^2.3.0",
    "node-fetch": "^3.3.2"
  }
}
```

Each app keeps its own `package.json` and `node_modules`. The root workspace just provides convenience scripts and the shared Notion dependency for sync scripts.

## Vercel project configuration

Each app stays its own Vercel project. Vercel supports monorepos natively:

- **creaseworks** Vercel project: set Root Directory to `apps/creaseworks`
- **nordic-sqr-rct** Vercel project: set Root Directory to `apps/nordic-sqr-rct`
- **site** (when you move it to Vercel later): Root Directory `apps/site`, framework "Other"

No changes needed tonight — existing Vercel projects keep deploying from their current repos. You'll reconnect them to the monorepo when ready.

## CLAUDE.md rewrite

Single file at the root. Key changes:
- Mount path: one folder, no more multi-mount confusion
- All apps documented in one place
- Maria's workflow documented
- Notion-as-CMS roadmap noted
- Git conventions (all in one repo now)

## Steps (tonight)

1. Create the monorepo directory structure at `~/Projects/windedvertigo/`
2. Copy `apps/site/` from windedvertigo-site (HTML, CSS, JS, images, data — NOT creaseworks/, creaseworks-project/, node_modules/, .git/)
3. Copy `apps/creaseworks/` from ~/Projects/creaseworks (NOT node_modules/, .next/, .git/)
4. Copy `apps/nordic-sqr-rct/` from ~/Projects/nordic-sqr-rct (NOT node_modules/, .next/, .git/)
5. Copy `scripts/` from windedvertigo-site/scripts/
6. Copy and update `.github/workflows/`
7. Write root `package.json`, `.gitignore`, `CLAUDE.md`, `README.md`
8. Update sync-notion.yml paths (scripts now at root, data output to apps/site/data/)
9. Update ci.yml paths (creaseworks now at apps/creaseworks/)
10. Verify: `npm install` at root works, `npm run dev:creaseworks` works
11. Garrett: `git init`, first commit, push to `ghandoff/windedvertigo`
12. Garrett: reconnect Vercel projects to new repo (when ready)
13. Garrett: archive old repos (when ready)

## What I'll build in this session

Steps 1-10 above. I'll create the full directory structure, copy all files, update all paths, and verify it works. You handle 11-13 in your terminal since I can't do git operations through the mount.
