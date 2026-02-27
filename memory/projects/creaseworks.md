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
| **Migrations** | 027 (latest: campaigns) |
| **Latest commit** | session 30 (pending push) |
| **Last session** | 30 (Feb 27, 2026) |

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

## Session-Start Checklist

1. Read this file + CLAUDE.md for full context
2. Check `creaseworks-review.md` for open items
3. Update Chrome tab IDs in this file if tabs have changed
4. Run `npx tsc --noEmit --project apps/creaseworks/tsconfig.json` to verify baseline
5. At session end: update this file, commit, and push
