# winded.vertigo

Monorepo for [winded.vertigo](https://windedvertigo.com) — a collective of designers, researchers, and strategists building tools and content for creative co-design.

## Projects

| App | Stack | URL |
|-----|-------|-----|
| **site** | Static HTML/CSS/JS | [windedvertigo.com](https://windedvertigo.com) |
| **reservoir** | Next.js · TypeScript | [windedvertigo.com/reservoir](https://windedvertigo.com/reservoir) |
| **creaseworks** | Next.js · TypeScript · Postgres · Stripe | [windedvertigo.com/reservoir/creaseworks](https://windedvertigo.com/reservoir/creaseworks) |
| **deep-deck** | Next.js · TypeScript | [windedvertigo.com/reservoir/deep-deck](https://windedvertigo.com/reservoir/deep-deck) |
| **vertigo-vault** | Next.js · TypeScript · Notion API | [windedvertigo.com/reservoir/vertigo-vault](https://windedvertigo.com/reservoir/vertigo-vault) |
| **nordic-sqr-rct** | Next.js · JavaScript · Notion API | *(Nordic-branded, separate domain)* |

## Getting Started

```bash
# Install all workspace dependencies
npm install

# Start individual dev servers
npm run dev:creaseworks    # http://localhost:3000
npm run dev:sqr-rct        # http://localhost:3001
npm run dev:reservoir
npm run dev:deep-deck
npm run dev:vault

# Build all workspaces
npm run build

# Sync content from Notion
npm run sync
```

## Structure

```
apps/
  site/              Static site (HTML/CSS/JS, Notion-synced content)
  reservoir/         Reservoir hub — landing page for all tools
  creaseworks/       Co-design playdate platform
  deep-deck/         Conversation card game
  vertigo-vault/     Group activity library
  nordic-sqr-rct/   Systematic review tool (Nordic-branded)
packages/
  tokens/            Shared design tokens (CSS + TS) and footer
scripts/             Shared Notion sync scripts
docs/                Design docs, brand guidelines, roadmaps
```
