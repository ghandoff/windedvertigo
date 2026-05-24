---
name: port-health
description: >
  Full health battery for port.windedvertigo.com — smoke test, security audit,
  Supabase table check, and 5-stage load/stress tests. Run whenever you want to
  verify the app is healthy after a deploy or a big merge. Works for everyone on
  the WindedVertigo team (Garrett, Maria, Payton, Lamis).
---

# Port health battery

Runs a complete health check on the live port app. Covers routes, security headers,
database connectivity, and load behaviour — all in one pass.

## What gets tested

| Stage | Script / tool | What it checks |
|-------|--------------|----------------|
| TypeScript | `npx tsc --noEmit` | No type errors in `port/` |
| Smoke test | `port/scripts/smoke-test.mjs` | 26 routes return correct HTTP status |
| Security audit | `port/scripts/security-audit.mjs` | 6 headers on `/login` + `/api/version` |
| Supabase health | `port/scripts/smoke-supabase.mjs` | 5 tables have rows; revenue_tier tagged |
| Load — stage 1 | autocannon | Warm-up: c=1, 30 requests |
| Load — stage 2 | autocannon | Sustained SSR: c=10, 10s on `/login` |
| Load — stage 3 | autocannon | Edge API: c=50, 10s on `/api/version` |
| Load — stage 4 | autocannon | 100-connection burst on `/api/version` |
| Load — stage 5 | autocannon | Stress ceiling: c=100, 10s on `/` |

---

## Steps

### 1. Confirm we are in the repo root

```bash
pwd  # should be .../windedvertigo
```

If not, `cd` to the windedvertigo repo root before continuing.

### 2. TypeScript check

```bash
cd port && npx tsc --noEmit && echo "TS: clean" && cd ..
```

If this fails, report the errors. Do **not** proceed to the smoke test until TypeScript is clean
(a type error signals something in the build is broken).

### 3. Smoke test — 26 routes

```bash
node port/scripts/smoke-test.mjs
```

Expected: `26/26 passed`. If any route fails, show the failing line(s) with the expected vs actual
status code. Common false-alarm: if you see 308 failures on `/deals` or `/work/studios`, those are
**correct** — canonical redirects are 308 by design. Re-check the expectations table in the script
rather than marking them as failures.

### 4. Security header audit

```bash
node port/scripts/security-audit.mjs
```

🔴 = critical gap (act immediately).
🟡 = recommended but not blocking a deploy.

Report exactly which headers are missing and on which URL.

### 5. Supabase health check

> ⚠️ This script reads `.env.local` inside `port/`. Run it from the repo root so the path resolves correctly:

```bash
cd port && node scripts/smoke-supabase.mjs && cd ..
```

Expected: 5 tables with rows + at least 1 deal with `revenue_tier` set.

If `deals.revenue_tier: 0 deals tagged` — that's a 🟡 warning, not a hard failure. It means the
revenue pipeline hasn't been seeded. The deals table itself should still have rows.

### 6. Load tests (requires npx autocannon)

Run stages in order. Each stage is a separate call.

**Stage 1 — warm-up (c=1, n=30)**

```bash
npx autocannon -c 1 -a 30 https://port.windedvertigo.com/api/version
```

Look for: 0 errors, p99 < 500ms.

**Stage 2 — sustained SSR (c=10, d=10s)**

```bash
npx autocannon -c 10 -d 10 https://port.windedvertigo.com/login
```

Look for: > 100 req/sec, 0 errors (non2xx shows 3xx redirects which are fine here — the login
page itself returns 200, so non2xx should be 0 on this URL).

**Stage 3 — edge API (c=50, d=10s)**

```bash
npx autocannon -c 50 -d 10 https://port.windedvertigo.com/api/version
```

Look for: > 500 req/sec, p99 < 200ms.

**Stage 4 — 100-connection burst (n=100)**

```bash
npx autocannon -c 100 -a 100 https://port.windedvertigo.com/api/version
```

Look for: all 100 responses received, 0 errors.

**Stage 5 — stress ceiling (c=100, d=10s)**

```bash
npx autocannon -c 100 -d 10 https://port.windedvertigo.com/
```

`/` returns 307 (auth redirect), so autocannon counts these as non2xx. That is expected and
correct — it means auth is working. Look for: throughput > 1,000 req/sec, 0 `errors` (vs non2xx
which counts redirects). Report p99 latency.

---

## Reporting format

After all stages complete, summarise in this format:

```
── port health battery ──────────────────────────────────

TypeScript     ✅  clean
Smoke          ✅  26/26 passed  (min Xms · avg Xms · max Xms)
Security       ✅  all headers present
Supabase       ✅  5 tables healthy · N deal(s) tagged

Load (c=1)     ✅  Xrps · p99 Xms · 0 errors
Load (c=10)    ✅  Xrps · p99 Xms · 0 errors
Load (c=50)    ✅  Xrps · p99 Xms · 0 errors
Burst 100      ✅  100/100 responses · 0 errors
Stress (c=100) ✅  Xrps · p99 Xms · 0 errors

Overall: HEALTHY ✅
─────────────────────────────────────────────────────────
```

Replace ✅ with ❌ for failures and append a short note. Replace HEALTHY with DEGRADED or FAILING
as appropriate.

---

## Notes for team members

- **No credentials required** — all tests hit the public-facing edge. The auth-protected routes
  correctly return 307/401 without a session, and that's what we're testing.
- **autocannon not installed?** `npm install -g autocannon` once per machine, then it's available
  via `npx autocannon` anywhere.
- **`.env.local` required for Supabase** — the Supabase health check reads `port/.env.local`. If
  you don't have it locally, skip step 5 and note it in the report. The smoke + security +
  load tests all work without it.
- **Target URL override** — all scripts respect `BASE=https://...` env var if you want to test
  a preview deployment instead of production.

---

## When to run this

- **After every production deploy** — catch regressions before users do
- **Before merging a large PR** — run against a preview URL (`BASE=https://preview-url.pages.dev`)
- **After rotating secrets or changing Cloudflare Workers config** — verify auth still works
- **When someone reports the app is slow** — stages 2–5 give quick baseline numbers
