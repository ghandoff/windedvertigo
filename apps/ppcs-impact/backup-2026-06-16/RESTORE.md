# wv-ppcs-impact — full live backup (captured 2026-06-16)

Complete snapshot of the **live** PPCS 2026 impact dashboard as served by Cloudflare,
taken before the redesign merge-to-live. Everything needed to restore the site to its
2026-06-16 state if the redeploy goes wrong is in this folder.

## Live identifiers (verified 2026-06-16 from the Cloudflare API)
| Thing | Value |
|---|---|
| Account ID | `097c92553b268f8360b74f625f6d980a` |
| Worker name | `wv-ppcs-impact` |
| Worker script ID | `92f1a2f8e76f4cb8a5831f9095d79157` |
| D1 database name | `wv-ppcs-impact` |
| D1 database UUID | `a5ea2fcf-299d-494d-9580-1184fe889d8c` |
| Worker bindings | `DB` → the D1 above · `ASSETS` → static-assets bundle |
| Route served | `windedvertigo.com/portfolio/ppcs-2026-impact*` (confirm exact pattern in CF dashboard → wv-ppcs-impact → Settings → Domains & Routes before redeploy) |
| D1 `metrics` row | `k='current'`, `updated_at='2026-06-15 18:30:13'` |

## What's in this folder
- `worker/index.js` — the deployed Worker script, pulled verbatim from the running
  Worker. (esbuild output, not original source; identical to the recovered bundle on
  branch `recover/ppcs-impact-from-cloudflare`.)
- `assets/index.html` — the live dashboard front-end (single self-contained file;
  inline CSS/JS, Chart.js from cdnjs, data fetched from `./api/metrics`).
- `assets/prme_logo_short_white.png` — the only real binary asset the page references.
  (Note: any other path under the route — e.g. `favicon.ico` — is served `index.html`
  by the ASSETS fallback, so there are no other assets to capture.)
- `metrics-current.json` — the live `/api/metrics` payload = the D1 `metrics.v` value.
- `d1-metrics-restore.sql` — `CREATE TABLE IF NOT EXISTS` + `INSERT OR REPLACE` of the
  `current` row. Round-trip verified (parses back to the exact JSON).

## Restore procedure (if the redeploy breaks the live site)
From `apps/ppcs-impact/backup-2026-06-16/`:

1. **Restore the D1 data** (idempotent — safe to run even if the row already exists):
   ```bash
   npx wrangler d1 execute wv-ppcs-impact --remote --file=./d1-metrics-restore.sql
   ```
2. **Restore the Worker + assets.** Redeploy `worker/index.js` with `assets/` as the
   `ASSETS` bundle, bindings `DB`/`ASSETS`, and the route above. (This is the same
   wrangler.jsonc the rebuilt source project uses — point `main` at this `index.js` and
   `assets.directory` at this `assets/` to push the *old* version back.)
3. **Bust the edge cache.** The Worker caches `/api/metrics` for 600s under key
   `https://ppcs-metrics-cache/v2`. Wait 10 min or purge cache in the CF dashboard.
4. **Verify:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://windedvertigo.com/portfolio/ppcs-2026-impact/
   curl -s https://windedvertigo.com/portfolio/ppcs-2026-impact/api/metrics | head -c 80
   ```
   Expect `200` and JSON beginning `{ "weekly": [ ...`.

## Sanity baseline (what "working" looks like)
- Page `HTTP 200`, title "PPCS 2026 — Engagement Dashboard".
- `/api/metrics` → `200 application/json`, ~4.5 KB, top-level keys: `weekly, sessions,
  commons, depth, reach_benchmark, sentiment, prime, themes, kpis, poll`.
- Headline KPIs: 915 registrants · 623 attendees · 44% show-rate · 4472 commons contributions.
