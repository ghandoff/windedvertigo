# CSP `'unsafe-inline'` removal — investigation (2026-04-26)

> Output of forward-roadmap Phase B4. Time-boxed research only — no
> code changes. Recommendation at the bottom.

## What's `'unsafe-inline'` doing for us today

Every Next.js app in the harbour fleet emits a CSP that allows
`'unsafe-inline'` in both `script-src` and `style-src`. This is the
permissive mode that lets inline `<script>` and inline `style="..."`
attributes execute without nonce / hash gating.

**Current locations** (script-src `'unsafe-inline'`):

| Origin | File | Line |
|---|---|---|
| harbour hub | `apps/harbour/next.config.ts` | 26 |
| creaseworks | `apps/creaseworks/next.config.ts` | 39 |
| 11× threshold-concept apps | `apps/<app>/next.config.ts` | 23-26 |
| paper-trail, deep-deck | `apps/<app>/next.config.ts` | 26-32 |
| port | `windedvertigo/port/next.config.ts` | 42 |
| ops | `windedvertigo/ops/next.config.ts` | 25 |
| site (root) | `windedvertigo/site/next.config.ts` | 590 |
| @windedvertigo/security CF wrapper | `packages/security/cf-headers.ts` | 130 |

## What's actually inline on a live page

Sampled `https://www.windedvertigo.com/harbour/login` (a Next.js 16
+ React 19 page rendered through OpenNext on CF):

- 9 external `<script src="...">` tags — chunks, not affected.
- **3 true inline scripts**, all React Server Components flight-data:
  ```
  (self.__next_f=self.__next_f||[]).push([0])
  self.__next_f.push([1,"1:\"$Sreact.fragment\"\n3:I[39756,..."])
  self.__next_f.push([1,"y)] antialiased\",..."])
  ```

These are how React 19 streams server-component JSON to the client
during hydration. Removing `'unsafe-inline'` blocks them from
executing → app fails to hydrate.

## Three viable remediation paths

### 1. Nonce-based CSP via middleware (Next.js canonical pattern)

Next.js 15+ supports this natively. Middleware reads the request,
generates a per-request nonce, sets `Content-Security-Policy:
script-src 'nonce-<n>' ...`, and propagates the nonce so Next.js's
streaming renderer attaches `nonce` attributes to its emitted inline
scripts. Reference:
<https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy>

**Pros:**
- Strongest CSP — actually mitigates XSS rather than just signalling intent.
- Next.js does the heavy lifting once middleware sets the header.

**Cons / unknowns:**
- **OpenNext-on-CF compatibility unverified.** Next.js's nonce pipeline
  hands the nonce to React's flight serializer; whether OpenNext's
  bundled Worker respects this is not documented. Needs a
  proof-of-concept on one CF Worker (recommend bias-lens — smallest
  app, no auth) before broad rollout.
- Nonce-set CSP means the header has to be dynamic per-request, not
  baked into `next.config.ts` `headers()`. Means moving CSP emission
  from `next.config.ts` → middleware on every app. For CF Workers
  apps, that means another wrapper layer in `worker.ts`.
- Auth.js v5 client signIn() emits a few inline scripts during OAuth
  redirects — these need to be reviewed.

### 2. Hash-based CSP (`'sha256-...'` per inline script)

CSP can allow specific inline scripts by their SHA256 hash. Tools like
`csp-hash-source` can compute these from the SSR output.

**Pros:**
- Static — header stays in `next.config.ts`.
- No middleware overhead.

**Cons:**
- Next.js's React 19 flight data **changes per-request** (component
  state, route, etc.), so hashes are not stable. Each unique flight
  payload would need a new hash. Effectively unworkable for SSR with
  dynamic content.
- Only viable for fully static pages (the few static HTML tools we
  serve from `public/`).

### 3. `'strict-dynamic'` (allow trust to propagate from nonced scripts)

CSP3's `'strict-dynamic'` source expression delegates trust: any
script loaded by a nonced/hashed script is also trusted. Combined
with nonce on the bootstrap, this can simplify the CSP for apps with
many lazy-loaded chunks.

**Pros:**
- Simpler CSP — one nonce + `'strict-dynamic'` covers all transitively
  loaded chunks.

**Cons:**
- Still requires nonce as the trust root → all of path 1's caveats
  apply.
- Browser support is universal modern but legacy IE etc. fall back to
  the safelist (still requires nonces).

## Bigger fish in the same pond

Two things came up while inventorying:

