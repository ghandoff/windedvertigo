# CF Workers security-header wrapper

> Decision record + rollout guide for `@windedvertigo/security`.
> Closes 5 of the 7 must-fix items in `launch-audit-2026-04-26.md`.

## Background

Next.js apps configure security headers via `next.config.ts`'s `async headers()`
function. On **Vercel**, those rules are translated to platform-level
header rules at build time and applied by Vercel's edge — they show up
on every response, including 302s and ISR-cached pages.

On **Cloudflare Workers via OpenNext**, that translation does not happen.
The OpenNext-emitted `.open-next/worker.js` runs
`runWithCloudflareRequestContext` and dispatches to the Next.js
server-functions handler, which produces a `Response` that bypasses the
`next.config.ts` headers() rules entirely.

The 2026-04-26 launch-readiness audit captured this as 5 must-fix items
(harbour hub + depth-chart each missing HSTS + CSP, plus the `frame-ancestors`
defence-in-depth gap).

## Solution

`packages/security/cf-headers.ts` exports `wrapWithSecurityHeaders(handler,
options?)`. It accepts an `ExportedHandler`-shaped worker handler and
returns one whose `fetch` overlays 5 always-on headers (HSTS, XFO, XCTO,
Referrer-Policy, Permissions-Policy) plus an optional CSP on every
response.

Each app's `worker.ts` becomes a thin wrapper around the OpenNext
handler:

```ts
import openNextHandler, {
  DOQueueHandler,
  DOShardedTagCache,
  BucketCachePurge,
} from "./.open-next/worker.js";
import { wrapWithSecurityHeaders, HARBOUR_DEFAULT_CSP } from "@windedvertigo/security";

export { DOQueueHandler, DOShardedTagCache, BucketCachePurge };
export default wrapWithSecurityHeaders(openNextHandler, { csp: HARBOUR_DEFAULT_CSP });
```

Then `wrangler.jsonc`'s `main` field points at `worker.ts` instead of
`.open-next/worker.js`. opennextjs-cloudflare's build still runs first
(producing the .open-next/ tree); wrangler's bundler then compiles
`worker.ts`, follows the import to `.open-next/worker.js`, and emits a
single combined bundle.

### Why re-export the Durable Object classes?

OpenNext's worker exports three Durable Object classes:
`DOQueueHandler`, `DOShardedTagCache`, `BucketCachePurge`. Wrangler binds
DOs by **class export name** at deploy time. If `worker.ts` only
re-exports `default`, those classes get tree-shaken out and the deploy
fails with "Durable Object class not found" the moment OpenNext tries
to use the queue or shared-tag-cache.

The wrapper does NOT need to know about DO classes — it only mutates
`fetch`. The `worker.ts` entry handles re-export.

### Why is the response cloned?

OpenNext can return responses whose headers are immutable (e.g. an ISR
cache hit served from R2). Calling `.set()` on those throws. The wrapper
constructs a fresh `Response` with a new `Headers` object copied from
the original, then overlays its security headers, then returns the
new response. The body stream is preserved unchanged.

## API reference

```ts
function wrapWithSecurityHeaders<Env>(
  handler: WorkerHandler<Env>,
  options?: SecurityHeadersOptions,
): WorkerHandler<Env>;

type SecurityHeadersOptions = {
  csp?: string;            // Content-Security-Policy. Omit to disable CSP injection.
  skipPaths?: RegExp[];    // Pathnames matching any of these get the inner response untouched.
};
```

The 5 always-on headers (always set, never disabled):
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

CSP behaviour:
- If `options.csp` is set AND the inner response has no
  `Content-Security-Policy` header → wrapper sets the configured CSP.
- If the inner response already has its own CSP → wrapper does NOT
  clobber it (a Route Handler with a custom CSP keeps its value).
- If `options.csp` is omitted → wrapper does not set CSP at all.

A pre-baked `HARBOUR_DEFAULT_CSP` constant is exported, mirroring
`apps/harbour/next.config.ts` and adding `frame-ancestors 'none'` for
defence-in-depth.

## Rollout checklist

### 1. Harbour (Phase B5 of `harbour-residuals-and-resume.md`)

Already specced via Track A3:
- `apps/harbour/worker.ts` exists with the wrapper applied.
- `apps/harbour/wrangler.jsonc` `main` → `worker.ts`.
- Build + deploy:
  ```
  cd apps/harbour
  npx opennextjs-cloudflare build
  npx opennextjs-cloudflare deploy
  ```
- Verify: `curl -sI https://www.windedvertigo.com/harbour/ | grep -iE "strict-transport-security|x-frame-options|content-security-policy"` returns all 3.

### 2. Depth-chart

Mirror harbour. Specifically:

1. Create `apps/depth-chart/worker.ts` (same shape as harbour's;
   re-exports the same 3 DO classes; calls `wrapWithSecurityHeaders`
   with depth-chart's CSP — likely identical to `HARBOUR_DEFAULT_CSP`
   since depth-chart serves the same UI shell).
2. In `apps/depth-chart/wrangler.jsonc`, change `"main":
   ".open-next/worker.js"` to `"main": "worker.ts"`.
3. Add `"@windedvertigo/security": "*"` to
   `apps/depth-chart/package.json` dependencies.
4. Build + deploy:
   ```
   cd apps/depth-chart
   npx opennextjs-cloudflare build
   npx opennextjs-cloudflare deploy
   ```
5. Re-run security audit: must-fix should drop to 0.

### 3. The 14 threshold-concept apps

Per `apps/harbour/CLAUDE.md` and the deployment topology doc, the
remaining harbour CF Worker apps are:
- `wv-harbour-paper-trail`
- `wv-harbour-deep-deck`
- `wv-harbour-raft-house`
- `wv-harbour-tidal-pool`
- `wv-harbour-mirror-log`
- `wv-harbour-three-intelligence-workbook`
- (and 8 additional threshold-concept apps from the harbour-games Notion
  database — names sourced from the rewrites in
  `ghandoff/windedvertigo/site/next.config.ts`)

For each, the rollout is mechanical:
1. Add `worker.ts` wrapping the OpenNext handler with the same shared
   `HARBOUR_DEFAULT_CSP`.
2. Repoint `wrangler.jsonc` `main` field.
3. Add `@windedvertigo/security` to package.json.
4. `npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy`.

A batch script could iterate over `apps/*/wrangler.jsonc` and apply the
edit programmatically; that's a Stage C nice-to-have, not blocking
launch.

## Limitations

- **Asset-binding bypass**: the assets bound at `assets.binding = "ASSETS"`
  are served by Cloudflare's runtime BEFORE worker code executes. The
  wrapper does not (and cannot) inject headers on those responses. To
  set headers on static assets, use Cloudflare Transform Rules or
  Workers Routes-level rules at the zone level. For harbour, this is
  acceptable: HTML responses (the high-value targets for clickjacking
  and CSP) all flow through the worker.
- **The wrapper does NOT enforce HTTPS**. HSTS sets max-age but the
  initial `https://` is the user's responsibility (or the zone-level
  Always Use HTTPS rule).
- **No CSP nonce support**: today the wrapper sets a static CSP. A future
  iteration could generate a per-request nonce and rewrite Next.js's
  hydration script tags — needed for CSP Level 3 `'strict-dynamic'`
  hardening (see Track A1's investigation doc).
