# creaseworks — Project Status

**Last updated**: 2026-02-22 (session 14)
**Monorepo**: `ghandoff/windedvertigo` → `apps/creaseworks/`
**Live**: `creaseworks.windedvertigo.com`
**Stack**: Next.js 16.1.6, React 19.2.3, Neon Postgres, Stripe, Auth.js, Resend, Vercel

## Current state: Launch-ready

All audit-1 and audit-2 findings resolved. 20 automated tests passing. CI pipeline active. Monorepo migration complete.

## Monorepo structure

```
ghandoff/windedvertigo (single source of truth)
├── apps/
│   ├── creaseworks/     ← this app
│   ├── nordic-sqr-rct/  ← Nordic SQR RCT app
│   └── site/            ← windedvertigo.com marketing site
├── scripts/             ← Notion sync scripts (fetch-notion.js, etc.)
├── .github/workflows/   ← CI + Notion sync workflows
└── package.json         ← workspace root
```

**Vercel**: Each app has its own Vercel project with Root Directory set (e.g. `apps/creaseworks`).
**Old repos**: `ghandoff/creaseworks`, `ghandoff/windedvertigo-site`, `ghandoff/nordic-sqr-rct` — all archived on GitHub. Local duplicates deleted.

## Session history

| Session | Summary |
|---------|---------|
| 1–10 | Core platform build (patterns, materials, packs, entitlements, matcher, runs, auth, orgs) |
| 11 | Run export (CSV + PDF), visibility model, N+1 fixes |
| 12 | Audit-1: 14 findings, all fixed. Added vitest suite (20 tests). CI pipeline. |
| 13 | Monorepo consolidation: merged site + creaseworks + nordic-sqr-rct into windedvertigo. Reconnected all 3 Vercel projects. Added NOTION_API_KEY secret. |
| 14 | Audit-2: 9 findings (3 HIGH, 5 MEDIUM, 2 LOW), all fixed in commit c5bf915. Archived old GitHub repos. Deleted local duplicate folders (~1.5 GB freed). Tested Notion sync workflow — passing. Started audit-1 deferred items. |

## Completed features (sessions 1–12)

### Core platform
- **Pattern catalogue** with Notion sync, sampler pages, PDF generation
- **Materials database** synced from Notion, do-not-use filtering
- **Pack system** with pricing, purchase flow, Stripe checkout
- **Entitlements** with soft-revoke, expiry, admin management
- **Pattern matcher** with scoring algorithm, form/material/context filtering, substitution suggestions
- **Runs system** — log runs, link patterns + materials, visibility model, N+1 fixed
- **Run export** — CSV + branded PDF with summary section

### Auth & organisations
- Google OAuth + Resend magic links via Auth.js
- Auto-join org by verified email domain
- Self-service domain verification with 24-hour token expiry
- Team management (members, roles, admin protection)
- JWT session with 5-minute org/role refresh

### Infrastructure
- Postgres-backed rate limiter (sliding window, in-memory fallback)
- Notion sync: GitHub Actions cron (daily 6 AM UTC) + webhook incremental
- Notion sync workflow tested and passing — fetches Outcomes, Vault, Portfolio, Package Builder
- Stripe webhook handler with idempotency
- GitHub Actions CI (TypeScript + ESLint + vitest)
- Comprehensive security headers in next.config.ts
- Access audit logging with structured metadata

## Audit summary

### Audit 1 (session 12) — 14 findings, all fixed
All critical/high/medium items resolved. See git history for details.

### Audit 2 (session 14) — 9 findings, all fixed (commit c5bf915)
- H1: PATCH /api/runs/[id] input validation
- H2: Admin routes try/catch on req.json()
- H3: incremental.ts upsertRun missing source column
- M1: Analytics SQL interpolation safety comments
- M2: PDF export 500-row limit
- M3: handlePageDeletion explicit switch for table names
- M4: send-verification.ts operator precedence fix
- M5: Added vitest to CI workflow
- L1: Notion webhook rejects verification when secret already set
- L2: Renamed runMigrations() to runInitialSchema()

### Deferred from audit 1 — COMPLETED (session 14)
- [x] CSRF protection — Origin header validation via Next.js middleware on all `/api/*` routes (webhooks exempt)
- [x] Google Fonts via `next/font/google` — Inter loaded at build time, removed external `<link>` tags, tightened CSP
- [x] NextAuth upgrade — already at latest beta (5.0.0-beta.30); no stable v5 released yet
- [x] Integration test coverage — 33 new tests across 3 files (middleware, visibility, auth-helpers)
- [x] Fixed TS error: export route `truncated` boolean → number for audit metadata type

## Database migrations

| # | Description | Status |
|---|-------------|--------|
| 001 | Initial schema (users, patterns, materials, packs, entitlements, audit) | Applied |
| 002 | App-created runs columns (created_by, org_id) | Applied |
| 003 | Stripe fields on organisations | Applied |
| 004 | Accounts table for OAuth providers | Applied |
| 005 | Relax ip_tier NOT NULL on patterns_cache | Applied |
| 006 | Index on runs_cache.run_date | Applied |
| 007 | Rate limits table + window_start index | Applied |
| 008 | Domain verification token expiry | Applied |
| 009 | Source column on runs_cache + backfill | Applied |
| 010 | Missing indexes (created_by, org_id, stripe_session_id) | Applied |
| 011 | Verification token table (moved from runtime) | Applied |

## Test coverage

- **Framework**: vitest 4.0.18
- **Tests**: 53 passing across 5 test files
  - `validation.test.ts` (14) — input validation helpers
  - `scoring.test.ts` (6) — matcher scoring formula
  - `middleware.test.ts` (13) — CSRF Origin validation
  - `visibility.test.ts` (14) — reflective field stripping, key whitelisting, pagination
  - `auth-helpers.test.ts` (6) — isInternalEmail domain check
- **Run**: `npm run test` or `npm run test:watch`
- **CI**: Tests run automatically on push via GitHub Actions
- **Remaining coverage gaps**: Stripe webhook handler (requires signature mocking), full DB integration tests

## Architecture notes

### Data flow
```
Notion databases → sync cron → *_cache tables → API routes → React pages
                                     ↑
                              app-created runs (source='app')
```

### Notion sync pipeline
```
GitHub Actions (daily cron / manual / push to scripts/)
  → node scripts/fetch-notion.js (uses NOTION_API_KEY secret)
  → writes JSON to apps/site/data/ + images to apps/site/images/vertigo-vault/
  → auto-commits if changed
```

### Visibility model (runs)
- **Admin**: sees all runs across all orgs
- **Org member (internal)**: sees all runs for their org
- **External user**: sees only runs they created
- **Reflective fields** (what_changed, next_iteration): stripped for non-creators/non-internal

### Key patterns
- **Three-tier column selector**: controls which pattern fields are visible at sampler/pack-only/entitled tiers
- **Parameterised queries throughout** — no SQL injection vectors
- **Audit logging**: every entitled content access, run CRUD, export, domain verification
- **Source column on runs_cache**: `'notion'` for synced, `'app'` for user-created; sync DELETE scoped to `source='notion'`

## Known technical debt

### Future considerations
- Redis for matcher cache if pattern count grows past ~500
- Separate `runs` table if the source column approach proves limiting
- Rate limit the matcher endpoint specifically (currently uses global limits)
- Add email format validation (RFC 5322) to domain verification
- Fix `response.buffer()` deprecation warning in fetch-notion.js (use `response.arrayBuffer()`)