1. `packages/security/cf-headers.ts` line 130 also has
   `'unsafe-inline'` — meaning the CF Worker wrapper (harbour,
   depth-chart today; 16 more after A2 deploys) also emits the
   permissive policy at the wrapper level. Worth noting because it
   means the wrapper CSP, not just per-app `next.config.ts` CSP, must
   be coordinated for any nonce migration.

2. `'unsafe-inline'` exists on `style-src` too (every origin). React
   styled components and Tailwind 4 inject inline `<style>` tags for
   atomic CSS rules. Removing from style-src is a separate (and
   harder) project — `'nonce-...'` works for styles too but the
   inline `style="..."` attributes cannot be nonced. Defer.

## Major finding (2026-04-26 mid-investigation)

**Vault already has a nonce-based CSP implementation in
`apps/vertigo-vault/proxy.ts`.** Commit `79db6c3` (the v0 hardening
PR) shipped it. The file generates per-request nonces and emits
`script-src 'self' 'nonce-X' 'strict-dynamic' https://js.stripe.com`.

But it's **not active in production**:

- Live response on `https://www.windedvertigo.com/harbour/vertigo-vault`
  shows the static CSP from `vercel.json` with `'unsafe-inline'`.
- Inline `<script>` tags have **no nonce attribute** — meaning Next.js
  isn't reading the `x-nonce` request header proxy.ts is supposed to
  set, OR proxy.ts isn't running on the deployed build.

Likely culprit: Vercel `vercel.json` `headers` config layers headers
AFTER the function returns. proxy.ts sets the dynamic CSP, vercel.json
appends a second `Content-Security-Policy` header — browsers handle
multiple CSP headers by **intersecting** them (most-restrictive wins),
which means the static `'unsafe-inline'` permissive directive gets
combined with the strict nonce one, producing inconsistent behaviour.

**Test path on vault first** before propagating elsewhere:

1. Remove the `Content-Security-Policy` entry from
   `apps/vertigo-vault/vercel.json` (keep HSTS, XFO, XCTO, Referrer,
   Permissions).
2. Push the change. Vercel auto-deploys.
3. Verify the live response now has only one CSP header (from
   proxy.ts) and inline scripts gain nonce attributes.
4. If clean: the pattern is proven on Vercel + vault, ready to spike
   on a CF Worker app.

This converts the B4 "investigation only" recommendation into a
**concrete one-line vercel.json change** that closes 1 should-fix item
on vault and validates nonce-CSP deployment for the rest of the
fleet. Recommended as part of B1.

## Recommendation (revised)

**For launch (mid-June 2026):** keep `'unsafe-inline'` on the harbour
CF Workers fleet (16 apps via `@windedvertigo/security` wrapper). XSS
surface is well-understood; harbour ships no UGC.

**Pre-launch quick win (alongside B1):** remove the static CSP from
vault's `vercel.json` so proxy.ts's nonce-CSP becomes active. This
validates the nonce pattern on one production app, closes the vault
should-fix item, and gives us empirical data before propagating.

**Post-launch (Phase D, after the 4-week stability gate):** spike a
nonce migration on bias-lens first.

1. Move CSP emission from bias-lens's `next.config.ts` → a new
   middleware that generates a per-request nonce.
2. Update `packages/security/cf-headers.ts` `wrapWithSecurityHeaders`
   to skip CSP override when middleware has already set it (read the
   incoming response's `content-security-policy` header before
   layering).
3. Build, deploy, smoke-test bias-lens. Inspect a live response — the
   inline `<script>` tags should have `nonce="..."` attributes that
   match the CSP's `'nonce-...'` source.
4. If green: propagate to the 15 sister apps + harbour + depth-chart.
   This is a per-app middleware.ts addition (new file in each).
5. If red: document the OpenNext-on-CF gap, accept `'unsafe-inline'`
   as the permanent posture for CF Workers apps, tighten Vercel apps
   independently.

**Estimated effort:** 4-6 hours including the bias-lens spike + roll-out
script. Standalone — independent of D1 (vault → CF) and D2
(creaseworks → CF), which have no overlap with CSP.

## What this doc is NOT

- Not an implementation plan. Just inventory + recommendation.
- Not a blocker for launch. The audit's `'unsafe-inline'` finding is
  classified `should-fix`, not `must-fix`.
- Not a single-app problem. Whatever path we pick must work uniformly
  across all 18 Next.js origins.

## Cross-references

- `docs/security/launch-audit-2026-04-26.md` — the audit that
  surfaced these findings (22 should-fix items, 7 of which are
  unsafe-inline-related).
- `docs/security/cf-headers-wrapper.md` — the wrapper pattern
  any nonce migration has to extend.
