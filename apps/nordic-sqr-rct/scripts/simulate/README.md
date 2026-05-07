# Path-2 production smoke test suite

End-to-end correctness + load simulations for the Nordic Research Platform.
Run these against production (or any Vercel preview) to validate the
Postgres mirror, the Notion fallback path, and the team-experience
under realistic concurrent load.

## Setup

For tests that write data or assert authed responses, you need a session
cookie from a logged-in browser:

1. Open `https://nordic.windedvertigo.com/pcs` in your browser, log in
2. DevTools → Application → Cookies → copy the session cookie's full value
3. Export it: `export COOKIE='<value>'`

For local script-only tests (write-mirror), you need `.env.local` populated
with `NOTION_TOKEN`, `SUPABASE_NORDIC_URL`, `SUPABASE_NORDIC_SECRET_KEY`
(already set if Path-2 Day 1 was completed).

## Tests

### `test-read-paths.mjs` — read-path smoke

Asserts every Postgres-backed `/api/pcs/*` route returns the right shape +
row count, and admin observability endpoint works.

```bash
COOKIE='...' node scripts/simulate/test-read-paths.mjs
# Or anonymous (every route returns 401 — useful for measuring auth-rejection latency):
node scripts/simulate/test-read-paths.mjs
```

### `test-write-mirror.mjs` — Phase A write-mirror correctness

Creates a SIMULATE-prefixed test row in Evidence Library, verifies the
Postgres mirror caught up within 1 second, edits the row + verifies the
mirror reflects the new lastEditedTime, then archives the test row.

```bash
node --env-file=.env.local scripts/simulate/test-write-mirror.mjs
```

This bypasses HTTP — calls the lib helpers directly with service-role
Postgres. Use it to validate the mirror logic in isolation.

### `simulate-team-session.mjs` — multi-actor concurrency simulation

The centerpiece — models 3-6 Nordic researchers (Sharon, Gina, Adin,
Lauren + 2 others) doing realistic work concurrently for 60 seconds.
Reports per-actor + per-route latency profiles.

```bash
COOKIE='...' node scripts/simulate/simulate-team-session.mjs

# Or stress-test with more actors / longer duration:
COOKIE='...' DURATION_S=300 ACTORS=12 node scripts/simulate/simulate-team-session.mjs
```

What it proves:
- Concurrent reads serve from Postgres without contention
- Vercel function pool handles the burst pattern
- Postgres mirror under load doesn't degrade
- Auth + capability gating work correctly under concurrency

### `test-cf-worker.mjs` — Phase C CF Worker comparison

Compares the read-only Cloudflare Worker proof-of-concept
(`wv-nordic-pcs.windedvertigo.workers.dev`) against the Vercel deploy.
Confirms both stacks see the same Postgres data + reports CF timing
profile.

```bash
node scripts/simulate/test-cf-worker.mjs
COOKIE='...' node scripts/simulate/test-cf-worker.mjs   # for Vercel side-by-side
```

## What's NOT here yet (worth adding when needed)

- **Drift-injection test** — make a Notion-side edit, wait 3 min, verify
  the drift cron caught it. Belongs as `test-drift-cron.mjs`.
- **Full-stack end-to-end browser test** — log in via Playwright, click
  through the article-search → save flow, confirm UI states. Belongs
  outside this directory (use Playwright's own runner).
- **Phase B retry-queue stress test** — once `PCS_STRONG_CONSISTENCY=1`
  is on, simulate Postgres outages + verify the queue drains correctly.

## Running everything

There's no orchestrator script (yet). Run them in order:

```bash
COOKIE='...' node scripts/simulate/test-read-paths.mjs && \
node --env-file=.env.local scripts/simulate/test-write-mirror.mjs && \
COOKIE='...' node scripts/simulate/simulate-team-session.mjs && \
node scripts/simulate/test-cf-worker.mjs
```

Total runtime: ~3 minutes including the 60s team simulation.
