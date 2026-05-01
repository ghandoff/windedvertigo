# wv-launch-smoke

scheduled cloudflare worker — runs the harbour smoke harness every 30 minutes and posts a slack digest when anything goes red. mirrors `harbour-apps/scripts/launch-smoke.mjs` so a human can re-run the same check on demand.

## what this is

39 production targets across site, harbour hub, 24 nested harbour apps, 5 auth surfaces, port + ops origins, and the admin sync-tiles bearer-gated endpoint. each gets 3 retries with 10s backoff before going red.

on red, the worker posts a one-line summary + per-target reasons to a slack incoming webhook (URL set as `WV_CLAW_WEBHOOK` secret). green runs are silently recorded in KV.

## pre-deploy

1. **create the kv namespace** (run from this directory):
   ```
   wrangler kv namespace create SMOKE_LATEST
   ```
   copy the returned `id` and paste it into `wrangler.jsonc`, replacing `REPLACE_AT_DEPLOY_TIME`.

2. **create a slack incoming webhook** in the workspace where wv-claw lives (slack admin → apps → incoming webhooks → add to channel). copy the URL.

3. **set the webhook secret**:
   ```
   wrangler secret put WV_CLAW_WEBHOOK
   ```
   paste the URL when prompted.

## deploy

```
wrangler deploy
```

## verify

- **cron registration:**
  ```
  wrangler triggers --name wv-launch-smoke
  ```
- **fetch latest summary:**
  ```
  curl https://wv-launch-smoke.windedvertigo.workers.dev/
  ```
  returns 503 with `{"error":"no smoke run yet"}` until the first scheduled run completes (≤30 min after deploy).
- **manual fire**: open `wrangler tail --name wv-launch-smoke` in one terminal, then trigger the cron from the cloudflare dashboard's "trigger run" button on the worker page.

## what posts to slack

only red runs trigger a slack digest. green runs are silently recorded in KV. the digest format:

```
:rotating_light: harbour smoke — 38/39 green, 1 red, 0 slow (2026-04-26T03:00:00.000Z)
• harbour/three-intelligence-workbook 404 — expected 200|301|302|307|308|401|403, got 404
```

## webhook format

standard slack incoming webhook URL: `https://hooks.slack.com/services/T<workspace>/B<webhook>/<token>`. payload is `{ "text": "..." }`. no fancy blocks — keeps the worker portable to any slack-compatible JSON sink.

## rollback

```
wrangler delete --name wv-launch-smoke
```

removes the worker, the cron, and the binding. the kv namespace itself persists; delete with `wrangler kv namespace delete --namespace-id <id>` if needed.

## cost

48 invocations/day × ~20s wall-clock × 39 outbound `fetch`. fits inside the cloudflare free tier (100k requests/day; outbound `fetch` doesn't count against worker CPU).

## relationship to `scripts/launch-smoke.mjs`

the cli script (`harbour-apps/scripts/launch-smoke.mjs`) and this worker share the same evaluation logic via `apps/launch-smoke/src/probes.ts`. pull-request authors run the cli locally; production runs the worker. both should reach identical green/red verdicts on the same target.

scope differences:
- the cli has `--target=<substr>`, `--slow-only`, `--json` flags. the worker always runs the full set.
- the cli has a `PENDING_DEPLOY_NOTES` map that downgrades known-pending reds. the worker keeps strict semantics (a red is a red) — wrangler-blocked items still page, which is the right behaviour for production monitoring.

## tests

```
npm run typecheck
npm run test
```

unit tests cover `evaluate()`'s decision matrix. the worker handler itself (`scheduled` + `fetch`) is thin glue and not unit-tested; integration coverage comes from a post-deploy curl + cf dashboard "trigger run".
