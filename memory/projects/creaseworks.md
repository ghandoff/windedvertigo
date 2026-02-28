# creaseworks — project state

*Machine-readable project status. Update at the end of every session.*

## Quick Reference

| Key | Value |
|-----|-------|
| **App** | Next.js 16 + React 19 + TypeScript |
| **URL** | https://creaseworks.windedvertigo.com |
| **Vercel project** | creaseworks (ghandoffs-projects) |
| **Neon DB** | creaseworks-db (divine-dust-87453436) |
| **Branch** | br-green-cherry-air8nyor |
| **Repo path** | `apps/creaseworks/` |
| **Source files** | 235 (.ts + .tsx) |
| **Migrations** | 035 (latest: gallery_visible_fields) — 028-033 applied to Neon, 034-035 pending |
| **Latest commit** | `7cf32af` (chore: update migration runner for 034-035) |
| **Last session** | 32 (Feb 28, 2026) |

## Notion Database IDs

| Database | ID | Data Source ID |
|----------|----|----------------|
| **Collections** | `312e4ee7-4ba4-8139-b891-fcd21e275a21` | `312e4ee7-4ba4-81a7-9635-000b05e82f4e` |
| **Packs** | `beb34e7b-86cd-4f20-b9be-641431b99e5f` | — |
| **Playdates** | `b446ffd5d1664a31b4f5f6a93aadaab8` | `0a90f5dc-a264-48ff-a49f-fabb07667116` |

## Chrome Tabs (Cowork Session)

These tab IDs change per session. Update at session start.

| Tab | ID | URL |
|-----|----|-----|
| Neon SQL editor | `1533420837` | console.neon.tech/.../sql-editor |
| Vercel deployments | `1533420889` | vercel.com/.../creaseworks/deployments |
| Notion playdates | `1533421409` | notion.so/b446ffd5... |
| GitHub repo | `1533421393` | github.com/ghandoff/windedvertigo |
| Stripe dashboard | `1533420846` | dashboard.stripe.com/.../test/dashboard |
| Live site | `1533421589` | creaseworks.windedvertigo.com |

## Architecture Overview

```
src/
├── app/                    # Next.js app router pages + API routes
│   ├── admin/              # Admin hub, gallery moderation, playdates, invites
│   ├── api/                # REST endpoints (runs, matcher, gallery, co-play, seasonal, PDF, cron)
│   ├── campaign/[slug]/    # Public campaign landing pages
│   ├── co-play/[code]/     # Co-play join + reflection pages
│   ├── gallery/            # Public community gallery
│   ├── matcher/            # Material matcher wizard
│   ├── onboarding/         # Play context onboarding wizard
│   ├── packs/              # Pack catalog + detail
│   ├── playbook/           # Collection list + [slug] detail
│   ├── profile/            # User profile + notification prefs
│   ├── reflections/        # Run log + evidence capture
│   ├── sampler/            # Free playdate teasers + [slug] detail
│   └── scavenger/          # Campaign aggregation page
├── components/
│   ├── matcher/            # MatcherInputForm (split into 6 files)
│   ├── ui/                 # Shared UI (playdate-card, run-form/ directory)
│   └── *.tsx               # Feature components (co-play, gallery, seasonal, pack-finder, playbook-search, playdate-peek, etc.)
└── lib/
    ├── auth.ts             # Auth.js session helpers
    ├── db.ts               # Neon serverless client
    ├── email/              # Resend templates (digest, nudge)
    ├── queries/            # Database query layers
    │   ├── runs/           # Directory module (6 files + index.ts)
    │   ├── matcher/        # Directory module (6 files + index.ts)
    │   ├── gallery.ts      # Community gallery (10 functions)
    │   ├── co-play.ts      # Co-play queries
    │   ├── seasonal.ts     # Seasonal recommendations
    │   └── ...             # collections, evidence, entitlements, invites, etc.
    ├── seasonal.ts         # Season detection + tag mapping
    ├── security/           # Column selectors, entitlement checks
    ├── sync/               # Notion → Neon sync handlers (5 handlers + generic utility)
    └── validation.ts       # parseJsonBody<T>() shared helper
```

## Feature Status

### Core Features (sessions 1-21)
- ✅ Auth (Auth.js + Google/credentials)
- ✅ Notion → Neon sync (playdates, collections, packs, materials, runs)
- ✅ Matcher (materials + context → scored playdate recommendations)
- ✅ Run logging + evidence capture (photos via R2, notes, ratings)
- ✅ Badge system (tried → found → folded & unfolded → found again)
- ✅ Collection progress tracking
- ✅ Stripe checkout (4 tiers: sampler/explorer/practitioner/collective)
- ✅ PDF generation per playdate
- ✅ Email digest cron (Resend)

