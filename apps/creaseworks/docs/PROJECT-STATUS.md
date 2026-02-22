# creaseworks — project status

last updated: 2026-02-21 (session 11 — proxy migration, promo codes, free trials)

---

## what creaseworks is

A co-design pattern platform for winded vertigo. Organisations purchase "packs" of co-design patterns and get access to the full facilitation scripts (find, fold, unfold), materials guidance, and a transfer-learning feature called "find again." The platform also includes a public sampler, a materials-based pattern matcher, run logging for evidence capture, and an analytics dashboard.

**stack**: Next.js 14 App Router, TypeScript, Tailwind CSS, Vercel (hobby), Neon Postgres, Notion as editorial CMS, Auth.js v5, Stripe Checkout, Resend for email.

**repo**: `ghandoff/creaseworks` (private), main branch. live at `creaseworks.windedvertigo.com`.

---

## phase 1: core MVPs — ALL COMPLETE ✓

### MVP 0: scaffold, DB, sampler

- Next.js App Router + TypeScript + Tailwind CSS + ESLint
- Neon Postgres schema (all tables from DESIGN.md section 3)
- Notion sync cron job (`/api/cron/sync-notion`) with normalise-on-ingest
- `/sampler` page showing teaser-tier patterns from Postgres cache
- `vercel.json` with cron configuration (daily at 06:00 UTC)
- Brand theming: Inter font, w.v colour palette, lowercase UI convention
- Domain blocklist seed data
- Deployed to `creaseworks.windedvertigo.com`

### MVP 1: auth + org model

- Auth.js with Email provider (magic link via Resend)
- Google OAuth provider added (session 4)
- User creation on first login
- Organisation + verified domain tables
- Domain blocklist check
- Auto-join org membership based on verified email domain
- `accounts` table + migration 004 for OAuth provider linking

### MVP 2: entitlements + watermarking

- `/packs` catalogue page
- `/packs/[slug]` with entitlement check
- `/packs/[slug]/patterns/[patternSlug]` with ip-tier-gated content
- Find again teaser on sampler cards + pack purchase page CTA
- `entitlements` table fully wired
- Stub purchase flow (admin grants via `/admin/entitlements`)
- Access audit logging
- `assertNoLeakedFields` security utility (`src/lib/security/assert-no-leaked-fields.ts`) — active in dev/staging, no-op in production
- Wired into `patterns.ts` and `packs.ts` query functions
- **Watermarked PDF card generation** (`src/app/api/patterns/[patternId]/pdf/route.ts`)
  - Uses `pdf-lib` with org name, user email, pack name, dd/mm/yyyy date watermark
  - Download button component on entitled pattern views

### MVP 3: matcher

- `/matcher` page with input form (materials picker grouped by form, forms checklist, slots toggles, context filters)
- `POST /api/matcher` with hard context filter + scoring algorithm
- Scoring: materials (0–45) + forms (0–30) + slots (0–10) + quick-start (0–10) − friction (0–5)
- Result cards with score badges, coverage details, substitution suggestions
- Find again teaser on results (links to pack page for non-entitled users)
- Entitlement-aware: entitled users see author substitution notes + find again mode
- Audit logging for authenticated searches

### MVP 4: admin + rate limiting

- `/admin/domains` — domain blocklist CRUD (add, toggle, delete, view)
- `/admin/admins` — admin allowlist CRUD (add by email, remove, last-admin protection)
- `/admin/entitlements` — grant entitlements (org + pack selector)
- `/admin/entitlements` — **revoke entitlements** (soft delete via revoked_at, DELETE endpoint, confirmation dialog)
- `/admin/sync` — manual Notion sync trigger
- Admin middleware: `requireAdmin()` checks `admin_allowlist` table
- Rate limiting: 60/min authenticated, 20/min anonymous, token-bucket per IP in middleware
- All admin actions logged to `access_audit_logs`

### MVP 5: runs + evidence

- `/runs` page (list runs with visibility model: admin sees all, org member sees org, others see own)
- `/runs/new` — create run form (title, type, date, pattern link, context tags, trace evidence, materials, what changed, next iteration)
- `GET/POST /api/runs` + `GET/PATCH /api/runs/[id]`
- Run types: internal practice, webinar, delivery, BD/prospect, R&D
- Trace evidence: photo, video, quote, artifact, notes
- Materials linking via `run_materials` junction table
- Creator-only edit restriction
- Lightweight UX: required fields minimal, optional section collapsible
- Internal vs external visibility enforced: `what_changed` and `next_iteration` hidden from external users on other people's runs (both UI and API)

