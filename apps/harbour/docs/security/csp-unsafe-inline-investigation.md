# CSP `'unsafe-inline'` Investigation — 2026-04-26

## Summary

Verdict per app (4 apps audited, all on Vercel + Next.js 16 + React 19):

- **creaseworks** — **YELLOW**. No Auth.js inline scripts (custom `/login` page). Only inline scripts are Next.js Flight (`self.__next_f.push(...)`) hydration payloads. Removing `'unsafe-inline'` requires a `proxy.ts` middleware that injects a per-request nonce — the same pattern already running in `apps/vertigo-vault/proxy.ts`. CSP currently lives in `vercel.json`; will need to move to `next.config.ts` `headers()` (and/or be set inside `proxy.ts`) so the nonce can be templated in.
- **port** — **YELLOW**. Same pattern (custom `/login`, only Flight + Vercel Analytics inline scripts). Needs a `proxy.ts` (none exists today). Plus: `script-src` already allowlists `https://va.vercel-scripts.com`, so the Vercel Analytics external script already loads under `'self'`/URL allowlist; only Flight scripts need the nonce.
- **ops** — **YELLOW**. Identical posture to port (custom signin, no proxy.ts, Flight-only inlines).
- **site** — **YELLOW**. Same — but with a wrinkle: site's home page also injects a JSON-LD `<script>` via `(self.__next_s=self.__next_s||[]).push(...)` (Next's `<Script>` component). That stream is also covered by Next's automatic nonce-on-Flight if `proxy.ts` sets one.

**Counts: 0 GREEN, 4 YELLOW, 0 RED.** None of the four are framework-required to keep `'unsafe-inline'`. All four need the same one-time pattern: a Next.js 16 `proxy.ts` that mints a nonce and emits a CSP using `'nonce-XXX' 'strict-dynamic'`.

The vault already runs this pattern in production (`apps/vertigo-vault/proxy.ts`), so it's a proven in-house template — not a speculative migration.

---

## Per-app analysis

### creaseworks

- **Current CSP** (from `harbour-apps/apps/creaseworks/vercel.json`):
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://vitals.vercel-insights.com;
  frame-src 'none';
  frame-ancestors 'none';
  worker-src 'self';
  base-uri 'self';
  form-action 'self'
  ```
- **Inline scripts found** (curl `https://www.windedvertigo.com/harbour/creaseworks/login` → 10 inline `<script>` tags):
  - `(self.__next_f=self.__next_f||[]).push([0])` — Next.js Flight bootstrap (framework-generated).
  - 9 × `self.__next_f.push([1, "..."])` — RSC payload chunks streaming the React tree (framework-generated).
  - 0 nonces present (`grep nonce= → 0`).
- **Auth.js inline scripts?** No. Auth.js v5 (`next-auth@5.0.0-beta.30`) only emits inline scripts from its **default-rendered** signin page. In `@auth/core/lib/pages/signin.tsx`, a script tag is rendered only when WebAuthn/passkey provider is registered AND the default signin page is being served. Creaseworks uses a custom `src/app/login/page.tsx` and no WebAuthn provider — so neither code path runs.
- **Root cause for `'unsafe-inline'`:** Next.js 16 RSC hydration. App Router streams the Flight payload as inline `<script>self.__next_f.push(...)</script>` chunks; these can't be hashed (content varies per request) and aren't nonced unless a middleware/proxy provides one.
- **Verdict:** **YELLOW** — possible but requires Next.js config changes.
- **Recommended new CSP** (after migration, served via `proxy.ts`):
  ```
  default-src 'self';
  script-src 'self' 'nonce-{REQUEST_NONCE}' 'strict-dynamic';
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://vitals.vercel-insights.com;
  frame-src 'none';
  frame-ancestors 'none';
  worker-src 'self';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests
  ```
