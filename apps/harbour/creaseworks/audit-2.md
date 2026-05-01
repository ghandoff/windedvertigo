# creaseworks — Audit 2

> **STATUS: RESOLVED** — All 9 findings from this audit have been addressed. See `docs/creaseworks-backlog-2026-02-28.md` for current issues.

**Date:** 2026-02-22
**Scope:** Full codebase review — security, performance, reliability, infrastructure
**Previous audit:** Session 12 (14 findings, all fixed)

---

## Executive Summary

The session 12 audit fixes are all solid and properly implemented. This second pass found **9 new findings** — nothing critical, mostly hardening and future-proofing. The codebase is in good shape for an MVP product.

---

## Findings

### HIGH

#### H1 — PATCH /api/runs/[id] has no input validation

**File:** `src/app/api/runs/[id]/route.ts:56`
**Issue:** The POST route on `/api/runs` has length checks and array sanitisation, but the PATCH route passes `body` directly to `updateRun()` without any validation. An attacker can send megabyte-sized strings in `whatChanged`, `nextIteration`, or inject arbitrary keys into the update.
**Risk:** Bypasses all the audit fix #6 validation on the create path.
**Fix:** Apply the same `checkLength` / `sanitiseStringArray` validation before calling `updateRun()`. Also whitelist allowed keys to prevent arbitrary field injection.

#### H2 — Admin routes missing try/catch on `req.json()`

**Files:** `src/app/api/admin/admins/route.ts:29,55`, `src/app/api/admin/domains/route.ts:31,50,75`, `src/app/api/admin/entitlements/route.ts:19,68`
**Issue:** Multiple admin POST/DELETE routes call `await req.json()` without a try/catch. If the request body is malformed JSON, the route throws an unhandled exception and returns a 500 with a stack trace instead of a clean 400.
**Risk:** Inconsistent error handling; minor info leak from stack traces in dev mode.
**Fix:** Wrap all `req.json()` calls in try/catch, matching the pattern already used in `/api/runs/route.ts` and `/api/team/domains/route.ts`.

#### H3 — `incremental.ts` upsertRun missing `source` column

**File:** `src/lib/sync/incremental.ts:358-382`
**Issue:** The incremental webhook sync `upsertRun()` function doesn't include the `source` column in its INSERT. The batch sync in `runs.ts` correctly sets `source = 'notion'`, but the incremental path relies on the column's `DEFAULT 'notion'` which is correct — **however**, the INSERT also doesn't include `created_by` or `org_id`, meaning webhook-synced runs will have NULL `created_by` and `org_id`, which is intentional for Notion-sourced runs.
**Real issue:** The ON CONFLICT UPDATE clause doesn't protect against an edge case where an app-created run's `notion_id` collides with a Notion page ID (unlikely but possible since app runs use `app:<uuid>` prefixed IDs). More importantly, the column should be explicitly set for clarity.
**Fix:** Add `source` to the INSERT column list in `upsertRun()` with value `'notion'` for explicitness and parity with the batch sync.

### MEDIUM

#### M1 — Analytics queries vulnerable to SQL injection via string interpolation

**File:** `src/lib/queries/analytics.ts:95-196`
**Issue:** The `visibilityClause()` function returns a `where` string that gets interpolated directly into SQL queries via template literals: `` `SELECT ... WHERE ${vis.where}` ``. While the `where` strings are all hardcoded (never from user input), this pattern is fragile — a future edit that introduces user input into the clause would create a SQL injection.
**Risk:** Low today, but the pattern is an anti-pattern that could become dangerous.
**Fix:** Refactor to use parameterised query builders or at minimum add a `// SAFETY: vis.where is always a hardcoded string, never user input` comment on every usage.

#### M2 — PDF export unbounded — no limit on export size

**File:** `src/app/api/runs/export/route.ts:33`
**Issue:** `getRunsForExport()` has no pagination or row limit. An admin account with thousands of runs would generate a massive PDF in memory, potentially hitting Vercel's memory limit or timing out.
**Risk:** OOM on Vercel serverless functions (1024MB default, 10s timeout on hobby, 60s on pro).
**Fix:** Add a `LIMIT 500` (or configurable) to the export query, and return a warning header if truncated. Or switch to streaming CSV for large exports.

#### M3 — `handlePageDeletion` uses string interpolation for table name

**File:** `src/lib/sync/incremental.ts:113`
**Issue:** `` await sql.query(`DELETE FROM ${table} WHERE notion_id = $1`, [normalised]) `` — the `table` variable comes from a hardcoded map, but this pattern bypasses parameterised queries. If the map were ever modified to include user input, it would be a SQL injection.
**Risk:** Low today (map values are hardcoded), but same anti-pattern as M1.
**Fix:** Use an explicit switch statement with literal SQL strings instead of dynamic table name interpolation.

