# session notes — claude agent reflections

these notes capture what was learned across the build sessions for future
reference, especially after conversation compaction.

---

## environment constraints

- **cowork vm mount path** — the creaseworks project is mounted from the host
  at `/Users/garrettjaeger/Projects/creaseworks` into the vm at
  `/sessions/kind-happy-dijkstra/mnt/Projects--creaseworks`. if the mount goes
  stale (files not found), use the `request_cowork_directory` tool to re-mount
  the same host path. the `.git` directory is not visible through the mount, so
  git operations must be run by the user in their local terminal.

- **no node.js on the cowork vm** — the linux sandbox doesn't have node
  installed, so `npm`, `npx`, `next build`, and local dev servers are all
  unavailable. all database work is done via the neon console sql editor in
  chrome; all code commits go through the github web editor or the user's
  local terminal.

- **no git credentials on the vm** — `git push` fails with "could not read
  Username". the workaround is either committing files one-by-one through the
  github web editor at `github.com/{owner}/{repo}/edit/main/{path}`, or
  having the user run git commands locally from their terminal.

- **stripe checkout page blocks browser tools** — all browser automation tools
  (screenshot, read_page, get_page_text) time out on `checkout.stripe.com` due
  to heavy javascript. the user must complete stripe test payments manually.

## github web editor — codemirror paste behaviour

this was the single biggest time-sink and worth documenting carefully for future
sessions.

### what works

1. **`document.execCommand('selectAll')` then `document.execCommand('delete')`**
   reliably clears the editor to an empty state.

2. **`ClipboardEvent('paste')` with `DataTransfer`** reliably inserts content
   into an empty editor (after the delete step above).

3. **splitting content into multiple paste operations** works — codemirror
   appends each paste at the cursor position, so pasting part 1 then part 2
   then part 3 produces the correct file.

4. **`String.fromCharCode(96)`** produces a backtick character without needing
   to escape it inside javascript template literals. critical for files
   containing jsx template literals like `` `get ${pack.title}` ``.

### what does NOT work

- **`ClipboardEvent('paste')` on a selection** — even after selecting all
  content with `DOM range.selectNodeContents()`, the paste event *prepends*
  content instead of replacing it. this produces a doubled file. the solution
  is always to delete first, then paste into the empty editor.

- **`document.execCommand('insertText')` with large content** — times out
  after 30 seconds because codemirror does expensive syntax highlighting on
  the inserted text. works for small files but fails for anything over ~80
  lines.

- **accessing `cmView.view` on the codemirror dom element** — github's
  codemirror 6 setup doesn't expose the editor view through any accessible
  property on the dom element. `Object.keys()` and
  `Object.getOwnPropertySymbols()` both return empty arrays.

- **javascript template literal escaping** — when the file content itself
  contains backticks (e.g. jsx template literals), wrapping the js string in
  backticks requires `\`` which produces `\"` in the output. use
  `String.fromCharCode(96)` + string concatenation instead.

### recommended recipe for future sessions

```javascript
// 1. focus and clear
const el = document.querySelector('.cm-content');
el.focus();
document.execCommand('selectAll');
document.execCommand('delete');

// 2. build content with string concat (avoid template literals for backticks)
var c = 'line 1\n';
c += 'line with ' + String.fromCharCode(96) + 'backticks' + String.fromCharCode(96) + '\n';

// 3. paste via ClipboardEvent
const dt = new DataTransfer();
dt.setData('text/plain', c);
const pe = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
el.dispatchEvent(pe);
```

for large files, split content into multiple paste operations (each under ~2000
chars) to avoid codemirror lag.

## vercel deployment notes

- **hobby plan** — builds time out at 45s, so the codebase needs to stay lean.
  current builds complete in ~34s.
- **each github commit triggers a new deployment** — when committing 4 files
  separately through the web editor, this creates 4 deployments. only the last
  one matters since each supersedes the previous.
- **ISR with `revalidate = 3600`** — pages cache for 1 hour after first
  request. `force-dynamic` ensures no build-time rendering (db isn't available
  at build time).

## database notes (neon)

- project: `divine-dust-87453436`, branch: `br-green-cherry-air8nyor`
- tables use `_cache` suffix pattern: `patterns_cache`, `packs_cache`,
  `materials_cache` — these are synced from notion
- join table: `pack_patterns` (pack_id, pattern_id)
- entitlements: org-level, linked to purchases via `purchase_id` FK
- the table is `packs_cache` not `packs` — queries referencing plain `packs`
  will fail with "relation does not exist"

## security model

- **three tiers**: teaser (public), entitled (purchased), internal (never sent)
- **column selectors** in `src/lib/security/column-selectors.ts` define which
  columns are fetched for each tier
- **`assertNoLeakedFields`** in `src/lib/security/assert-no-leaked-fields.ts`
  is a runtime guard — no-op in production, throws in dev/staging if response
  rows contain forbidden fields
- both mechanisms are now wired into all pattern and pack query functions

## what was built across sessions

> for full build status and feature completion, see [`PROJECT-STATUS.md`](PROJECT-STATUS.md).
> this section only captures session-specific implementation notes worth preserving.

### session 3 — security wiring
- `assertNoLeakedFields` wired into `patterns.ts` and `packs.ts` queries
- sampler find-again teaser: conditional on `has_find_again`, links to
  specific pack via `getFirstVisiblePackForPattern()` query

