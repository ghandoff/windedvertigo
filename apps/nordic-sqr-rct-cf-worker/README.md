# wv-nordic-pcs-worker

Phase C scaffolding for the eventual **Vercel → Cloudflare Workers**
migration of the Nordic Research Platform.

## What this is

A Cloudflare Worker that connects to the same `wv-nordic` Supabase
project as the Vercel app at `apps/nordic-sqr-rct/`, exposing a tiny
read-only proof-of-concept surface so we can validate the
supabase-from-CF-Workers path before committing to a full port.

## Current scope

- **Phase C (now)**: read-only PoC. Not in production rotation. The
  Vercel app at `apps/nordic-sqr-rct/` remains canonical.
- **Phase D (next)**: full port via OpenNext, DNS cutover, auth
  parity with the Vercel app's `requireCapability` pattern.

## Endpoints

| Path | Description |
| --- | --- |
| `GET /health` | Liveness check. Doesn't hit DB. Reports whether Supabase env is wired. |
| `GET /health/db` | Pings Supabase (`select count` on `pcs_evidence`). Returns `{ ok, count, ms }`. |
| `GET /api/pcs/evidence` | Read-only list of PCS evidence rows; same shape as the Vercel route. |
| `GET /api/pcs/claims` | Read-only list of PCS claims rows; same shape as the Vercel route. |

No auth in Phase C. Don't put this in front of sensitive data until
Phase D wires auth.

## Deploy

```bash
cd apps/nordic-sqr-rct-cf-worker
pnpm install        # or: npm install
wrangler deploy
```

The first deploy lands on the workers.dev subdomain — no custom
domain is configured (Phase D adds the route).

## Required Wrangler secrets

Set these once before the first deploy:

```bash
wrangler secret put SUPABASE_NORDIC_URL
wrangler secret put SUPABASE_NORDIC_SECRET_KEY
```

Use the same values the Vercel app uses (`vercel env pull` then copy
the matching keys).

## Verify after deploy

```bash
curl https://wv-nordic-pcs.<account>.workers.dev/health
# -> { "ok": true, "ts": "...", "env": { "supabase": true } }

curl https://wv-nordic-pcs.<account>.workers.dev/health/db
# -> { "ok": true, "count": <n>, "ms": <n> }

curl https://wv-nordic-pcs.<account>.workers.dev/api/pcs/evidence | jq '.count'
curl https://wv-nordic-pcs.<account>.workers.dev/api/pcs/claims | jq '.count'
```

## Local development

```bash
wrangler dev
```

Wrangler will prompt for the secrets on first run if they aren't
defined locally. You can also drop a `.dev.vars` file with
`SUPABASE_NORDIC_URL=...` / `SUPABASE_NORDIC_SECRET_KEY=...` (do
**not** commit it).

## Validate config without deploying

```bash
wrangler deploy --dry-run
pnpm lint            # tsc --noEmit
```

## Notes for Phase D onboarding

- `parseEvidenceRow` and `parseClaimRow` in `src/index.ts` are
  copy-pastes of the Vercel app's `parsePostgresRow` (in
  `apps/nordic-sqr-rct/src/lib/pcs-evidence.js` and `pcs-claims.js`).
  Phase C keeps the two copies separate on purpose — this worker
  isn't in the pnpm workspace yet, and we want to evolve the CF
  surface without coupling. Phase D consolidates.
- This app is **not** in the pnpm workspace; it has its own
  `package.json` and `node_modules`. Phase D folds it in.
- DNS / custom routes are commented out in `wrangler.jsonc`. Phase
  D uncomments and points DNS away from Vercel.