- **Migration path:**
  1. Create `apps/creaseworks/src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`). Mint a per-request nonce, set `x-nonce` on the forwarded request headers (Next will auto-apply to Flight/`<Script>`), and set the CSP header on the response. Use `apps/vertigo-vault/proxy.ts` as the template.
  2. Remove the `Content-Security-Policy` entry from `vercel.json` (the proxy now owns it). Keep all other headers there — Vercel edge still emits them. **Or** move all headers into `proxy.ts` to consolidate. Easier to keep CSP-only in proxy and leave the rest in `vercel.json`.
  3. Add `upgrade-insecure-requests` (closes the matching `nice-to-have` audit finding).
  4. Deploy to a preview URL, test sign-in flow + dashboard hydration with browser DevTools Console open. Watch for any `Refused to execute inline script` violations. Especially test: `/login` → magic-link request, `/login` callback page, `/dashboard`, Stripe checkout return.
  5. If clean, promote to production. Re-run `scripts/security-audit.mjs` and confirm should-fix drops by 2 (script-src + frame-ancestors already done; only upgrade-insecure-requests would also close).

### port

- **Current CSP** (from `windedvertigo/port/next.config.ts`):
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://vitals.vercel-insights.com https://api.notion.com https://api.anthropic.com;
  frame-src 'none';
  frame-ancestors 'none';
  worker-src 'self';
  base-uri 'self';
  form-action 'self'
  ```
- **Inline scripts found** (curl `https://port.windedvertigo.com/login` → 8 inline `<script>` tags):
  - `(self.__next_f=self.__next_f||[]).push([0])` (Next.js Flight bootstrap).
  - 7 × `self.__next_f.push([1, "..."])` chunks.
  - The `https://va.vercel-scripts.com` allowlist is for the **external** Vercel Analytics script (`@vercel/analytics@^2.0.1` injects a `<script src="...">`, not inline). It does NOT need `'unsafe-inline'`.
- **Auth.js inline scripts?** No — port has its own `app/login/page.tsx`, custom UI, no WebAuthn.
- **Root cause for `'unsafe-inline'`:** Same as creaseworks — Next.js 16 RSC Flight payload.
- **Verdict:** **YELLOW**.
- **Recommended new CSP:**
  ```
  default-src 'self';
  script-src 'self' 'nonce-{REQUEST_NONCE}' 'strict-dynamic' https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://vitals.vercel-insights.com https://api.notion.com https://api.anthropic.com;
  frame-src 'none';
  frame-ancestors 'none';
  worker-src 'self';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests
  ```
  Note: `'strict-dynamic'` causes browsers (CSP Level 3) to **ignore** allowlist entries like `https://va.vercel-scripts.com` for non-nonced loads. The Vercel Analytics script is loaded by the `<Script>` component — Next will apply the nonce to it, so `'strict-dynamic'` will let it transitively load further chunks. Keep the allowlist as a **CSP Level 2 fallback** for browsers that don't support `'strict-dynamic'`. This is exactly the layered-fallback pattern in vault's proxy.