### session 4 — google workspace SSO
- fixed `OAuthAccountNotLinked` error by adding `allowDangerousEmailAccountLinking: true`
  to the google provider config (commit `b857562`)
- auth.js v5 requires POST (not GET) to initiate sign-in — the login page's form-based
  button handles this correctly

### session 5 — stripe verification + team management
- middleware exempts `/api/stripe/webhook` from rate limiting and auth
- stripe checkout page blocks all browser automation tools — user must complete payments manually

## additional environment learnings

- **vercel dashboard screenshots time out** — just like `checkout.stripe.com`,
  the vercel deployments page is too heavy for browser automation tools.
  workaround: verify deployments by loading the live site directly
  (`creaseworks.windedvertigo.com/sampler`) and confirming it renders without
  errors, rather than trying to screenshot the vercel dashboard.

- **creating new files via github web editor** — use the URL pattern
  `github.com/{owner}/{repo}/new/main?filename=path/to/file.md`. this opens
  an empty codemirror editor with the path pre-filled. since the editor starts
  empty, you can skip the `selectAll` + `delete` step and paste directly.

- **conversation compaction** — sessions get compacted after ~100k tokens. the
  compaction summary preserves file contents and key decisions but loses exact
  error messages and intermediate debugging steps. the SESSION-NOTES.md file
  is the primary recovery mechanism — keep it updated at the end of each
  session so the next session (or compacted continuation) can pick up smoothly.

### remaining post-mvp items
see PROJECT-STATUS.md phase 2 and DESIGN.md section 11 "future (post-MVP)" for current status.

### session 6 — security audit + fixes

**audit performed**: full pre-launch audit covering 76 TypeScript source files, 4 SQL
migrations, and all config. generated `creaseworks-audit-report.docx` with 18 findings
(2 critical, 4 high, 7 medium, 5 low).

**fixes pushed to github (6 files)**:
1. `src/app/api/webhooks/notion/route.ts` — C1: NODE_ENV guard on webhook signature bypass
2. `next.config.ts` — C2: security headers (X-Frame-Options, HSTS, etc.)
3. `src/lib/sync/incremental.ts` — H2: transaction wrapping on all upsert functions
4. `migrations/005_relax_ip_tier_not_null.sql` — H3: relax ip_tier NOT NULL constraint (NEW FILE)
5. `src/lib/queries/users.ts` — H4: default email_verified to FALSE
6. `src/lib/auth.ts` — H4: mark email verified on successful sign-in

**migration 005 run on neon production** — `ALTER TABLE patterns_cache ALTER COLUMN ip_tier DROP NOT NULL` executed successfully.

**vercel deployment verified** — latest commit `35b784b`, status: Ready (green).

**codemirror injection technique refined**:
- key property is `cmTile` (not `cmView`): `document.querySelector('.cm-content').cmTile.view`
- for large files: base64-encode content → inject via `new TextDecoder('utf-8').decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)))` → dispatch to CodeMirror view
- for new files: use `github.com/{owner}/{repo}/new/main/{dir}?filename={name}` — editor starts empty, no need for selectAll+delete

**remaining audit findings** (M1–M7, L1–L5): see PROJECT-STATUS.md for full list and current status.

### session 11 — desktop sync, next.js 16 proxy, commerce prep

**environment change**: garrett synced the creaseworks repo to his desktop
(previously all work was done on a laptop). `git pull --rebase origin main`
brought the desktop up to date. the cowork vm now mounts from
`/Users/garrettjaeger/Projects/creaseworks` — this is recorded in the
windedvertigo-site CLAUDE.md so it auto-loads every session.

**next.js 16 proxy migration**: `middleware.ts` → `proxy.ts`. the proxy
convention runs on node.js runtime instead of edge. this means:
- the getToken-instead-of-auth() workaround is no longer necessary (though
  we kept getToken for now since it works fine)
- the in-memory rate limiter benefits from longer warm processes
- the `npx @next/codemod upgrade 16` tool didn't auto-rename because the
  project was already on 16.1.6 — had to rename manually

**npm audit cleanup**: `npm audit fix --force` upgraded eslint to v10 and
downgraded eslint-config-next to 0.2.4. build still passes. all 15
vulnerabilities were dev-only (eslint transitive deps via minimatch).

**stripe promo codes**: one-line addition (`allow_promotion_codes: true`) in
`checkout.ts`. coupons are created in the stripe dashboard, not in code.

**free trial entitlements**: `grantEntitlement()` now accepts `expiresAt`,
the admin API accepts `trialDays`, and the grant form has a trial days
input. `checkEntitlement()` already handled expiry — no changes needed.

**business model**: reviewed the notion pricing spec with garrett. decisions
on pricing, pack structures, and launch strategy deferred pending colleague
discussion. the spec covers one-time packs, context packs, starter/loss
leader, complete library, seasonal drops, tiered pricing, subscriptions,
and promo mechanics. launch recommendation: 3–4 packs at fixed one-time
prices with LAUNCH40 coupon code.

**chrome extension instability**: claude in chrome disconnected repeatedly
throughout the session and could not be reconnected. stripe dashboard
walkthrough was done via manual guidance instead of browser automation.
