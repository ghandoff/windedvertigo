# creaseworks — project state

*Machine-readable project status. Update at the end of every session.*

## Quick Reference

| Key | Value |
|-----|-------|
| **App** | Next.js 16 + React 19 + TypeScript |
| **URL** | https://windedvertigo.com/reservoir/creaseworks |
| **basePath** | `/reservoir/creaseworks` (set in next.config.ts) |
| **Vercel project** | creaseworks (ghandoffs-projects) |
| **Neon DB** | creaseworks-db (divine-dust-87453436) |
| **Branch** | br-green-cherry-air8nyor |
| **Repo path** | `apps/creaseworks/` |
| **Source files** | ~235 (.ts + .tsx) |
| **Migrations** | 039 (latest: accessibility_prefs) — 001-039 applied to Neon |
| **TypeScript** | compiles clean (zero errors) |
| **Smoke test** | 28/29 pass (root `/` returns 308 redirect — expected for authed redirect) |
| **Last session** | 38 (Mar 1, 2026) |

## Notion Database IDs

| Database | ID | Data Source ID |
|----------|----|----------------|
| **Collections** | `312e4ee7-4ba4-8139-b891-fcd21e275a21` | `312e4ee7-4ba4-81a7-9635-000b05e82f4e` |
| **Packs** | `beb34e7b-86cd-4f20-b9be-641431b99e5f` | — |
| **Playdates** | `b446ffd5d1664a31b4f5f6a93aadaab8` | `0a90f5dc-a264-48ff-a49f-fabb07667116` |
| **Materials** | `a6b32bc6-e021-41a4-b6f4-3d528e814d71` | `2bb1cd66-b20d-4b21-8816-1feba57f187a` |

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
    │   ├── credits.ts      # Credit system (awardCredit, getUserCredits, spendCredits, checkAndAwardStreakBonus)
    │   ├── gallery.ts      # Community gallery (10 functions)
    │   ├── co-play.ts      # Co-play queries
    │   ├── seasonal.ts     # Seasonal recommendations
    │   └── ...             # collections, evidence, entitlements, invites, etc.
    ├── seasonal.ts         # Season detection + tag mapping
    ├── security/           # Column selectors, entitlement checks
    ├── sync/               # Notion → Neon sync handlers (6 handlers + blocks.ts + generic utility)
    └── validation.ts       # parseJsonBody<T>() shared helper
```

## Feature Status

All core features A–Y are implemented. See `docs/creaseworks-backlog-2026-02-28.md` for the remaining backlog.

### Engagement System (fully wired — verified session 35)
- ✅ `lib/queries/credits.ts` — awardCredit, getUserCredits, spendCredits, checkAndAwardStreakBonus
- ✅ `components/credit-progress-bar.tsx` — server component on playbook page
- ✅ `components/credit-redemption.tsx` — redemption UI on playbook page
- ✅ `components/pack-upsell-section.tsx` — shows up to 2 unowned packs
- ✅ `components/photo-consent-classifier.tsx` — 3-tier COPPA consent flow in evidence-capture-section
- ✅ `components/ui/run-form/run-form.tsx` — post-reflection pack upsell CTA
- ✅ `components/ui/quick-log-button.tsx` — expandable photo nudge toast
- ✅ `components/ui/photo-quick-log-button.tsx` — camera-first quick reflection
- ✅ Credit earning wired: quick_log (1), find_again (2), photo_added (2), marketing_consent (3), streak_bonus (5)
- ✅ Photo consent wired into evidence capture flow
- ✅ Credit redemption UI on playbook page (sampler_pdf=10, single_playdate=25, full_pack=50)

### Dual-Scope Entitlements (session 37 — migration 038)
- ✅ `entitlements.user_id` — nullable, with CHECK constraint (org_id OR user_id must be set)
- ✅ Partial unique indexes: `idx_entitlements_org_pack` (org-level), `idx_entitlements_user_pack` (user-level)
- ✅ `checkEntitlement(orgId, packCacheId, userId)` — checks both org-level and user-level
- ✅ `grantUserEntitlement(userId, packCacheId)` — creates user-scoped entitlement
- ✅ `invite_packs` table — links invites to specific packs
- ✅ `createInviteWithPacks()`, `getInvitePacks()`, `processInvitesOnSignIn()` — full invite lifecycle
- ✅ `organisations.member_cap` — limits domain auto-join (NULL = unlimited)
- ✅ `autoJoinOrg` respects member_cap before INSERT
- ✅ Admin invite form with pack selector UI at `/admin/invites`
- ✅ Profile manage section shows invite link for admins

### Accessibility Preferences (session 38 — migration 039)
- ✅ `reduce_motion` + `dyslexia_font` columns on users table
- ✅ `lib/queries/accessibility.ts` — getAccessibilityPrefs, updateAccessibilityPrefs
- ✅ `app/api/preferences/route.ts` — GET + PATCH with cookie-setting for instant CSS
- ✅ `app/profile/accessibility-prefs.tsx` — client component with toggle switches
- ✅ Cookie-first architecture: root layout reads cookies, applies `.reduce-motion` and `.dyslexia-font` CSS classes to `<html>` before React hydrates
- ✅ Atkinson Hyperlegible loaded via `next/font/google` with `--font-atkinson` CSS variable
- ✅ `.reduce-motion` CSS kills all animations/transitions via `!important`
- ✅ `.dyslexia-font` CSS switches body, input, textarea, select, button to Atkinson Hyperlegible
- ✅ `components/ui/step-progress.tsx` — shared step progress indicator with ARIA progressbar

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
| 036 | rich-content | body_html on playdates/collections/packs, find/fold/unfold_html, illustration columns, cms_pages table |
| 037 | material-emoji | `emoji TEXT` on materials_cache — CMS-managed emojis from Notion |
| 038 | user-entitlements | `user_id` on entitlements (dual-scope), `invite_packs` table, `member_cap` on organisations |
| 039 | accessibility-prefs | `reduce_motion`, `dyslexia_font` BOOLEAN columns on users |

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

## Content Status
- 30 playdates (5 sampler, 3 campaign, 22 internal-only)
- 12 collections (original 6 + story builders, nature detectives, color lab, body movers, quiet makers, fix-it shop)
- 6 packs (co-design essentials, rainy day rescue, classroom starter, summer play camp, the whole collection, new baby sibling)

## Session-Start Checklist

1. Read this file + `docs/CLAUDE.md` for full context
2. Check `docs/creaseworks-backlog-2026-02-28.md` for current backlog
3. Run `npx tsc --noEmit --project apps/creaseworks/tsconfig.json` to verify baseline
4. At session end: update this file, commit, and push
