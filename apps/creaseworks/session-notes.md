# Session 12 Notes — Audit & Hardening

**Date**: 2026-02-21 / 2026-02-22
**Focus**: Full-app audit, security hardening, performance fixes, test infrastructure

## What was done

### Pre-audit features completed
- **Run export/reporting** — CSV + PDF export via `/api/runs/export?format=csv|pdf`, branded PDF with summary + detail sections, watermarked, audit-logged. New files: `src/app/api/runs/export/route.ts`, `src/app/runs/export-button.tsx`.
- **Persistent rate limiter** — Replaced in-memory token bucket with Postgres-backed sliding window counter in `src/lib/rate-limit.ts`. Fire-and-forget prune, in-memory fallback if DB unavailable. Migration 007.

### Audit findings & fixes

**Critical (fixed)**
1. `.env.example` — completed with missing Stripe/Google vars
2. Stripe API version — removed hardcoded version, SDK uses its built-in default
3. GitHub Actions CI — `tsc --noEmit` + `npm run lint` on push/PR to main
4. Domain verification token expiry — 24-hour TTL via `token_expires_at` column (migration 008)

**High (fixed)**
5. `runs_cache` source column — added explicit `source TEXT` column (`'notion'`/`'app'`) so the sync DELETE only targets Notion rows. Migration 009.
6. Input length validation — new `src/lib/validation.ts` with `MAX_LENGTHS`, `checkLength()`, `sanitiseStringArray()`. Applied to runs POST and domain verification POST.
7. JWT session refresh — jwt callback now re-checks org membership + admin status every 5 minutes instead of only at sign-in. Stale permissions resolved within 5 min.
8. Test suite — vitest installed, `vitest.config.ts` created, 20 tests covering validation helpers and matcher scoring formula. `npm run test` script added.

**Medium (fixed)**
9. N+1 query — added `batchGetRunMaterials()` using `ANY($1::uuid[])` single query. Applied to runs page and API route. 51 queries → 2 for 50 runs.
10. Matcher caching — in-memory TTL cache (5 min) on `getCandidateRows()`. Invalidated after Notion sync. Exported `invalidateCandidateCache()`.
11. Missing indexes — `idx_runs_cache_created_by`, `idx_runs_cache_org_id`, `idx_purchases_stripe_session_id`. Migration 010.
12. `ensureVerificationTokenTable()` — moved to migration 011, removed cold-start DB query from auth.ts.
13. `error.tsx` background — added `backgroundColor: "#273248"` so cream text is visible regardless of parent CSS.
14. Audit log `fields_accessed` — `logAccess()` now accepts optional `metadata` param for structured key-value data. Callers updated to use `[]` for fields and `{ count, domain }` for metadata.

## Migrations applied

| # | File | Description |
|---|------|-------------|
| 007 | `007_rate_limits_table.sql` | rate_limits table + window_start index |
| 008 | `008_domain_token_expiry.sql` | token_expires_at column on verified_domains |
| 009 | `009_runs_source_column.sql` | source column on runs_cache + backfill |
| 010 | `010_missing_indexes.sql` | created_by, org_id, stripe_session_id indexes |
| 011 | `011_verification_token_table.sql` | verification_token table (was runtime-created) |

## Key decisions

- **5-minute JWT refresh window**: Balance between freshness and DB load. Every request within the window uses the cached token; after 5 min, one request triggers a refresh. If DB fails, stale token is kept rather than breaking the session.
- **In-memory matcher cache vs Redis**: Chose in-memory with 5-min TTL because the pattern catalogue is small (<100 patterns) and the sync runs at most hourly. Redis would add infrastructure for minimal benefit at current scale.
- **`source` column vs separate table**: Added a column rather than splitting into a separate `runs` table because the visibility queries, export, and analytics all treat both data sources uniformly. A column preserves the single-table simplicity while making the data model explicit.
- **vitest over jest**: vitest is faster, works with ESM out of the box, and has better TypeScript support. No special Next.js integration needed since we're testing pure logic functions.

## Remaining audit items (not addressed)

These were classified as Low priority and deferred:

15. **CSRF protection** on custom POST/PATCH/DELETE routes — mitigated by JWT auth + CSP `form-action 'self'`
16. **Export audit log metadata** — improved in fix #14 but export entries still have null patternId/packId (by design)
17. **Google Fonts `<link>`** — consider `next/font/google` or self-hosting Inter
18. **PDF watermark encoding** — `\u00b7` renders fine in PDFs, git diff display issue only
19. **`.env.local` in mount** — operational awareness, not a code fix

## Files changed

### New files
- `src/lib/validation.ts` — input validation helpers
- `src/lib/validation.test.ts` — 14 validation tests
- `src/lib/scoring.test.ts` — 6 matcher scoring tests
- `vitest.config.ts` — vitest configuration
- `migrations/009_runs_source_column.sql`
- `migrations/010_missing_indexes.sql`
- `migrations/011_verification_token_table.sql`

### Modified files
- `src/lib/sync/runs.ts` — source column in insert, scope DELETE to source='notion'
- `src/lib/queries/runs.ts` — source='app' in createRun, batchGetRunMaterials()
- `src/lib/queries/matcher.ts` — in-memory candidate cache with TTL
- `src/lib/queries/audit.ts` — metadata parameter on logAccess()
- `src/lib/sync/index.ts` — invalidate matcher cache after sync
- `src/lib/auth.ts` — JWT 5-min refresh, removed cold-start table creation
- `src/app/api/runs/route.ts` — input validation, batch materials, error message sanitisation
- `src/app/api/runs/export/route.ts` — structured audit metadata
- `src/app/api/team/domains/route.ts` — length validation, structured audit metadata
- `src/app/runs/page.tsx` — batch materials instead of N+1
- `src/app/error.tsx` — explicit background colour
- `package.json` — vitest deps, test scripts