---

## phase 2: post-MVP features — ALL COMPLETE ✓

### Stripe Checkout integration

- `migrations/003_stripe_fields.sql` (stripe_customer_id on orgs, stripe_session_id + stripe_payment_intent_id on purchases)
- `src/lib/stripe/client.ts` (singleton Stripe SDK)
- `src/lib/stripe/checkout.ts` (createCheckoutSession, getOrCreateStripeCustomer)
- `src/lib/queries/purchases.ts` (createPurchase, getPurchaseByStripeSessionId)
- `POST /api/checkout` (auth-protected, creates Stripe Checkout Session)
- `POST /api/stripe/webhook` (signature-verified, handles checkout.session.completed)
- `src/components/ui/purchase-button.tsx` ("get this pack — $XX")
- `src/app/checkout/success/page.tsx` (success page after payment)
- Pack detail page shows PurchaseButton when not entitled, patterns list when entitled
- Verified end-to-end: purchase → Stripe webhook → purchase record → entitlement → entitled view

### Notion webhook integration

- `POST /api/webhooks/notion` with HMAC-SHA256 signature verification
- Incremental sync: `syncSinglePage()` in `src/lib/sync/incremental.ts`
- Handles page.properties_updated, page.created, page.updated, page.content_updated, page.deleted, page.archived, page.trashed
- Content type detection from webhook payload (patterns, materials, packs, runs)
- Verified end-to-end: Notion edit → webhook POST 200 → data synced to Neon

### Google OAuth SSO

- Auth.js Google provider configured
- Google Cloud OAuth 2.0 credentials set up
- Accounts table for OAuth provider linking
- Name sync from Google profile on first sign-in

### Team management UI

- `/team` page showing org members
- Promote/demote roles (admin ↔ member)
- Remove members with confirmation
- Admin-only controls (regular members see read-only list)
- `PATCH/DELETE /api/team/members`

### Run analytics dashboard

- `/analytics` page with comprehensive dashboard
- Total runs, monthly delta, run type breakdown
- Most-used patterns and materials rankings
- Evidence captured breakdown, context tags breakdown
- Sparkline chart for runs over time
- `GET /api/analytics/runs`

### Internal vs external visibility on runs

- `isInternal` flag on session (admin OR windedvertigo.com domain)
- `isInternalEmail()` helper in `auth-helpers.ts`
- `run-list.tsx` conditionally renders `what_changed` / `next_iteration` only for internal users or run creator
- API routes (`/api/runs` GET, `/api/runs/[id]` GET) strip reflective fields server-side for external users
- Defence in depth: both UI and API enforce the visibility rule

### Admin landing page

- `/admin` root with card grid linking to entitlements, domains, admins, sync, analytics, team
- Protected by `requireAdmin()` — redirects non-admins to home

---

## phase 3: security audit — 16/18 FIXED, ALL PUSHED ✓

Full pre-launch audit performed on 76 TypeScript files, 4 SQL migrations, and all config. 18 findings total: 2 critical, 4 high, 7 medium, 5 low.

### fixed (16/18)

| ID | severity | finding | fix |
|----|----------|---------|-----|
| **C1** | critical | Webhook signature bypass — dev mode skipped verification | Added `NODE_ENV === 'development'` guard; production throws if secret unset |
| **C2** | critical | No security headers | Added X-Frame-Options, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy to `next.config.ts` |
| **H2** | high | Sync pipeline lacks transactions | Wrapped all upsert functions in BEGIN/COMMIT/ROLLBACK |
| **H3** | high | `ip_tier` NOT NULL constraint | Migration 005: ALTER TABLE DROP NOT NULL |
| **H4** | high | `email_verified` always TRUE | Default FALSE in `createUser()`, verify on successful sign-in callback |
| **M1** | medium | Audit log IP capture — all routes pass `null` | **FIXED ✓** — added `x-forwarded-for` extraction to all 13 `logAccess` call sites. Pushed to GitHub (session 10). |
| **M3** | medium | No pagination on `/api/runs` | **FIXED ✓** — added `limit`/`offset` params (default 50, max 100). Pushed to GitHub (session 10). |
| **M4** | medium | Missing index on `runs_cache.run_date` | Migration 006 + index created on Neon |
| **M5** | medium | Cron comment says "hourly" but schedule is daily | Fixed comments in 3 files |
| **M6** | medium | No `error.tsx` or `not-found.tsx` | Added branded error boundary and 404 page |
| **M7** | medium | `(session as any)` casts everywhere | Added `next-auth.d.ts` module augmentation, removed all `as any` casts |
| **L1** | low | Stripe payment_method_types hardcoded to card | Removed; Stripe auto-detects |
| **L3** | low | NavBar has no admin link | Added conditional admin link |
| **L4** | low | No `loading.tsx` Suspense boundaries | Added `skeleton.tsx` component + loading.tsx to 5 routes |

