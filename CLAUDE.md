# windedvertigo — claude code conventions

> auto-loaded by Claude Code when working in this directory.
> sibling repo: `harbour-apps` (one level up). See `harbour-apps/CLAUDE.md`
> for the full conventions; this file covers what's specific to
> windedvertigo + cross-repo gotchas.

## what lives here

- **site/** — the main `windedvertigo.com` Next.js app (deployed to CF
  as the `wv-site` Worker). Owns the marketing site, harbour landing
  page, contribution forms like the regenerative practices catalogue.
- **apps/harbour/** — a parallel checkout of harbour sub-apps mirrored
  from `harbour-apps/`. Some files here are staging-edits that haven't
  yet been moved into the canonical repo. Don't assume parity — check
  both before claiming a file is the source of truth.
- **port/** — internal AI proposal tooling, kanban, harbour ops.
- **apps/ppcs-impact/** — PPCS 2026 engagement dashboard
  (windedvertigo.com/portfolio/ppcs-2026-impact). D1-backed; no PII.
  Config: `wrangler.jsonc`. Assets in `./assets/` (index.html + ppcs-icons/ + ppcs-assets/).
  Deploy: `cd apps/ppcs-impact && npm run deploy` (or CI auto-deploys on push to main).
  Data refresh (no redeploy): `bash scripts/refresh_d1.sh` — recomputes from the engagement DB
  and pushes aggregate JSON to D1. **Do not edit the Google Drive copy** — this repo is the
  single source of truth. The Drive copy is a read-only backup.
- **ops/**, **research/**, **strategy-*.md** — winded.vertigo company
  ops + documents (not code).

## session protocol (cross-conversation hygiene)

Multiple Claude Code conversations against this repo and its sibling
`harbour-apps` have caused changes to revert. The three habits that
fix it:

1. **Start every session with `git pull --rebase origin main`** before
   touching anything. Stops work on a stale base.

2. **End every session by committing + pushing**, even incrementally.
   Open a PR (or admin-merge for solo) before closing the conversation.
   The `/end-of-day-sync` skill automates this.

3. **Kill long-lived branches.** Branches older than ~3 days are debt.
   Get unfinished work to a shippable state and merge, then continue
   on a fresh short-lived branch. The `/branch-cleanup` skill audits.

For parallel work on the same repo, use `git worktree add` so each
conversation gets its own physical working directory.

## harbour-nav widget (served from wv-site again as of 2026-05-28)

`harbour-nav-widget.js` + `harbour-apps.json` are served from
**`site/public/`** (this repo) via wv-site's `windedvertigo.com/*` route.

**History / why:** 2026-05-27 these were moved to a dedicated
`wv-harbour-nav-cdn` Worker with specific routes
(`windedvertigo.com/harbour-nav-widget.js` etc.) that were supposed to
beat wv-site's `/*` catchall. On 2026-05-28 those routes stopped winning
at the CF edge despite being correctly registered in the zone route table
(verified via API: path → `wv-harbour-nav-cdn`, no duplicates, worker
healthy on `*.workers.dev`, response not cached, 6+ min elapsed) — wv-site
kept serving its 404 for both paths, so the universal navbar 404'd on every
static app. Root cause unresolved (CF routing anomaly). Fix: re-host the
two files in `site/public/` (wv-site `/*` serves them reliably) and the
conflicting CDN routes were removed to avoid a future dual-host etag race.

**To update the widget:** rebuild the bundle in `harbour-apps`
(`npm run rebuild-nav`; source `packages/auth/harbour-nav-vanilla.tsx`),
then copy both artifacts here and redeploy wv-site:
`cp harbour-apps/apps/harbour-nav-cdn/public/{harbour-nav-widget.js,harbour-apps.json} site/public/`
→ `cd site && npm run deploy:cf`. (The `wv-harbour-nav-cdn` worker still
exists / serves on `*.workers.dev` as a backup but no longer owns the
custom-domain routes.)

## deployment

- **wv-site** (this repo's `site/`) deploys to CF Workers via
  `cd site && npm run deploy:cf`. That script chains:
    `opennextjs-cloudflare build` → `node scripts/write-assets-headers.mjs` → `opennextjs-cloudflare deploy`.
  The middle step writes `.open-next/assets/_headers` so content-hashed
  `_next/static/*` chunks are served with `Cache-Control: public,
  max-age=31536000, immutable`. **Do not skip it** — without it CF's
  static-assets binding sets `max-age=0, must-revalidate`, which forces
  browsers to revalidate every JS/CSS chunk on every navigation
  (Lighthouse drops, repeat-visit perf collapses, CF edge cache HIT-rate
  drops). Same pattern as harbour-apps (see
  `harbour-apps/packages/security/scripts/write-assets-headers.mjs`).
  Requires `CLOUDFLARE_API_TOKEN` in env or `site/.env`.
- **routes claimed by wv-site**: `windedvertigo.com/*` and `www.windedvertigo.com/*`.
- Other workers (depth-chart, read-the-room, vault auth subtree, etc.)
  claim specific subpaths and override wv-site for those paths.

### ISR + edge caching (don't make content pages dynamic)

- **ISR cache backend is KV** (`open-next.config.ts` → `kvIncrementalCache`,
  binding `NEXT_INC_CACHE_KV`, namespace `wv-site-next-cache`). The build's
  populate step needs `CLOUDFLARE_API_TOKEN` in env — it runs automatically
  inside `npm run deploy:cf`. Do NOT revert to `staticAssetsIncrementalCache`
  (read-only — pages re-render from scratch on every stale request).
- **A page with `export const revalidate = N` is only actually cached if it
  renders statically.** Reading `searchParams`, `cookies()`, or `headers()`
  in a server component silently flips the page to per-request dynamic
  rendering — `revalidate` is ignored, the response becomes
  `Cache-Control: private, no-store`, and CF edge can't cache it. Under
  concurrency that page re-renders (and re-hits Notion) on every request.
  We hit this on `/harbour/regenerative-practices-catalogue`: a single
  `?v=` palette flag forced the whole page dynamic. 50-burst p95 was
  ~1.95s. Moving the flag client-side (the page reads no searchParams) made
  it static → `s-maxage=300, stale-while-revalidate`, served from edge/KV →
  50-burst p95 dropped to ~700ms. **Rule: keep `/harbour/*` content pages
  free of server-side per-request inputs; handle UI flags client-side.**

## conventions inherited from harbour-apps

- Lowercase UI copy, british spelling, oxford comma, kebab-case files.
- Brand name: always `winded.vertigo` (lowercase with period).
- All other writing/coding conventions per `../harbour-apps/CLAUDE.md`.

## git workflow

- Always rebase before push, never amend published commits.
- Branch naming: `feat/`, `fix/`, `chore/`.
- Commit style: `type(scope): concise summary`.
- Branch protection requires review on PRs; for solo work use
  `gh pr merge --admin --squash --delete-branch`.

## services in use

- Cloudflare Workers (wv-site + ~17 harbour worker apps)
- Cloudflare R2 (creaseworks-evidence bucket, harbour-tiles prefix)
- Notion (CMS for site content, portfolio, regenerative practices catalogue)
- Anthropic (Claude API via port for AI proposals)
- Resend (email via wv-site for booking confirmations)

Full service inventory and cost discipline is in
`../harbour-apps/docs/infrastructure-and-costs.md`.

## AI agents

winded.vertigo has four AI agents that serve the collective. each has a plugin for cowork sessions and an API-backed memory layer on port.windedvertigo.com.

### accessing the agents in Cowork (remote MCP + OAuth)

Cowork (Claude Desktop) can't run the local plugin servers, so the agents are also
served as a **remote MCP connector** with "sign in with winded.vertigo" (OAuth).
Teammates add ONE custom connector and sign in — see `docs/plugins/REMOTE-MCP-SETUP.md`.

- **Connector URL (Cowork):** `https://port.windedvertigo.com/api/mcp/agents/all`
  (all four agents' tools incl. opsy_*; leave the OAuth client-id/secret fields blank →
  click Connect → Google sign-in → approve). Per-agent URLs `…/agents/{mo,pam,carl,opsy}`
  remain for Claude Code (static `WV_AGENT_TOKEN`).
- **Where it lives:** the MCP shim is `port/app/api/mcp/agents/[agent]/route.ts`; the
  in-house OAuth server (RFC 9728/8414 discovery metadata, RFC 7591 dynamic client
  registration, PKCE `/authorize` that reuses the Auth.js Google login + a one-click
  consent, `/token`) is `port/app/api/oauth/*` + `port/lib/oauth/*`. Access tokens are
  stateless HS256 JWTs signed with `NEXTAUTH_SECRET`; KV namespace `OAUTH_KV` holds
  only short-lived auth codes + registered clients.
- **⚠️ Cloudflare WAF carve-out — do NOT delete.** The `windedvertigo.com` zone blocks
  AI-bot user-agents (`ClaudeBot` / `anthropic-ai` / `Claude-User`). Anthropic's MCP
  connection uses one of those UAs, so the WAF custom rule **"allow anthropic mcp +
  oauth on api paths"** skips bot/managed protection for `/api/mcp/`, `/api/oauth/`,
  and `/.well-known/oauth` ONLY. Remove it and Cowork connections silently fail with
  *"the integration rejected the credentials"* — while the marketing site keeps full
  AI-scraper protection. (The OAuth handshake will look perfect in logs; the block is
  Cloudflare rejecting Anthropic's validation call before it reaches the worker.)

### Mo (CMO)

chief marketing officer. strategy, brand, pipeline, campaigns.
brain: `docs/cmo/` · dashboard: port.windedvertigo.com/strategy
plugin: `docs/plugins/dist/mo-cmo.plugin`

**to talk to Mo:**
- in claude code: `cd docs/cmo` and start talking, or say "I want to talk to Mo"
- in cowork: install the mo-cmo plugin, start a session, Mo loads context automatically

**the coherence protocol:** after decisions are made in any conversation, append to `docs/cmo/decisions-log.md` and push. Mo's MCP server writes to the API automatically when the plugin is installed.

### PaM (PM)

project + momentum manager. tracks commitments, dependencies, follow-ups.
brain: `docs/pam/`
plugin: `docs/plugins/dist/pam-pm.plugin`

**to talk to PaM:**
- in claude code: `cd docs/pam` and start talking, or say "I want to talk to PaM"
- in cowork: install the pam-pm plugin, ask "what's on my plate?" or "what did the whirlpool decide?"

note: PaM is in a trial period (june 4 – june 17) with supabase as the task backend. see `docs/pam/migration-plan.md` for the planned switch to clickup/linear after august's evaluation.

### cARL (research)

cyber agent of research + learning. literature, evidence base, threshold concepts.
brain: `docs/carl/`
plugin: `docs/plugins/dist/carl-research.plugin`

**to talk to cARL:**
- in claude code: `cd docs/carl` and start talking, or say "I want to talk to cARL"
- in cowork: install the carl-research plugin, ask "what does cARL know about [topic]?"

### Opsy (ops)

operations + systems intelligence. monitors infrastructure health across 4 tiers
(every 5 min for core platforms), captures stack notifications, auto-fixes safe
issues (cron re-runs), and learns recurring failure patterns.
brain: `docs/opsy/` · dashboard: port.windedvertigo.com/ops
plugin: `docs/plugins/dist/opsy-ops.plugin`

**to talk to Opsy:**
- in claude code: `cd docs/opsy` and start talking, or say "I want to talk to Opsy"
- in cowork: install the opsy-ops plugin, ask "what's the health of our stack?"
  or "any incidents this week?"

alerts route to #ops-alerts (critical also DMs garrett). incidents, health
checks, auto-fixes, and patterns persist in wv-port-pilot (`opsy_*` tables).

**all four agents share a memory API** on port.windedvertigo.com (`/api/cmo/`, `/api/pam/`, `/api/carl/`, `/api/opsy/`). decisions are transparent — see the mo-log tab on the strategy page.

## file output rules (ALL conversations)

**never write files to google drive or cowork output folders.** all files — prompts, documents, HTML tools, configs — go into the monorepo at `~/Projects/windedvertigo/` (or the mounted equivalent). the google drive shared folder (`winded.vertigo`) is NOT the monorepo and is NOT where claude code can find things.

specific paths:
- **claude code prompts** → `docs/prompts/` (version-controlled, findable by claude code)
- **agent posture/memory** → `docs/{agent}/` (e.g. `docs/cmo/`, `docs/pam/`, `docs/carl/`)
- **HTML tools/apps** → `site/public/tools/{name}/index.html` (deployable to CF)
- **documentation** → `docs/` or the relevant subdirectory
- **temporary working files** → `/tmp` or the cowork scratchpad, NOT the mounted folder

this applies to garrett, maria, payton, jamie, lamis — every conversation that creates files should put them in the monorepo, not in google drive. google drive sync + claude = lost files and confusion.