- **Migration path:**
  1. Create `windedvertigo/port/proxy.ts` (paralleling vault's). Move CSP out of `next.config.ts` `headers()` into the proxy. Keep the other headers in `next.config.ts`.
  2. Test sign-in flow and the heaviest interactive surfaces (`/opportunities`, `/projects`, `/campaigns`, `/analytics`). Port has more partykit/websocket use — confirm `connect-src wss://*.partykit.dev` style entries continue to work.
  3. Same audit re-run as creaseworks.

### ops

- **Current CSP** (from `windedvertigo/ops/next.config.ts`):
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://vitals.vercel-insights.com;
  frame-src 'none';
  frame-ancestors 'none';
  worker-src 'self';
  base-uri 'self';
  form-action 'self'
  ```
- **Inline scripts found** (curl `https://ops.windedvertigo.com/login` → 8 inline `<script>` tags): all `self.__next_f.push(...)` chunks. Identical to port.
- **Auth.js inline scripts?** No — ops uses `@windedvertigo/auth` shared package, custom login page.
- **Root cause for `'unsafe-inline'`:** Next.js 16 RSC Flight payload.
- **Verdict:** **YELLOW**.
- **Recommended new CSP:**
  ```
  default-src 'self';
  script-src 'self' 'nonce-{REQUEST_NONCE}' 'strict-dynamic' https://va.vercel-scripts.com;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  img-src 'self' data: https:;
  connect-src 'self' https://vitals.vercel-insights.com;
  frame-src 'none';
  frame-ancestors 'none';
  worker-src 'self';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests
  ```
- **Migration path:** Identical pattern. Smallest surface area of the four (no Stripe, no partykit, no Notion API in connect-src). **This is the lowest-risk pilot.**

### site

- **Current CSP** (from `windedvertigo/site/next.config.ts`):
  ```
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://unpkg.com https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
  font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.notion.com https://port.windedvertigo.com https://vitals.vercel-insights.com wss://*.partykit.dev wss://*.partykit.io https://script.google.com https://script.googleusercontent.com https://*.windedvertigo.workers.dev wss://*.windedvertigo.workers.dev;
  frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
  ```
  Note: this CSP is broader because site embeds whirlpool tools, demos, YouTube embeds, and partykit websockets. The `unpkg.com`/`cdn.jsdelivr.net` allowlist suggests one of the static demos (e.g. three-intelligence-workbook, the-mashup, writers-room) loads CDN libraries — those load via `<script src="...">`, not inline.
- **Inline scripts found** (curl `https://www.windedvertigo.com` → 9 inline `<script>` tags):
  - 1 × `(self.__next_s=self.__next_s||[]).push([0,{"type":"application/ld+json","children":"{\"@context\":\"https://schema.org\",..."}])` — Next's `<Script>` component injecting JSON-LD structured data via inline script.
  - 1 × `(self.__next_f=self.__next_f||[]).push([0])` Flight bootstrap.
  - 7 × `self.__next_f.push([1, "..."])` Flight chunks.
- **Auth.js inline scripts?** N/A — site doesn't use next-auth; no `next-auth` in `site/package.json`.
- **Root cause for `'unsafe-inline'`:** RSC Flight payload + the JSON-LD `<Script>` injection. Both get the auto-nonce treatment from Next.js when `x-nonce` is set on the request.
- **Verdict:** **YELLOW**. Slight extra risk: the **static-HTML demos** under `apps/site/public/tools/...` (the-mashup, writers-room) and `apps/site/public/portfolio/assets/pedal-conference-experience` are direct-served HTML files, NOT rendered by Next.js. If any of those use inline `<script>` blocks (likely — they're hand-rolled HTML), tightening the CSP will break them. **Audit those HTML files before migration** (grep for `<script>` without `src=` in `site/public/`).
- **Recommended new CSP:**
  ```
  default-src 'self';
  script-src 'self' 'nonce-{REQUEST_NONCE}' 'strict-dynamic' https://va.vercel-scripts.com https://unpkg.com https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
  font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
  img-src 'self' data: https:;
  connect-src 'self' https://api.notion.com https://port.windedvertigo.com https://vitals.vercel-insights.com wss://*.partykit.dev wss://*.partykit.io https://script.google.com https://script.googleusercontent.com https://*.windedvertigo.workers.dev wss://*.windedvertigo.workers.dev;
  frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
  upgrade-insecure-requests
  ```
- **Migration path:**
  1. **Audit static HTML demos first.** Grep `apps/site/public/` for inline `<script>` without `src=`. If any inline scripts found in `tools/*` or `portfolio/assets/*`, decide per-page whether to (a) extract to external `.js`, (b) hash and add to script-src, or (c) carve out a path-scoped looser CSP via `proxy.ts` matcher exclusions. Vault's proxy already has exclusion-by-matcher (`_next/static`, `_next/image`, etc.).
  2. Create `windedvertigo/site/proxy.ts`. Use the matcher to exclude `/tools/*`, `/portfolio/assets/*` if step 1 finds violations there, OR keep them in scope and add hashes.
  3. Test thoroughly because site is the most-trafficked surface. Validate: home, /do, /we, /what, /portfolio, vertigo-vault routes (proxied), and at least one static demo page.
- **Risk note:** site is **highest-risk** of the four to tighten because of the unknown static-HTML script content. Do this last.

---

## Reference: vault's nonce pattern

`harbour-apps/apps/vertigo-vault/proxy.ts` is the in-house template. Summary of what it does:

- Next.js 16 renamed `middleware.ts` → `proxy.ts`. Vault's proxy mints a per-request nonce with `crypto.randomUUID()` and base64-encodes it.
- It builds a CSP string of the form `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com` (plus the usual `default-src`, `style-src`, etc.).
- The nonce is set on **both**:
  - the forwarded **request** headers as `x-nonce` (so React/Next.js can read it and apply it to inline Flight scripts and `<Script>` components), AND
  - the **response** headers as `Content-Security-Policy` (so the browser enforces it).
  - Without both, hydration breaks silently — the browser would block the un-nonced inline scripts.
- A matcher excludes static asset paths (`_next/static`, `_next/image`, `images/`, `favicon.ico`) and skips prefetch requests. This avoids minting a nonce for hundreds of static GETs.

Why it works:
1. **Next.js auto-nonces Flight + `<Script>`** when it sees `x-nonce` on the forwarded request headers. This is undocumented-but-stable Next.js behaviour confirmed in App Router (15+) and still present in 16.
2. **`'strict-dynamic'`** (CSP Level 3) propagates trust from a nonced root script to anything it loads dynamically, so Next's chunk loaders work without a per-chunk nonce.
3. **Source-list fallbacks** (`'self'`, allowlisted hosts) are honoured by CSP Level 2 browsers that ignore `'strict-dynamic'`.
4. **Matcher excludes** static asset paths — they don't need a CSP and the per-request nonce minting would be wasted CPU.

**All four target apps could adopt this pattern with two additions specific to each:**
- creaseworks: add Stripe entries to script-src/connect-src/frame-src (already in vault's pattern).
- port: add Notion + Anthropic + partykit entries to connect-src; Vercel Analytics already covered by `'strict-dynamic'`.
- ops: minimal — closest to vault.
- site: extend connect-src for the long allowlist; deal with static HTML demos separately.

---

## Recommendation

**Prioritised migration order:**

1. **ops first** (this week, lowest risk). Smallest surface, no Stripe/Notion/payments, single auth flow. If anything breaks, ops is internal-only and easy to roll back.
2. **port second**. Heavier surface (partykit, Notion, Anthropic) but still mostly internal. Test sign-in + the campaigns/analytics live tabs.
3. **creaseworks third**. Customer-facing; test Stripe checkout, magic-link sign-in, and the dashboard especially.
4. **site last**. Most-trafficked, hardest to test exhaustively because of static-HTML demos and embedded YouTube/partykit content.

**Single commit-able change for the easiest win (ops):**

```
File: windedvertigo/ops/proxy.ts (NEW)
File: windedvertigo/ops/next.config.ts (modified — remove the script-src/style-src CSP entry, leave other headers)
```

Concrete CSP for ops (drop into a new `ops/proxy.ts` modelled on vault's):

```
default-src 'self';
script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://va.vercel-scripts.com;
style-src 'self' 'unsafe-inline';
font-src 'self';
img-src 'self' data: https:;
connect-src 'self' https://vitals.vercel-insights.com;
frame-src 'none';
frame-ancestors 'none';
worker-src 'self';
base-uri 'self';
form-action 'self';
upgrade-insecure-requests
```

Verification after deploy: load `https://ops.windedvertigo.com/login`, then `/dashboard`, with browser DevTools Console open. Expect zero `Refused to execute inline script because it violates the following Content Security Policy directive` warnings. Re-run `scripts/security-audit.mjs` and confirm:
- `should-fix` drops from 15 → 13 (ops `script-src has 'unsafe-inline'` closes; ops `frame-ancestors` already in place).
- `nice-to-have` drops from 6 → 5 (ops `upgrade-insecure-requests` closes).

If ops migration is clean after 24h, propagate the same pattern to port, then creaseworks, then site.

**Followup ideas (out of scope of this audit, mention so they're not lost):**
- The auth-shared package (`@windedvertigo/auth`) could expose a helper `buildCspWithNonce(nonce, extraDirectives)` so all four apps use the same generator instead of hand-rolling each `proxy.ts`. Low-priority but high-tidiness.
- Once all four are on `'strict-dynamic'`, consider also dropping `'unsafe-inline'` from `style-src` — but that's a larger fight (Next.js + Tailwind both inject inline styles, and `'strict-dynamic'` does NOT apply to style-src). Defer.
