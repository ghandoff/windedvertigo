# winded.vertigo

Monorepo for [winded.vertigo](https://windedvertigo.com) — a collective of designers, researchers, and strategists building tools and content for creative co-design.

## Projects

| App | Stack | URL |
|-----|-------|-----|
| **site** | Static HTML/CSS/JS | [windedvertigo.com](https://windedvertigo.com) |
| **creaseworks** | Next.js · TypeScript · Postgres | [windedvertigo.com/reservoir/creaseworks](https://windedvertigo.com/reservoir/creaseworks) |
| **nordic-sqr-rct** | Next.js · JavaScript | — |

## Getting Started

```bash
# Install root dependencies (Notion sync scripts)
npm install

# Start creaseworks
npm run dev:creaseworks

# Start sqr-rct
npm run dev:sqr-rct

# Sync content from Notion
npm run sync
```

Each app has its own dependencies. Install them individually if needed:

```bash
cd apps/creaseworks && npm install
cd apps/nordic-sqr-rct && npm install
```

## Structure

```
apps/
  site/              Static site (HTML/CSS/JS, Notion-synced content)
  creaseworks/       Co-design pattern platform
  nordic-sqr-rct/   SQR-RCT app
scripts/             Shared Notion sync scripts
docs/                Design docs and migration plans
```