### Session 22-26 Features
- ✅ Campaign system (/campaign/[slug])
- ✅ Sampler curation (5 playdates, admin view separated)
- ✅ Play context switcher (multi-context onboarding)
- ✅ Complimentary invite system (/admin/invites)
- ✅ Scavenger hunt page (/scavenger)
- ✅ Quick-log button on playdate cards
- ✅ Design tokens (packages/tokens) + accessibility
- ✅ **Feature B**: First-visit onboarding banner + start-here card
- ✅ **Feature C**: Community gallery with admin moderation
- ✅ **Feature D**: Email nudge system (daily cron, Resend)
- ✅ **Feature E**: Deterministic SVG playdate illustrations
- ✅ **Feature F**: Age range indicators
- ✅ **Feature G**: Energy level signal (calm/moderate/active)
- ✅ **Feature I**: Seasonal recommendation banner
- ✅ **Feature J**: PDF batch export for collections
- ✅ **Feature K**: Co-play mode (invite codes + shared reflections)

### Session 28-29 Features (Wave 2: Q–X)
- ✅ **Feature Q**: Stripe price_id support (checkout uses pre-created Stripe prices)
- ✅ **Feature T**: Playdate peek cards (expandable teasers for non-entitled pack view)
- ✅ **Feature U**: Gallery approval email (Resend notification on admin approve)
- ✅ **Feature V**: Campaign DB lookup (replace hardcoded campaign metadata)
- ✅ **Feature W**: Pack finder wizard (3-question guided selector on /packs)
- ✅ **Feature X**: Playbook search/filter (text search + progress filter chips)

### Session 30 Features (Wish List: O, P, Y)
- ✅ **Feature O**: PDF material icons (geometric shapes per 12 form categories in drawLinkedMaterials)
- ✅ **Feature P**: Playdate preview composites (central function icons + denser activity hints)
- ✅ **Feature Y**: Non-reader visual architecture (nav icons, section colours, mobile bottom tab bar)

### Session 31 (Feb 28, 2026) — Hardening & Tooling
- ✅ Migrations 028–033 applied to Neon (reflection credits, photo consents, leaderboard, tinkering tier, cover images, stripe_price_id)
- ✅ Checkout flow fix: added `stripe_price_id` column + seeded 6 test-mode prices
- ✅ SEO metadata pass: 10 additional routes (19 total with metadata)
- ✅ Error boundaries: 7 route-specific `error.tsx` files (8 total including global)
- ✅ Smoke test script: 29 routes, validates HTTP status + SEO tags
- ✅ Migration runner script: comment-aware SQL splitting for Neon serverless driver

### Session 32 (Feb 28, 2026) — Gallery View Control + Vertigo-Vault Monorepo Move
- ✅ **Phase 1: Gallery View Control from Notion**
  - `gallery_visible_fields` multi-select synced from Notion → Neon (JSONB column)
  - PlaydateCard accepts `visibleFields` prop, gates each property block via `show()` helper
  - All 7 usage sites updated; admin always sees all
  - Migration 035, column selector, db-compat check added
  - Notion property still needs to be created manually by Garrett
- ✅ **Phase 2: Vertigo-Vault monorepo move**
  - `apps/vertigo-vault/` — standalone Next.js app with ISR (revalidate=3600)
  - Notion API fetching via `@notionhq/client` with pagination + block→markdown
  - Full React UI: gallery grid, filter bar (type + duration), slide-in detail modal
  - `basePath: "/reservoir/vertigo-vault"` set for routing via windedvertigo.com
  - TypeScript compiles clean; no CI sync needed (ISR replaces it)
  - **Needs**: `NOTION_TOKEN` env var in Vercel project settings
- 🐛 **Critical fix: creaseworks 404s** — removed premature `basePath: "/reservoir/creaseworks"` from next.config.ts + updated Vercel rewrite destinations in apps/site/vercel.json
- ✅ Migration runner updated for 034-035
- ✅ CLAUDE.md Local Terminal Runbook added

### Open UX Items (from review doc Part 1)
- ✅ **Item 4**: First-visit onboarding — resolved (sessions 23, 26: onboarding wizard + FirstVisitBanner)
- ✅ **Item 5**: Card visual hierarchy — resolved (sessions 26-27: SVG illustrations, age range tags, energy levels, "great first pick" beginner badge, "🔥 popular" badge for 5+ tries)
- ✅ **Item 7**: Collection CTA — resolved (session 24, quick-log button + card links)
- ✅ **Item 8**: Reflection form pre-select — resolved (pre-existing ?playdate= param)
- ✅ **Item 9**: Playbook prominence — resolved (session 27: homepage redirects logged-in users to /playbook; grammar fix)
- ✅ **Item 10**: Profile page minimal — resolved (session 27: ProfileDashboard with stats, badges, activity, streaks)

### Content Status
- 30 playdates (5 sampler, 3 campaign, 22 internal-only)
- 12 collections (original 6 + story builders, nature detectives, color lab, body movers, quiet makers, fix-it shop)
- 6 packs (co-design essentials, rainy day rescue, classroom starter, summer play camp, the whole collection, new baby sibling)

