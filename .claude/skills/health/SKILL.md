---
name: health
description: >
  Full health battery for any WindedVertigo project — the port, harbour apps,
  games (lines, loops, etc.), or any future app. Auto-detects the project from
  conversation context, finds the live URL, runs available test scripts, and
  falls back gracefully when project-specific scripts don't exist. Use when
  anyone says "check health", "run the battery", "is everything working",
  "health check", "stress test this", or just "health".
---

# App health battery

Runs a complete health check on a WindedVertigo project. Adapts to the project
in context — uses dedicated scripts when available, falls back to generic checks
when not.

---

## Step 0 — Identify the project

Determine which project to test from conversation context. If unclear, ask once:
> "Which project should I run the health check on? (e.g. port, harbour, lines, loops)"

Once confirmed, identify:
- **`PROJECT_DIR`** — the subdirectory in the monorepo (e.g. `port/`, `apps/harbour/`, `games/lines/`)
- **`LIVE_URL`** — the production URL. Find it in this order:
  1. The user said it in conversation
  2. `wrangler.toml` → `route` or `[env.production] route`
  3. `package.json` → `homepage` or the deploy script
  4. The project's `CLAUDE.md` → look for the live URL
  5. Ask the user

---

## Step 1 — TypeScript / build check

```bash
cd <PROJECT_DIR> && npx tsc --noEmit && echo "TS: clean"
```

If the project doesn't use TypeScript, skip and note it.

If this fails: **stop and report the errors**. A broken build means the other
stages are testing stale or broken code — don't continue until TS is clean.

---

## Step 2 — Smoke test (route / endpoint check)

**If a smoke script exists** (look for `scripts/smoke-test.mjs`, `scripts/smoke.mjs`,
`scripts/smoke-test.sh`, or similar in `PROJECT_DIR`), run it:

```bash
node <PROJECT_DIR>/scripts/smoke-test.mjs
```

**If no smoke script exists**, synthesise a minimal one using `fetch` with
`redirect: "manual"`. At minimum check:
- The app's root URL (`/`) — expect either 200 or a redirect
- A known public endpoint (e.g. `/api/version`, `/api/health`, or `/api/status`)
- One known protected route — expect 307/401 (confirms auth is working)

Report each route: status code, latency, pass/fail.

---

## Step 3 — Security header audit

**If an audit script exists** (look for `scripts/security-audit.mjs` or similar):

```bash
node <PROJECT_DIR>/scripts/security-audit.mjs
```

**If no script exists**, check these six headers directly using `fetch` on the
app's login or root URL:

| Header | Expected | Severity |
|--------|----------|----------|
| `x-frame-options` | `DENY` or `SAMEORIGIN` | 🔴 critical |
| `x-content-type-options` | `nosniff` | 🔴 critical |
| `strict-transport-security` | `max-age=\d+` | 🔴 critical |
| `referrer-policy` | any value | 🟡 recommended |
| `content-security-policy` | any value | 🟡 recommended |
| `permissions-policy` | any value | 🟡 recommended |

Report each: ✅ present / 🔴 missing critical / 🟡 missing recommended.

---

## Step 4 — Persistence / database health

**Supabase** (check for `scripts/smoke-supabase.mjs` or `SUPABASE_URL` in `.env.local`):

```bash
cd <PROJECT_DIR> && node scripts/smoke-supabase.mjs
```

> ⚠️ This reads `.env.local` — skip and note if the user doesn't have it locally.

**Cloudflare D1** (if the project uses D1): run a simple count query via wrangler:

```bash
npx wrangler d1 execute <DB_NAME> --command "SELECT COUNT(*) FROM sqlite_master WHERE type='table'"
```

**No database**: note it and move on.

---

## Step 5 — Load tests

Run all five stages against `LIVE_URL`. Requires `npx autocannon` (install once:
`npm install -g autocannon`).

**Stage 1 — warm-up (c=1, n=30)**
```bash
npx autocannon -c 1 -a 30 <LIVE_URL>/api/version
```
*Or substitute the app's lightest public endpoint if `/api/version` doesn't exist.*

**Stage 2 — sustained rendering (c=10, d=10s)**
```bash
npx autocannon -c 10 -d 10 <LIVE_URL>/login
```
*Or the app's main entry page.*

**Stage 3 — edge/API (c=50, d=10s)**
```bash
npx autocannon -c 50 -d 10 <LIVE_URL>/api/version
```

**Stage 4 — 100-connection burst (n=100)**
```bash
npx autocannon -c 100 -a 100 <LIVE_URL>/api/version
```

**Stage 5 — stress ceiling (c=100, d=10s)**
```bash
npx autocannon -c 100 -d 10 <LIVE_URL>/
```

> **Note on non2xx**: autocannon counts 3xx redirects as non2xx. If `LIVE_URL/`
> redirects to a login page (expected for private apps), the non2xx count will be
> high — that's correct. Report `errors` (connection failures), not `non2xx`.

---

## Step 6 — Report

Produce a summary in this format:

```
── health: <project name> ─────────────────────────

TypeScript     ✅  clean  (or ⏭️  skipped — no TS)
Smoke          ✅  N/N passed  (min Xms · avg Xms · max Xms)
Security       ✅  all headers present  (or 🔴 N critical / 🟡 N recommended)
Database       ✅  <table counts>  (or ⏭️  skipped — no .env.local)

Load (c=1)     ✅  Xrps · p99 Xms · 0 errors
Load (c=10)    ✅  Xrps · p99 Xms · 0 errors
Load (c=50)    ✅  Xrps · p99 Xms · 0 errors
Burst 100      ✅  100/100 responses · 0 errors
Stress (c=100) ✅  Xrps · p99 Xms · 0 errors

Overall: HEALTHY ✅
─────────────────────────────────────────────────────
```

Replace ✅ with ❌ for failures. Overall verdict:
- **HEALTHY** — all critical checks pass
- **DEGRADED** — non-critical warnings only (🟡 headers, optional DB offline)
- **FAILING** — any 🔴 or TS error or load errors

---

## Project-specific fast paths

These projects have dedicated scripts — use them instead of the generic fallbacks:

### port (`port/`)
Live URL: `https://port.windedvertigo.com`

```bash
# Smoke (26 routes)
node port/scripts/smoke-test.mjs

# Security headers
node port/scripts/security-audit.mjs

# Supabase tables + revenue_tier coverage
cd port && node scripts/smoke-supabase.mjs && cd ..
```

---

## Tips for adding a new project

When a new project gets its own scripts, add a section above under
"Project-specific fast paths" with the live URL and script paths. Until then,
the generic fallback protocol handles it fine — the skill adapts.
