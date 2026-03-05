# winded.vertigo — Development Roadmap

*Cross-project priorities, upcoming work, and open decisions. Updated Mar 2026.*

## Status Overview

| App | Stage | Next Milestone |
|-----|-------|---------------|
| **site** (windedvertigo.com) | Live, CMS-backed | Wire remaining pages to Notion CMS |
| **creaseworks** | Live (Phase 3 + Stripe) | Onboarding polish, next/image evaluation |
| **reservoir** | In development | Wire to CMS JSON, game showcase content |
| **deep-deck** | In development | — |
| **nordic-sqr-rct** | Live | Potential Supabase migration |
| **vertigo-vault** | In development | — |

## Infrastructure (cross-cutting)

### Completed

- [x] Monorepo consolidation (all apps under `windedvertigo/`)
- [x] npm workspaces configured
- [x] Shared design tokens (`packages/tokens`) with CSS + TS exports
- [x] Canonical shared footer (`packages/tokens/footer.html` → sync to all apps)
- [x] Vercel hosting for all 6 projects (migrated from GitHub Pages, Feb 2026)
- [x] Turborepo + `turbo-ignore` for selective deploys (Mar 2026) — 75% deploy reduction
- [x] Removed duplicate Vercel project (`windedvertigo`) consuming quota
- [x] Notion-as-CMS pipeline for `/what/` page (database → JSON → client-side render)
- [x] Site Content CMS database in Notion (ID: `09a046a556c1455e80073546b8f83297`)
- [x] Removed orphaned What Page V2 legacy database from sync (Mar 2026) — superseded by Site Content CMS
- [x] Restored simple `/what/` page with metadata-only CMS overlay (Mar 2026) — redesign moved to `feature/what-redesign` branch
- [x] Removed `/what-v2/` development URL and stale `what-page.json` (Mar 2026)
- [x] Standardized all 5 Next.js apps on Next.js 16 + React 19 (Mar 2026) — nordic-sqr-rct from 14/18, deep-deck/reservoir/vertigo-vault from 15/19
- [x] HSTS + CSP security headers on all apps (Mar 2026) — in both `next.config.ts` and `vercel.json`
- [x] ESLint 9 flat config migration (Mar 2026) — all apps use `eslint.config.mjs`, lint script uses `eslint` directly
- [x] Standardized `.gitignore` files and aligned `@types/node` across all apps (Mar 2026)
- [x] Cleaned stale git branches and dismissed Dependabot alerts (Mar 2026)
- [x] Hardened sync-notion CI workflow — rebase before push, conditional commit step (Mar 2026)

### In Progress

- [x] Wire `/we/` and `/do/` pages to Notion CMS — code done (tier 4 #16), env vars set (session 49)
- [ ] `/what/` page redesign — lives on `feature/what-redesign` branch, waiting on backdrop images from Garrett

### Planned

- [ ] Wire reservoir Next.js app to CMS JSON (replace hardcoded `GAMES` array in `game-showcase.tsx`)
- [ ] Supabase evaluation — test on next new project (possibly sqr-rct rebuild), don't migrate creaseworks mid-flight
- [ ] Image hosting consolidation — one R2 bucket, folder convention (`/creaseworks/`, `/sqr-rct/`, `/site/`)
- [ ] Consider Vercel Pro ($20/mo) if deployment quota becomes tight again

## apps/site — windedvertigo.com

### Completed

- [x] Static site fully on Vercel
- [x] Notion content sync for portfolio, vertigo vault, members, services, what page
- [x] `/we/` page a11y fixes (champagne role/links, white see-more, photo resize to 75%)
- [x] GitHub Pages workflow removed (redundant)

### Next Up

- [ ] `/what/` page redesign — develop on `feature/what-redesign` branch, merge once backdrop images provided
- [ ] `/we/` page CMS wiring (move team bios to Notion)
- [ ] `/do/` page CMS wiring (move services to Notion)
- [ ] Maria's image workflow — either GitHub web UI drag-and-drop or Notion-based auto-download

## apps/creaseworks

See `docs/creaseworks-backlog-2026-02-28.md` for the detailed backlog with all feature items.

### Recently Completed (sessions 44–49)

- [x] Profile page consolidation (removed duplicate stat/pack displays)
- [x] Analytics dashboard (sparklines, conversion funnel, credit economy)
- [x] Server-side playdate search (ILIKE across 4 fields + collections)
- [x] Test coverage expansion (53 → 123 tests, 132% increase)
- [x] PWA mobile install support
- [x] In-app notification center
- [x] Progressive disclosure / user tiers (casual → curious → collaborator)
- [x] Stripe products/prices + migration 043 (session 49)
- [x] Purchase notification in webhook handler (session 49)
- [x] Pilot email invites with bulk entry via Resend (session 49)
- [x] CMS env vars for /we/ and /do/ pages set in Vercel (P2-6, session 49)

### Next Up

- [ ] next/image migration (document cost implications for budgeting first)
- [ ] Onboarding flow polish
- [ ] Image sync tiers 3-4 (file properties, body content) — see `docs/creaseworks-image-sync-scope.md`

## apps/reservoir

### Next Up

- [ ] Wire game showcase to CMS JSON data (replace hardcoded `GAMES` array)
- [ ] Content population from Notion
- [ ] Styling refinement with brand tokens

## apps/nordic-sqr-rct

- Live and stable
- Upgraded to Next.js 16 + React 19 (Mar 2026): async params fixed (`use()` in client component, `await` in API routes)
- Potential Supabase rebuild candidate
- Stays platform-branded by Nordic (no wv tokens)

## apps/deep-deck, apps/reservoir & apps/vertigo-vault

- All upgraded to Next.js 16, TypeScript, React 19 (Mar 2026)
- HSTS + CSP security headers, ESLint flat configs
- All deploy to Vercel with turbo-ignore

## Open Decisions

| Decision | Options | Status |
|----------|---------|--------|
| Supabase vs Neon | Test on next new project, don't migrate creaseworks | Decided — deferred |
| next/image migration | Evaluate Vercel image optimization cost | Needs budgeting |
| Shared header template | Each app's nav needs differ too much | Decided — skip |
| Vercel Pro upgrade | $20/mo for 6,000 deploys/day | Monitor quota usage first |
