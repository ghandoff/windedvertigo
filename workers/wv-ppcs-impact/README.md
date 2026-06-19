# wv-ppcs-impact — PPCS 2026 Engagement Dashboard (Cloudflare D1, no PII online)

A Cloudflare Worker serving the PPCS 2026 engagement dashboard. Figures are a
**precomputed aggregate snapshot stored in Cloudflare D1** — no Supabase, no
Hyperdrive, no database password, and **no participant PII online**. The dashboard
is **unlisted** (`noindex`); only a few KB of aggregate JSON ever leaves the edge.

> **Analysis memo / report reference.** The narrative behind the reframed reach +
> engagement-depth charts (benchmarks, sources, methodology, report-ready language,
> print-ready PNGs) lives at:
> `clients/UN PRME/2026 PPCS End-of-Series Report/analysis/engagement-reframe-and-depth-analysis.md`.
> Keep that memo in sync with these figures — if a benchmark assumption or new data
> changes, re-run the refresh below and update the memo's tables/PNGs to match.

---

## Architecture
```
Browser → wv-ppcs-impact.<acct>.workers.dev
              │
   ┌──────────┴───────────┐
 GET /api/metrics        GET /*
   │                      │
   ▼                      ▼
 Worker (src/index.js)   Workers Assets (public/index.html)
   │  SELECT v FROM metrics WHERE k='current'
   ▼
 Cloudflare D1  (wv-ppcs-impact)
   └─ table `metrics`: a single aggregate-JSON row (no PII)
```
The `/api/metrics` JSON contract is identical to the previous build
(`weekly, sessions, commons, depth, reach_benchmark, sentiment, prime, themes, kpis`),
so the front end is unchanged.

## Deploy
```bash
cd wv-ppcs-impact
npx wrangler deploy          # no npm install needed — no runtime deps
```

### Live URLs
The Worker is served from two origins (both active):

| URL | Notes |
|-----|-------|
| **https://windedvertigo.com/portfolio/ppcs-2026-impact/** | Primary — custom-domain path (canonical). The bare path `…/ppcs-2026-impact` 308-redirects to the trailing slash. |
| https://wv-ppcs-impact.workers.dev | Kept live for backward compatibility (`workers_dev = true`). |

**How the subpath works.** `wrangler.toml` claims two routes —
`windedvertigo.com/portfolio/ppcs-2026-impact` and `…/portfolio/ppcs-2026-impact/*` —
which are *more specific* than the main `wv-site` Worker's catchall, so they win for
this subpath only and leave the rest of the site untouched. `src/index.js` is
base-path-aware: it strips the `/portfolio/ppcs-2026-impact` prefix before routing,
so the same code serves both origins. The page uses **relative** asset and
`/api/metrics` URLs, so everything resolves correctly under the subpath. Keep
`workers_dev = true` in `wrangler.toml` or the `*.workers.dev` origin gets disabled
on the next deploy.

## Refresh the figures (no redeploy)
When new data lands (e.g. certificate completion, more survey responses), recompute
and push to D1:
```bash
bash scripts/refresh_d1.sh
```
This re-runs `scripts/compute_metrics_json.py` against the engagement SQLite DB and
updates the D1 row; the live dashboard reflects it within the 10-minute edge cache.

## Adding certificate completion later
1. Add the counts to `scripts/compute_metrics_json.py` (extend the `kpis` block, e.g.
   `cert_practice_n`, `cert_applied_n`).
2. Add the matching KPI cards to `public/index.html`.
3. `bash scripts/refresh_d1.sh`.
No PII is needed — certificate awards reduce to counts before they reach D1.

## Security & privacy
- **No PII online.** D1 holds only the aggregate JSON. Participant identifiers, free
  text, and the identity bridge stay in the offline analysis database
  (`Engagement Evidence/Database/PPCS2026_engagement.db`).
- **No DB credentials in the Worker.** The D1 binding is account-scoped; there is no
  service key, connection string, or password anywhere in the repo or bundle.
- **Unlisted.** `public/index.html` carries `<meta name="robots" content="noindex, nofollow">`.
- Because no personal data is served or stored online, the prior Supabase
  pseudonymisation / data-residency apparatus is not needed for this dashboard.

## Decommissioning the old Supabase path (do this to stop the monthly cost)
The dashboard no longer uses Supabase or Hyperdrive. To stop the spend:
1. **Delete the Supabase project** `wv-ppcs` (ref `txuchtssjgccsaezsptz`):
   Supabase dashboard → Project Settings → General → *Delete project*.
   (This is the line item that costs money; it must be done in the Supabase console.)
2. **Delete the Hyperdrive config** `wv-ppcs-db` (id `097b7e8fc95a4a739a41279eefadc2df`):
   `npx wrangler hyperdrive delete 097b7e8fc95a4a739a41279eefadc2df`
   — do this only AFTER `wrangler deploy` above, so the live Worker is already on D1.
3. The `supabase/` migrations and `scripts/load_to_supabase.py` are now **legacy**,
   retained only as a record of the prior architecture.