### deferred (2/18) — not bugs, just decisions

| ID | severity | finding | status |
|----|----------|---------|--------|
| **H1** | high | Stripe API version needs manual verification | **Deferred** — config check against Stripe dashboard, no code change needed. Do this before going live with real payments. |
| **M2** | medium | Rate limiter resets on Vercel cold start | **Deferred** — replace in-memory Map with Vercel KV or Upstash Redis. Current rate limiter works but resets when the serverless function cold-starts. Low risk at current traffic levels. |

### acknowledged (2/18) — monitoring items

| ID | severity | finding | status |
|----|----------|---------|--------|
| **L2** | low | next-auth beta version | **Monitor** — Auth.js v5 is still beta. Watch for stable release and upgrade when available. |
| **L5** | low | `assertNoLeakedFields` is no-op in production | **Decision needed** — consider keeping active in production (with error reporting instead of throwing) or adding a CI lint step. Currently safe because column selectors prevent leaks at the query level. |

---

## phase 4: what still needs to happen

### must-do before launch

| item | effort | notes |
|------|--------|-------|
| ~~**Push M1 + M3 fixes to GitHub**~~ | ~~30 min~~ | ~~DONE (session 10) — 15 files committed via GitHub web editor~~ |
| **H1: Verify Stripe API version** | 5 min | Log into Stripe dashboard → check API version matches `'2025-02-24.acacia'` in code |
| **Stripe live mode keys** | 10 min | Switch from `sk_test_` to `sk_live_` in Vercel env vars when ready for real payments |
| **Register Stripe webhook (live)** | 5 min | Currently only test webhook registered. Add production webhook URL in Stripe dashboard |
| **Domain verification email flow** | — | The `verified_domains` table exists and auto-join works, but the actual verification email sending flow is admin-seeded, not self-service. OK for launch if you're onboarding orgs manually. |

### nice-to-have improvements

| item | effort | notes |
|------|--------|-------|
| **M2: Persistent rate limiter** | 2–3 hrs | Replace in-memory Map with Vercel KV or Upstash Redis. Prevents rate limit reset on cold start. Low priority at current traffic. |
| **L5: Production leak detection** | 1 hr | Wire `assertNoLeakedFields` to an error reporting service (Sentry, etc.) instead of throwing. Or add a CI lint step. |
| **Mobile-optimised matcher** | 4–6 hrs | Touch-friendly material picker, collapsible sections, mobile result cards. Current Tailwind responsive classes work but aren't mobile-first. |
| **SAML + Microsoft Entra SSO** | 8–12 hrs | Enterprise auth. Only needed if institutional customers require it. Google OAuth covers most use cases. |
| **Multi-zone gateway** | 4–6 hrs | `treefort.windedvertigo.com` proxy/rewrite config. Only needed if building additional apps under the winded vertigo umbrella. |
| **Self-service domain verification** | 4–6 hrs | Email-based flow where org admins can verify their own domain. Currently admin-seeded. |
| **Run export / reporting** | 3–4 hrs | CSV or PDF export of runs data for organisations to use externally. |
| **Pattern versioning** | 6–8 hrs | Track changes to patterns over time via Notion's `last_edited_time`. Show version history. |

---

## session 11 changes

