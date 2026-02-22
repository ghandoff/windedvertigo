# creaseworks — Project Status

**Last updated**: 2026-02-22
**Repo**: `ghandoff/creaseworks` (private)
**Live**: `creaseworks.windedvertigo.com`
**Stack**: Next.js 16.1.6, React 19.2.3, Neon Postgres, Stripe, Auth.js, Resend, Vercel

## Current state: Launch-ready

All critical and high-priority audit items resolved. 20 automated tests passing. CI pipeline active.

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
- Notion sync cron (daily + webhook incremental)
- Stripe webhook handler with idempotency
- GitHub Actions CI (TypeScript + ESLint)
- Comprehensive security headers in next.config.ts
- Access audit logging with structured metadata

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
- **Tests**: 20 passing (validation helpers + matcher scoring)
- **Run**: `npm run test` or `npm run test:watch`
- **Coverage gaps**: API routes (need integration tests), visibility model, Stripe webhook handler

## Architecture notes

### Data flow
```
Notion databases → sync cron → *_cache tables → API routes → React pages
                                     ↑
                              app-created runs (source='app')
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

### Low priority (deferred)
- CSRF tokens on custom routes (mitigated by JWT + CSP)
- Google Fonts via `<link>` instead of `next/font/google`
- NextAuth still on beta (5.0.0-beta.30) — upgrade when stable released
- Integration test coverage for API routes and webhook handlers
- Consider `next/font/google` for Inter to eliminate render-blocking 3rd-party request

### Future considerations
- Redis for matcher cache if pattern count grows past ~500
- Separate `runs` table if the source column approach proves limiting
- Rate limit the matcher endpoint specifically (currently uses global limits)
- Add email format validation (RFC 5322) to domain verification