## Migration Log

| # | Name | What it does |
|---|------|-------------|
| 001-019 | (sessions 1-21) | Core schema, users, runs, evidence, entitlements, etc. |
| 020 | campaign-tags | `campaign_tags TEXT[]` + GIN index on playdates_cache |
| 021 | play-contexts | `play_contexts JSONB` + `active_context_name` on users |
| 022 | invites | `invites` table with tier constraint + soft delete |
| 023 | age-range-energy | `age_range`, `energy_level` on playdates_cache |
| 024 | community-gallery | `shared_to_gallery`, `gallery_approved` on run_evidence |
| 025 | email-preferences | biweekly digest, nudge_enabled, last_active_at |
| 026 | co-play-mode | `co_play_invite_code`, `co_play_parent_id`, `co_play_reflections` on runs_cache |
| 027 | campaigns | `campaigns` table (slug, title, description, active) + acetate seed |
| 028 | reflection-credits | `reflection_credits` table for engagement system |
| 029 | photo-consents | `photo_consents` table (COPPA three-tier model) |
| 030 | leaderboard | `leaderboard_display_name`, `leaderboard_opted_in` on users; `partner_api_keys` table |
| 031 | tinkering-tier | `tinkering_tier` on playdates_cache |
| 032 | cover-images | `cover_url`, `cover_r2_key` on playdates_cache |
| 033 | stripe-price-id | `stripe_price_id TEXT` on packs_catalogue + seed 6 test-mode prices |
| 034 | collection-covers | `cover_url`, `cover_r2_key` on collections |
| 035 | gallery-visible-fields | `gallery_visible_fields JSONB` on playdates_cache |

## Stripe Price IDs (Test Mode)

| Pack | Pack UUID | Stripe Price ID | Amount |
|------|-----------|-----------------|--------|
| classroom starter | `91753e91-54eb-43ad-a9ab-e4fdc015ae08` | `price_1T5EZ2D50swbC2DglU1gwqio` | $4.99 |
| new baby sibling | `36f5e2d2-39f8-4fa5-8419-8435a19f5023` | `price_1T5EZ3D50swbC2Dgl1hyJoy5` | $4.99 |
| rainy day rescue | `9419aa6d-7fc2-4699-a78d-cbf8547c0fee` | `price_1T5EZ4D50swbC2DgddSTnMgt` | $4.99 |
| summer play camp | `03eaa0b6-c4fa-4fb2-b16e-69970e4f9910` | `price_1T5EZ5D50swbC2DglQtrSnbg` | $4.99 |
| the whole collection | `9f5e9e28-4ab9-4553-8697-88eb80656a91` | `price_1T5EZ6D50swbC2DgpaTfaJ3N` | $14.99 |
| co-design essentials | `b535a022-90c0-4e14-b92b-54a43e7aac76` | `price_1T5bqmD50swbC2DgkKdiEHwH` | $49.99 |

## SEO & Error Boundary Coverage

**Routes with metadata** (19): /, /login, /onboarding, /matcher, /sampler, /scavenger, /admin/campaigns, /admin/invites, /campaign/[slug], /packs, /playbook, /community, /gallery, /profile, /checkout/success, /playbook/portfolio, /playbook/reflections, /reflections/new, /admin

**Error boundaries** (8 route groups): global (app root), packs, playbook, profile, admin, checkout, gallery, community

## Upcoming / Open Items

### Plan: Gallery View + Vertigo-Vault + URL Restructure (magical-brewing-hummingbird.md)
- ✅ Phase 1: Gallery View Control from Notion (`gallery_visible_fields`)
- ✅ Phase 2: Vertigo-Vault monorepo move (`apps/vertigo-vault/`)
- ⏳ Phase 3: URL restructure (`/reservoir/*` routes) — on hold; basePath approach needs rethinking since creaseworks still uses subdomain

### Earlier Wave 3 Plan
- Phase 1: Admin playdate preview with pack-based filter toggles
- Phase 2: Profile "your journey" redesign with owned packs + recommendations
- Phase 3: Engagement system sprint 1 (credits foundation) — DB tables ready, queries/UI not started
- Phase 4: Engagement system sprint 2 (photo consent + upsells)

### Matcher Visual Refresh
- The matcher page (`/matcher`) needs to be much less bland and more engaging
- Add photos of materials as visual cues for children playing with the app
- Goal: make the material selection step feel playful and intuitive, not like a plain form

## Session-Start Checklist

1. Read this file + CLAUDE.md for full context
2. Check `creaseworks-review.md` for open items
3. Update Chrome tab IDs in this file if tabs have changed
4. Run `npx tsc --noEmit --project apps/creaseworks/tsconfig.json` to verify baseline
5. At session end: update this file, commit, and push
