# creaseworks — project state

*Machine-readable project status. Update at the end of every session.*

## Quick Reference

| Key | Value |
|-----|-------|
| **App** | Next.js 16 + React 19 + TypeScript |
| **URL** | https://windedvertigo.com/harbour/creaseworks |
| **basePath** | `/harbour/creaseworks` (set in next.config.ts) |
| **Vercel project** | creaseworks (ghandoffs-projects) |
| **Neon DB** | creaseworks-db (divine-dust-87453436) |
| **Branch** | br-green-cherry-air8nyor |
| **Repo path** | `apps/creaseworks/` |
| **Source files** | ~297 (.ts + .tsx) |
| **Migrations** | 043 (latest: stripe_live_prices) — all applied to Neon |
| **TypeScript** | compiles clean (zero errors) |
| **Tests** | 9 suites, 123 tests, all passing |
| **Smoke test** | 28/29 pass (root `/` returns 308 redirect — expected for authed redirect) |
| **Last session** | 49 (Mar 4, 2026) |

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
    ├── email/              # Resend templates (digest, nudge, gallery-approved, invite)
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

### Calm Theme (session 39 — migration 040)
- ✅ `calm_theme BOOLEAN` on users table (migration 040)
- ✅ Low-stimulation dark theme for sensory sensitivity (autism, migraines, ADHD)
- ✅ CSS custom property cascade: remap brand palette on body, re-scope on header/footer
- ✅ Warm dark backgrounds (#1c2536), desaturated accents (#c0786d, #b89480)
- ✅ Theme-aware component tokens: `--cw-text`, `--cw-border`, `--cw-card-bg`, `--cw-toggle-off`
- ✅ Mobile bottom tab bar override (`!important` to beat inline styles)
- ✅ Header/footer re-scoped to stay dark with muted text (#151d2c bg, #b0a898 text)
- ✅ CMS body/rich-text styles cascade automatically via `--wv-cadet` remap
- ✅ Status colours (error/success/warning) muted for calm context
- ✅ Third toggle in accessibility-prefs.tsx: "calm mode" as first option

### Admin Playdate Content Preview (session 40)
- ✅ `lib/queries/playdates.ts` — `getAdminPlaydates()` with boolean completeness flags + `getAdminPlaydateDetail(id)` for lazy content
- ✅ `app/api/admin/playdates/[id]/route.ts` — admin-only detail endpoint with `requireAdmin()`
- ✅ `components/admin/admin-playdate-browser.tsx` — rewritten with expandable content preview, completeness badges, lazy detail caching, materials list, design notes
- ✅ `app/admin/playdates/page.tsx` — uses new `getAdminPlaydates` query

### Visual Bridge: Parent Site ↔ Creaseworks (sessions 41→43)
- ✅ `components/ui/footer.tsx` — rewritten in JSX with logo wordmark on left side, links to parent homepage via `<a href="/">`
- ✅ `public/images/wv-logo.png` — resized wordmark (240×127, 33KB) for 2x retina footer display
- ✅ `packages/tokens/index.css` — `.wv-footer-brand`, `.wv-footer-brand-img` styles, responsive sizing
- ✅ `globals.css` — calm theme dims footer logo with opacity + filter
- ✅ Header shows just "creaseworks" — removed previous "winded.vertigo ›" prefix and mobile cross-app link
- ✅ Removed unused `.wv-header-parent`, `.wv-header-parent-sep`, `.wv-header-crossnav` from tokens CSS

### Profile Page Consolidation (session 44)
- ✅ Removed duplicate StatPills + recent runs from `page.tsx` (Dashboard has richer StatCards + activity feed with badge labels)
- ✅ Removed duplicate pack exploration from `ProfileJourney` (YourPacks has richer per-pack cards with badge distribution)
- ✅ Each data point now has one canonical home: Stats → Dashboard, Activity → Dashboard, Pack progress → YourPacks, Milestones → Journey, Badge counts → Dashboard badge journey
- ✅ 2 files changed, -167 lines, TypeScript clean

### Analytics Dashboard Enrichment (session 45 — Phase 2)
- ✅ Mounted analytics at `/analytics` as proper admin-gated page (was a dead redirect)
- ✅ `getAdminAnalytics()` — 5 SQL query sections: user counts, user growth, pack adoption, credit economy, conversion funnel
- ✅ User growth sparkline (12 months, cumulative signups with window function)
- ✅ Conversion funnel chart (signed up → onboarded → first run → 3+ reflections → purchased) with drop-off %
- ✅ Pack adoption stacked bar (org vs individual entitlements per pack)
- ✅ Credit economy breakdown (earned vs spent, by reason)
- ✅ Platform overview stat cards (total users, active this month, credits earned/redeemed, credit balance)
- ✅ Fixed runtime bug: funnel query referenced non-existent `source` column on entitlements, corrected to `purchase_id IS NOT NULL`
- ✅ 4 files changed: analytics page, dashboard component, API route, analytics queries

### Server-Side Playdate Search (session 45 — Phase 2)
- ✅ `lib/queries/search.ts` — ILIKE search across 4 playdate fields (title, headline, rails_sentence, material title) + collections (title, description)
- ✅ UNION ALL + DISTINCT ON pattern for ranked deduplication (title match > headline > description > material)
- ✅ `GET /api/search?q=...` — authenticated endpoint, min 2 chars, max 100 chars, returns `{ playdates, collections, query }`
- ✅ `playbook-search.tsx` — dual-mode: instant client-side collection filter + debounced (300ms) server-side playdate search
- ✅ AbortController for race condition prevention on rapid typing
- ✅ Playdate results shown above collection grid with cover images, headlines, match-field badges
- ✅ 3 files changed: search queries, API route, playbook search component

### Test Coverage Expansion (session 45 — Phase 2)
- ✅ `entitlements.test.ts` (19 tests) — dual-scope checkEntitlement, grant/revive/revoke flows, early-return when no org/user
- ✅ `credits.test.ts` (20 tests) — balance calculation, insufficient-balance error, streak bonus gating (modulo 7, daily dedup), constants
- ✅ `search.test.ts` (11 tests) — ILIKE pattern wrapping, short-query early-return, combined search parallel execution
- ✅ `auth-helpers-guards.test.ts` (20 tests) — requireAuth/getSession/requireAdmin/requireInternal/requireOrgAdmin redirect logic, isInternal derivation
- ✅ Test suite: 5 → 9 files, 53 → 123 tests (132% increase)

### PWA / Mobile Install (session 46 — Phase 2)
- ✅ `public/manifest.json` — basePath-aware scope + start_url, standalone display, cadet theme
- ✅ `public/sw.js` — cache-first for static assets, network-first for navigation, offline fallback to cached home
- ✅ `src/components/pwa-install.tsx` — captures beforeinstallprompt (Chrome/Edge/Android), shows iOS manual instructions, 14-day dismiss cooldown
- ✅ Icons: 512×512, 192×192, 180×180 apple-touch-icon from square "W" mark (`wv-icon-square.png`)
- ✅ CSP updated: `worker-src 'self'` added
- ✅ Layout metadata: manifest link, apple-web-app-capable, theme-color
- ✅ Wired into Providers → renders on all pages

### In-App Notification Center (session 47 — Phase 2)
- ✅ Migration 041: `in_app_notifications` table with partial indexes (unread, dedup by user+event_type+href)
- ✅ Query layer: getUserNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead, createInAppNotification (with ON CONFLICT dedup), purgeOldNotifications
- ✅ Types: `NotificationEventType` union — gallery_approved, gallery_rejected, invite_accepted, pack_granted, progress_milestone, co_play_invite, org_joined, system
- ✅ API routes: `GET /api/notifications/in-app` (list + countOnly polling), `POST` (mark-all-read), `POST /in-app/[id]/read` (mark single)
- ✅ `NotificationBell` component: bell icon with badge, 60s unread-count polling, dropdown with emoji icons per event type, time-ago timestamps, mark-read on click
- ✅ Wired into nav-bar.tsx (desktop + mobile dropdown) between authed links and auth action
- ✅ Emitters: gallery approve/reject (`gallery.ts`), invite acceptance + pack grants (`invites.ts`), org auto-join (`organisations.ts`)
- ✅ CSS: dropdown with slide-in animation, responsive (full-width on mobile), unread dot indicator, brand-consistent colors

### Progressive Disclosure / User Tiers (sessions 47–48 — Phase 3, migration 042)
- ✅ Migration 042: `ui_tier TEXT NOT NULL DEFAULT 'casual'` on users with CHECK constraint; backfills existing onboarded users to `collaborator`
- ✅ `getUserTier()` / `updateUserTier()` in `lib/queries/accessibility.ts`
- ✅ JWT pipeline: `uiTier` loaded on initial sign-in + 5-minute refresh, flows through to `CWSession`
- ✅ Cookie-first rendering: `cw-ui-tier` cookie → `tier-{value}` CSS class on `<html>` before hydration (same pattern as calm-theme)
- ✅ Onboarding wizard: tier selection as Step 0 with 3 visual cards ("just play", "play + learn", "play + grow")
- ✅ Nav bar: tier-aware link filtering — casual (sampler, matcher, packs, gallery), curious (+playbook), collaborator (+reflections, community)
- ✅ Mobile bottom tabs: adapts to tier (4 tabs casual, 5 curious, 5 collaborator with different set)
- ✅ Profile page: tier-aware section gating (Journey/credits hidden for non-collaborator), tier badge with distinct colors per tier
- ✅ `tier-switcher.tsx` — profile manage section, 3-option radio cards, optimistic UI + CSS class swap + session refresh
- ✅ Gallery share gating: `gallery-share-toggle.tsx` returns null for non-collaborator, API route returns 403 safety net
- ✅ `/api/preferences` PATCH accepts `uiTier`, sets `cw-ui-tier` cookie
- ✅ `/api/onboarding` POST accepts `tier` field, saves to DB + sets cookie
- ✅ 14 files changed (12 modified + 2 new), TypeScript clean, 123 tests passing

### Stripe Price Update + Purchase Notifications (session 49)
- ✅ 5 new Stripe products + prices created (Classroom Starter, New Baby Sibling, Rainy Day Rescue, Summer Play Camp, The Whole Collection)
- ✅ Migration 043: updated `packs_catalogue.stripe_price_id` for all 5 active packs — applied to Neon
- ✅ Webhook handler: `createInAppNotification()` after `grantEntitlement()` — queries pack title, creates `pack_granted` notification (non-fatal try/catch)
- ✅ Co-Design Essentials pack confirmed stale — excluded from updates

### Pilot Email Invites with Bulk Entry (session 49)
- ✅ `lib/email/send-invite.ts` — invite email template via Resend (brand-styled, pack list, personal note, CTA to /login)
- ✅ `api/admin/invites/route.ts` — accepts `emails[]` array (backward-compat with `email` string), looks up pack names, loops createInviteWithPacks + sendInviteEmail, returns per-email results
- ✅ `admin/invites/invite-form.tsx` — textarea for bulk email entry (comma/semicolon/newline parser), count display, dynamic "send N invites" button
- ✅ CMS env vars set in Vercel: `NOTION_CMS_PAGE_WE`, `NOTION_CMS_PAGE_DO` (P2-6 complete)

### Open Questions Resolved (session 43)
- Q1: next/image migration — DEFERRED (document cost implications for budgeting)
- Q2: R2 bucket — DECIDED: one bucket, folder convention (`/creaseworks/`, `/sqr-rct/`, `/site/`)
- Q3: subdomain redirect — SKIPPED (not enough users with old URL)
- Q4: shared header template — NOT WORTH IT (needs differ too much between apps)

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
| 040 | calm-theme | `calm_theme BOOLEAN` on users — low-stimulation dark theme |
| 041 | in-app-notifications | `in_app_notifications` table — event_type, title, body, href, actor_id, read_at. partial indexes for unread + dedup |
| 042 | user-tiers | `ui_tier TEXT NOT NULL DEFAULT 'casual'` on users — progressive disclosure. CHECK constraint (casual/curious/collaborator). backfill existing onboarded users to collaborator |
| 043 | stripe-live-prices | Update `packs_catalogue.stripe_price_id` for 5 active packs to new Stripe price IDs (session 49) |

## Stripe Price IDs (Session 49 — Updated)

| Pack | Pack UUID | Stripe Price ID | Amount |
|------|-----------|-----------------|--------|
| classroom starter | `91753e91-54eb-43ad-a9ab-e4fdc015ae08` | `price_1T7Cr3D50swbC2DgZ1821EuG` | $4.99 |
| new baby sibling | `36f5e2d2-39f8-4fa5-8419-8435a19f5023` | `price_1T7Cr6D50swbC2DgLYnzdlh5` | $4.99 |
| rainy day rescue | `9419aa6d-7fc2-4699-a78d-cbf8547c0fee` | `price_1T7Cr8D50swbC2DgDfJdCjWz` | $4.99 |
| summer play camp | `03eaa0b6-c4fa-4fb2-b16e-69970e4f9910` | `price_1T7Cr9D50swbC2Dg5loVo2nU` | $4.99 |
| the whole collection | `9f5e9e28-4ab9-4553-8697-88eb80656a91` | `price_1T7CrAD50swbC2Dg1omLIHV9` | $14.99 |
| co-design essentials (stale) | `b535a022-90c0-4e14-b92b-54a43e7aac76` | `price_1T5bqmD50swbC2DgkKdiEHwH` | $49.99 |

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