#### M4 — `send-verification.ts` base URL logic has operator precedence bug

**File:** `src/lib/email/send-verification.ts:32-35`
**Issue:** The expression `process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? \`https://...\` : "http://localhost:3000"` has a precedence issue. JavaScript's `||` has lower precedence than `?`, so this evaluates as `NEXTAUTH_URL || (VERCEL_URL ? ... : ...)`. If `NEXTAUTH_URL` is set, it's used correctly. If `NEXTAUTH_URL` is unset and `VERCEL_URL` is set, the ternary works. But if both are unset, it falls back correctly. **However**, if `NEXTAUTH_URL` is set to an empty string `""`, it falls through to the ternary unexpectedly.
**Risk:** Unlikely to manifest in practice since env vars are either set or undefined, but the logic reads confusingly.
**Fix:** Use explicit checks: `const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? \`https://\${process.env.VERCEL_URL}\` : "http://localhost:3000");` — actually this IS what the code does due to precedence. But wrap in parens for readability.

#### M5 — CI workflow doesn't run tests

**File:** `.github/workflows/ci.yml`
**Issue:** The CI workflow runs `tsc --noEmit` and `npm run lint` but not `npm run test`. The vitest suite (20 tests) was added in session 12 but never wired into CI.
**Fix:** Add `npm run test` as a step after lint.

### LOW

#### L1 — Notion webhook verification token endpoint echoes token back

**File:** `src/app/api/webhooks/notion/route.ts:80-83`
**Issue:** When Notion sends the initial verification token, the handler returns `{ ok: true }` without logging the token. This is fine, but the handler also doesn't validate the token against `NOTION_WEBHOOK_SECRET`. If the secret is already set, a rogue request with a fake `verification_token` would get a 200 (though it couldn't change the stored secret since that's in env vars).
**Risk:** Negligible — the verification handshake only happens during initial setup.
**Fix:** Optional: reject verification requests when `NOTION_WEBHOOK_SECRET` is already set.

#### L2 — `db.ts` `runMigrations()` only runs migration 001

**File:** `src/lib/db.ts:12`
**Issue:** The `runMigrations()` helper only reads `001_initial_schema.sql`. There are now 11 migrations. This function appears to be a setup helper, not used in production (Vercel deploys don't call it), but it's misleading.
**Fix:** Either remove it (if unused), update it to run all migrations in order, or rename to `runInitialSchema()` to clarify its purpose.

---

## What's Working Well

- **Three-tier column selector model** — `column-selectors.ts` + `assertNoLeakedFields()` is an excellent pattern. Zero chance of accidentally leaking entitled/internal fields at the teaser tier.
- **Visibility model consistency** — The same visibility logic (admin → org → self) is applied consistently across runs list, single run, export, and analytics.
- **Idempotency** — Stripe webhook handler correctly checks `getPurchaseByStripeSessionId()` before creating duplicates.
- **Rate limiting fallback** — Postgres-backed with in-memory fallback is exactly right for serverless.
- **CSP headers** — Properly restrictive, allows only necessary Stripe and Google Fonts origins.
- **JWT refresh** — 5-minute refresh window with graceful degradation is well implemented.
- **Batch queries** — N+1 elimination on runs materials, entitlement checks, and pack slugs.
- **Input validation** — `MAX_LENGTHS` + `checkLength` + `sanitiseStringArray` on the create path.
- **Webhook signature verification** — Both Stripe and Notion webhooks properly verify signatures with timing-safe comparison for Notion.

---

## Deferred from Audit 1 (still outstanding)

These were documented as low-priority in the first audit and remain deferred:

- **CSRF protection** on custom form-submission routes (low risk with JWT + SameSite cookies)
- **Google Fonts via next/font/google** instead of external stylesheet (minor perf)
- **NextAuth upgrade** from beta.30 to stable (when available)
- **Integration test coverage** (currently only unit tests)

---

## Recommended Priority

1. **H1** — PATCH validation gap (quick fix, directly mirrors existing POST validation)
2. **H2** — Admin try/catch (mechanical, 10 minutes)
3. **M5** — Add tests to CI (one line in ci.yml)
4. **H3** — Add `source` column to incremental upsertRun
5. **M2** — Export size limit
6. **M1/M3** — SQL interpolation comments or refactor (optional hardening)
7. **M4** — Operator precedence clarification (cosmetic)
8. **L1/L2** — Low-priority cleanup
