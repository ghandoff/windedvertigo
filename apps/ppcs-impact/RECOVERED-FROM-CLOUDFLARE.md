# wv-ppcs-impact — recovered from Cloudflare (NOT original source)

**Why this exists:** The live Worker `wv-ppcs-impact` (last deployed 2026-06-14) was found
during the 2026-06-15 backup audit to have **no source anywhere** — not in this monorepo,
not in `harbour-apps`, not in any git history, not on any branch. It was deployed straight
from a laptop via `wrangler deploy` and never committed. This directory is the emergency
backup pulled directly from the running Worker so the code is no longer one disk-failure
from gone.

## What `dist/index.js` is
The **deployed (bundled) script**, fetched verbatim from Cloudflare via the Workers API on
2026-06-15. It is esbuild output, not the hand-written source — note `var __defProp`, the
`__name` shim, and `// src/index.js` / `sourceMappingURL=index.js.map` markers. The original
`src/index.js` and the `index.js.map` source map are **not retrievable** from the Workers
script endpoint and still exist only on whatever machine deployed it.

## What the Worker does (read from the bundle)
- Serves the route base `/portfolio/ppcs-2026-impact` (308-redirects bare path to trailing slash).
- `GET /api/metrics` → reads `select v from metrics where k = 'current'` from a **D1** binding
  (`env.DB`), caches the JSON for 600s in `caches.default` (cache key `https://ppcs-metrics-cache/v2`).
- All other paths → served from a **static-assets** binding (`env.ASSETS`).

## Bindings the runtime expects (must be reconstructed for any redeploy)
| Binding | Type | Notes |
|---|---|---|
| `DB` | D1 database | holds a `metrics` table with `(k, v)`; row `k='current'` is the payload |
| `ASSETS` | Static assets / Sites | the built front-end for `/portfolio/ppcs-2026-impact` — **NOT captured here** |

## ⚠️ What is still missing (do NOT treat this as deploy-ready)
1. **Original `src/index.js`** + `index.js.map` — only on the deploying laptop.
2. **The static assets** behind `env.ASSETS` (HTML/CSS/JS/images for the impact page) — these
   are served from CF and were never in any repo. Recover them from the build machine, or
   re-export from CF if still hosted.
3. The real **`wrangler.jsonc`** (D1 database id, assets dir, routes/custom domain). No config
   was fabricated here on purpose, to avoid an accidental mis-deploy.

## Recovery plan when back at the deploying machine
1. Locate the real project dir (search the laptop for `ppcs-2026-impact` / `wv-ppcs-impact`).
2. Commit its `src/`, `wrangler.jsonc`, and assets into `apps/ppcs-impact/` here, replacing
   this `dist/`-only stub.
3. If the source is truly gone, this bundle + the binding notes above are enough to rebuild it.
