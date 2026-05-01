# deployment topology — harbour apps

> last updated: 2026-04-25. the **live production routing** for every `/harbour/*` path is defined in the sibling repo `ghandoff/windedvertigo` at `site/next.config.ts` (the `rewrites()` function, now `beforeFiles`). edits there are what determine whether an app is served from Vercel or Cloudflare Workers. this doc explains the split, why it exists, and how to deploy each kind.

> **2026-04-25 update**: the windedvertigo.com **site router itself** moved from Vercel → CF Workers (the wv-site Worker now serves all windedvertigo.com traffic via worker routes; the Vercel site project was deleted). The **harbour hub** also moved Vercel → CF Workers (`wv-harbour-harbour`). Only **creaseworks**, **vertigo.vault**, **port** (port.windedvertigo.com), and **nordic-sqr-rct** (nordic.windedvertigo.com — uses Workflow DevKit + Vercel Blob, can't move without rewrite) remain on Vercel.

## tl;dr

the 19 harbour apps are served from **two different runtimes** depending on maturity and traffic:

| runtime | who lives there | why |
|---|---|---|
| **Vercel** (full Next.js function runtime) | **creaseworks**, **vertigo.vault**, **port** (port.windedvertigo.com), **nordic-sqr-rct** (nordic.windedvertigo.com) | real traffic, production tables, active paying users — or (nordic) deps incompatible with CF Workers (Workflow DevKit + Vercel Blob) |
| **Cloudflare Workers** (via OpenNext) | **windedvertigo.com site router** (wv-site), **harbour hub** (wv-harbour-harbour), and **every other harbour app** — paper.trail, deep.deck, depth.chart, raft.house, tidal.pool, mirror.log, and all 11 threshold-concept apps | underdeveloped, low traffic, cost-sensitive. cloudflare's per-request pricing + free tier keeps the long tail cheap. |

`pushing to main → Vercel auto-deploys only` the Vercel-routed apps. **cloudflare deploys do not happen from git push.** they must be triggered manually per app (or via the batch script below).

## why this split exists

we got a $223/month overage on Vercel in early 2026 from the harbour-apps monorepo creating too many build × project combinations. every push rebuilt every connected project. the spending cap in CLAUDE.md ($10 on-demand, $30 max) exists because of that incident.

to keep costs under the cap as we add more harbour apps, we migrated the long tail (everything except creaseworks + vault) off Vercel. those apps are either:

- **underdeveloped** (the 11 threshold-concept apps are still prototypes), or
- **low traffic** (paper.trail, deep.deck, depth.chart, etc. see occasional use)

cloudflare workers are free up to 100k requests/day and bill per request — roughly two orders of magnitude cheaper than paying for always-warm Vercel functions for apps that get a few hundred daily hits.

**what stayed on Vercel and why**: creaseworks has real customers, neon postgres, cron jobs, stripe; vertigo.vault is its sister app with shared auth cookies on `.windedvertigo.com`. the ops cost of porting these to workers + maintaining the auth contract isn't worth it. they will stay on Vercel.

## how the live routing works

every request to `windedvertigo.com/harbour/<app>/*` is proxied by the **wv-site Cloudflare Worker** (windedvertigo.com is fronted entirely by CF Workers as of 2026-04-25). its `next.config.ts` declares **`beforeFiles`** rewrites that forward the path to the correct backend:

```ts
// windedvertigo/site/next.config.ts — rewrites() must use beforeFiles
async rewrites() {
  return {
    beforeFiles: [
      { source: "/harbour/creaseworks/:path*",
        destination: "https://creaseworks-ghandoffs-projects.vercel.app/harbour/creaseworks/:path*" }, // Vercel
      { source: "/harbour/paper-trail/:path*",
        destination: "https://wv-harbour-paper-trail.windedvertigo.workers.dev/harbour/paper-trail/:path*" }, // CF worker
    ],
  };
}
```

**why beforeFiles**: the default `rewrites()` shape (afterFiles) lets Next's app router resolve `not-found.tsx` first and intercept GETs to unknown paths before the rewrite fires. `beforeFiles` runs the rewrite ahead of file routing. HEAD requests bypass the not-found path, which is why HEAD/GET behavior diverged before the fix.

### CF Workers Routes (most-specific match wins)

even with `beforeFiles`, Next's app router still intercepts certain GETs for paths that share a prefix with the site's own routes. For those apps we add a **direct CF Workers Route** at the zone level so the request never hits the site router:

- `windedvertigo.com/harbour/depth-chart/*` → `wv-harbour-depth-chart` Worker (added 2026-04-25 to bypass site-router not-found.tsx interception on GETs)

CF picks the most-specific matching route per request, so the depth-chart route wins over the site-wide `windedvertigo.com/*` route automatically. Use this pattern for any future app that hits the same not-found interception.

when you add a new harbour app you must add (or update) the matching rewrite in the sibling repo and redeploy the wv-site Worker. **this monorepo's commits don't touch those rewrites — a push here alone won't route traffic to your new app.**

## where each app is routed today

### Vercel-routed (push = auto-deploy)
- creaseworks → `creaseworks-ghandoffs-projects.vercel.app`
- vertigo-vault → `vertigo-vault-ghandoffs-projects.vercel.app`

### Cloudflare-Worker-routed (manual deploy required)
launch pier:
- paper-trail → `wv-harbour-paper-trail.windedvertigo.workers.dev`
- deep-deck → `wv-harbour-deep-deck.windedvertigo.workers.dev`
- depth-chart → `wv-harbour-depth-chart.windedvertigo.workers.dev`
- raft-house → `wv-harbour-raft-house.windedvertigo.workers.dev`
- tidal-pool → `wv-harbour-tidal-pool.windedvertigo.workers.dev`
- mirror-log → `wv-harbour-mirror-log.windedvertigo.workers.dev`

repairs pier (threshold concepts):
- orbit-lab, proof-garden, bias-lens, scale-shift, pattern-weave, market-mind, rhythm-lab, code-weave, time-prism, liminal-pass, emerge-box → `wv-harbour-<app>.windedvertigo.workers.dev`

### CF-Worker-routed (added 2026-04-25)
- harbour hub → `wv-harbour-harbour.windedvertigo.workers.dev` (was on Vercel `reservoir-tau.vercel.app`; migrated 2026-04-25). has R2 binding `TILE_IMAGES` → `creaseworks-evidence` bucket. admin endpoint `/harbour/api/admin/sync-tiles` (bearer `CRON_SECRET`) syncs Notion tiles → R2.
- depth-chart → also has a direct CF Workers Route on `windedvertigo.com/harbour/depth-chart/*` (see "CF Workers Routes" above)

### Vercel-but-not-routed-through-windedvertigo.com
- port → `port.windedvertigo.com` (its own Vercel project with custom domain — operational hub / CRM)
- nordic-sqr-rct → `nordic.windedvertigo.com` (custom domain on existing Vercel project; pinned to Vercel due to Workflow DevKit + Vercel Blob deps)
- values-auction → its own Vercel project with Root Directory `apps/values-auction` (Vite SPA). proxied through windedvertigo.com via a rewrite in the sibling `ghandoff/windedvertigo` repo. deploy with `./scripts/deploy-values-auction.sh` after running `cd apps/values-auction && vercel link` once.

## how to deploy

### Vercel apps (creaseworks, vertigo-vault, port, nordic-sqr-rct)

auto-deploys on push to `main`. for manual deploys (disconnected projects or quick prod fixes), use the monorepo-root scripts:

```bash
# similar scripts exist under scripts/deploy-<app>.sh for vercel-hosted apps
```

these scripts swap `.vercel/project.json` temporarily so Vercel resolves the correct workspace packages from the monorepo root.

> the harbour hub used to live here. as of 2026-04-25 it's a CF Worker — see below.

### Cloudflare Worker apps (everything else)

each CF-routed app lives in `apps/<name>/` with:
- `wrangler.jsonc` — worker config
- `open-next.config.ts` — OpenNext adapter config
- `@opennextjs/cloudflare` + `wrangler` in devDependencies

**deploy one app:**

```bash
# auth first if wrangler isn't logged in: `npx wrangler login` (or set CLOUDFLARE_API_TOKEN to a fresh token)
cd apps/<name>
npx opennextjs-cloudflare build   # compiles .open-next/worker.js
npx opennextjs-cloudflare deploy  # uploads via wrangler
```

**important**: `deploy` alone does NOT rebuild. if your source changed, always run `build` first (or delete `.open-next/` to be safe). OpenNext's caching will silently ship stale code otherwise.

**deploy all 18 CF apps in one go** — the batch script used when shared packages (`packages/tokens`, `packages/auth`) change and every CF app needs rebuilding (now includes `harbour` since the hub moved to CF):

```bash
for app in harbour deep-deck depth-chart raft-house tidal-pool mirror-log paper-trail \
           orbit-lab proof-garden bias-lens scale-shift pattern-weave market-mind \
           rhythm-lab code-weave time-prism liminal-pass emerge-box; do
  (cd apps/$app && \
    npx opennextjs-cloudflare build && \
    npx opennextjs-cloudflare deploy) || echo "FAILED: $app"
done
```

expect ~45-60s per app, ~15 min total for the full sweep.

### when to redeploy which

| change | Vercel apps | CF apps |
|---|---|---|
| app-specific code (`apps/<app>/**`) | auto on push | `cd apps/<app> && npx opennextjs-cloudflare deploy` |
| shared packages (`packages/auth/**`, `packages/tokens/**`) | **all Vercel apps auto-redeploy on push** (can be expensive — every connected project builds) | **every CF app must be redeployed manually** — the batch loop above |
| `windedvertigo-site` rewrites | doesn't apply | doesn't apply — edit the sibling `ghandoff/windedvertigo` repo and redeploy that project |

## migrating a new app to cloudflare

the automated path is `scripts/migrate-to-cloudflare.sh`:

```bash
./scripts/migrate-to-cloudflare.sh <app-name>              # scaffold + build
./scripts/migrate-to-cloudflare.sh <app-name> --deploy     # scaffold + build + deploy
./scripts/migrate-to-cloudflare.sh <app-name> --preview    # scaffold + build + local preview
```

it will:
1. create `wrangler.jsonc` if missing
2. create `open-next.config.ts` if missing
3. install `@opennextjs/cloudflare` + `wrangler`
4. run the OpenNext build
5. optionally deploy or preview

after the first successful deploy, add the rewrite in `windedvertigo/site/next.config.ts` so `windedvertigo.com/harbour/<app>/*` reaches the worker:

```ts
{ source: "/harbour/<app>",
  destination: "https://wv-harbour-<app>.windedvertigo.workers.dev/harbour/<app>" },
{ source: "/harbour/<app>/",
  destination: "https://wv-harbour-<app>.windedvertigo.workers.dev/harbour/<app>" },
{ source: "/harbour/<app>/:path*",
  destination: "https://wv-harbour-<app>.windedvertigo.workers.dev/harbour/<app>/:path*" },
```

then redeploy the site project.

## common gotchas

- **OpenNext caches `.open-next/` aggressively.** if you deploy and the old content still shows up, `rm -rf .open-next` and rebuild. `deploy` without `build` will happily re-upload stale artifacts.
- **shared-package changes need a full CF-app sweep**. a single push to main will redeploy the Vercel apps automatically but will leave every CF app stale until you run the batch loop above.
- **the harbour hub IS now CF-routed** (as of 2026-04-25) — Worker name `wv-harbour-harbour`. deploy with the standard CF flow: `cd apps/harbour && npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy`. it has a `TILE_IMAGES` R2 binding to `creaseworks-evidence` and an admin sync endpoint `/harbour/api/admin/sync-tiles` (bearer `CRON_SECRET`) that pulls tile images Notion → R2.
- **R2 public URL changed (2026-04-25)**: `creaseworks-evidence` migrated anotheroption → garrett CF account. old base `https://pub-c685a810f5794314a106e0f249c740c9.r2.dev` is **broken**. new base `https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev`. all apps' `R2_PUBLIC_URL` env vars have been updated; if you scaffold a new app, use the new base.
- **wrangler auth**: `npx wrangler whoami` — must show the `ghandoffs` cloudflare account. the account id is pinned in every `wrangler.jsonc` (`097c92553b268f8360b74f625f6d980a`). if a CF API token is rejected, mint a fresh one or re-run `npx wrangler login`.
- **build failures**: the OpenNext build depends on `next build` working first. if `next build` fails locally (e.g., missing env vars for static generation), the CF deploy will fail too. fix the Next build first.