### middleware → proxy migration (Next.js 16)
- Renamed `src/middleware.ts` → `src/proxy.ts`
- Renamed exported function `middleware()` → `proxy()`
- Proxy runs on Node.js runtime (not Edge) — removes the constraint that kept us using lightweight `getToken` instead of full `auth()`
- Fixed mojibake characters (garbled em-dashes from earlier GitHub web editor sessions)
- Updated npm dependencies: eslint 10, resolved all 15 audit vulnerabilities (all were dev-only eslint transitive deps)

### Stripe promo codes
- Added `allow_promotion_codes: true` to checkout session in `src/lib/stripe/checkout.ts`
- Enables Stripe-hosted coupon code UI on the checkout page
- Create coupon codes (e.g. LAUNCH40, FRIEND20) in the Stripe dashboard — no code changes needed

### free trial entitlements
- `src/lib/queries/entitlements.ts` — `grantEntitlement()` now accepts optional `expiresAt` parameter
- `src/app/api/admin/entitlements/route.ts` — POST accepts optional `trialDays` in body (e.g. `{ orgId, packCacheId, trialDays: 14 }`)
- `src/app/admin/entitlements/grant-form.tsx` — added trial days input field with expiry date in success message
- `checkEntitlement()` already respected `expires_at` — no changes needed there

### documentation updates
- Added creaseworks mount instructions to windedvertigo-site `CLAUDE.md` (auto-loaded every session)
- Updated `docs/SESSION-NOTES.md` with mount path and updated environment constraints
- Added appendix 0 (local dev paths) to `docs/DESIGN.md`
- Created pack offerings & pricing spec in Notion (business model decisions pending colleague discussion)

---

## infrastructure reference

| service | details |
|---------|---------|
| Hosting | Vercel (hobby tier), `creaseworks.windedvertigo.com` |
| Database | Neon Postgres, project `divine-dust-87453436`, branch `br-green-cherry-air8nyor` |
| Notion | Integration ID `9e21c81c-a7de-410c-85ad-cc839b50cc4c`, 4 databases (patterns, materials, packs, runs) |
| Stripe | Test mode, `winded.vertigo LLC sandbox` account |
| Auth | Auth.js v5 (beta.30), JWT strategy, Resend magic links + Google OAuth |
| Email | Resend, sending from `noreply@windedvertigo.com` |
| Repo | `ghandoff/creaseworks` (private), main branch |

---

## GitHub repo sync — COMPLETE ✓

All local files verified against `ghandoff/creaseworks` main branch. 21 files audited:

- 18 already matched GitHub (pushed in prior sessions)
- 1 pushed fresh (`login/page.tsx` — searchParams Promise type update)
- 1 fixed (`auth.ts` — was corrupted on GitHub with line numbers only; replaced with correct source, commit `f4a0f21`)
- 1 verified equivalent (`incremental.ts` — 10-byte whitespace diff, functionally identical)

All Vercel deployments green. Live site verified at `creaseworks.windedvertigo.com`.

---

## M1 + M3 push log (session 10)

All 15 files committed to `main` via GitHub web editor. Vercel auto-deploys on each commit.

**M3 (pagination) — 2 files:**
- `src/lib/queries/runs.ts` — `getRunsForUser()` now accepts `limit`/`offset` params
- `src/app/api/runs/route.ts` — GET handler parses pagination, response includes `pagination` object

**M1 (IP capture) — 11 API routes:**
- `src/app/api/runs/route.ts` — POST handler
- `src/app/api/runs/[id]/route.ts` — PATCH handler
- `src/app/api/checkout/route.ts` — POST handler
- `src/app/api/matcher/route.ts` — POST handler (inside session check)
- `src/app/api/patterns/[patternId]/pdf/route.ts` — GET handler
- `src/app/api/admin/entitlements/route.ts` — POST + DELETE handlers
- `src/app/api/admin/admins/route.ts` — POST + DELETE handlers
- `src/app/api/admin/domains/route.ts` — POST + PATCH + DELETE handlers
- `src/app/api/admin/sync/route.ts` — POST handler (also added `req: NextRequest`)
- `src/app/api/stripe/webhook/route.ts` — comment clarification (webhook has no client IP)

**M1 (IP capture) — 2 server components:**
- `src/app/packs/[slug]/page.tsx` — added `headers()` import + IP extraction
- `src/app/packs/[slug]/patterns/[patternSlug]/page.tsx` — added `headers()` import + IP extraction
