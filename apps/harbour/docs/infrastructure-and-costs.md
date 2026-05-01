# infrastructure, services, and cost management

> last updated: 2026-04-25

## the $200 vercel bill — what happened

on the Pro plan ($20/month), every `git push` to the monorepo triggered **up to 10 parallel Vercel deployments** — one per project. even with `turbo-ignore` canceling irrelevant builds, each canceled build still spun up a machine, cloned the repo, ran `npm install`, and checked turbo-ignore (~17s each). during the March 15 conference-experience sprint (~15 pushes in one day), that meant ~150 build attempts in a single day.

additionally, the GitHub Actions `sync-notion.yml` bot pushed daily commits that triggered all 10 projects.

### what we fixed (2026-03-18)

| change | impact |
|--------|--------|
| spending cap set to $10 on-demand (max $30/month total) | prevents runaway bills |
| `[skip ci]` added to notion sync bot commit message | eliminates ~10 wasted builds/day |
| disconnected **nordic-sqr-rct** from Git | -1 build per push (stable, rarely changes) |
| disconnected **deep-deck** from Git | -1 build per push (stable, rarely changes) |
| disconnected **harbour** from Git | -1 build per push (merged into site conceptually) |

**result**: each push now triggers ~6 builds instead of ~9-10, and the daily bot push triggers zero.

---

## services audit

### paid services

| service | plan | monthly cost | used by |
|---------|------|-------------|---------|
| **Vercel** | Pro | $20 + on-demand (capped at $10) | all apps |
| **Neon** (postgres) | free or starter | $0-$19 | creaseworks, vertigo-vault, depth-chart |
| **Stripe** | pay-per-transaction | variable | creaseworks, vertigo-vault |
| **Cloudflare R2** | standard | ~$0 at low volume (free 10GB) | creaseworks, vault, harbour, site (shared `creaseworks-evidence` bucket); ISR caches for harbour + depth-chart |
| **Cloudflare Workers** | free / paid-as-needed | $0 at current volume | wv-site, wv-harbour-harbour, wv-harbour-depth-chart, plus 11 threshold-concept apps + paper-trail/mirror-log/raft-house/tidal-pool/deep-deck |
| **Resend** (email) | free or starter | $0-$20 | creaseworks, vertigo-vault, depth-chart |
| **Anthropic** (claude API) | pay-per-token | variable | pocket.prompts, depth-chart, vertigo-vault |
| **Upstash Redis** (via Vercel KV) | free tier | $0 | pocket.prompts (token store) |

### free services

| service | used by | notes |
|---------|---------|-------|
| **GitHub** (repo + Actions) | all | public repo, Actions minutes are free |
| **Notion** (CMS) | creaseworks, vertigo-vault, pocket.prompts, nordic-sqr-rct | internal integration token |
| **Google OAuth** | creaseworks, vertigo-vault | standard OAuth2, no cost |
| **Auth.js** | creaseworks, vertigo-vault, depth-chart | open source, no cost |
| **Slack** | pocket.prompts | workspace bot integration |

### service dependency matrix

| service | creaseworks | vertigo-vault | pocket.prompts | depth-chart | harbour | site | nordic-sqr-rct | deep-deck | tidal-pool | paper-trail | mirror-log |
|---------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| Neon | x | x | | x | | | | | | | |
| Stripe | x | x | | | | | | | | | |
| Cloudflare R2 | x | x | | | | | | | | | |
| Notion | x | x | x | | | | x | | x | x | |
| Resend | x | x | | x | | | | | | | |
| Anthropic | | x | x | x | | | | | | | |
| Google OAuth | x | x | | | | | | | | | |
| Auth.js | x | x | | x | | | | | | | |
| Slack | | | x | | | | | | | | |
| Upstash KV | | | x | | | | | | | | |

### env vars by app

**creaseworks**: POSTGRES_URL, POSTGRES_URL_NON_POOLING, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, RESEND_API_KEY, NOTION_TOKEN, NOTION_DB_*

**pocket.prompts**: ANTHROPIC_API_KEY, NOTION_TOKEN, SLACK_BOT_TOKEN, SLACK_OAUTH_CLIENT_ID, SLACK_OAUTH_CLIENT_SECRET, SLACK_TEAM_ID, KV_REST_API_URL, KV_REST_API_TOKEN

**depth-chart**: POSTGRES_URL, AUTH_SECRET, ANTHROPIC_API_KEY, RESEND_API_KEY, NOTION_TOKEN

**vertigo-vault**: POSTGRES_URL, AUTH_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, STRIPE_SECRET_KEY, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, RESEND_API_KEY, ANTHROPIC_API_KEY, NOTION_TOKEN

**tidal-pool**: NOTION_TOKEN, NOTION_DB_TIDAL_ELEMENTS, NOTION_DB_TIDAL_SCENARIOS

**paper-trail**: NOTION_TOKEN, NOTION_DB_PAPER_TRAIL_ACTIVITIES

**mirror-log**: (none — client-only, reads from shared localStorage)

---

## cloudflare infrastructure (added 2026-04-25)

### accounts
- **garrett's CF account** — sole active account. hosts all Workers, R2 buckets, KV, Pages.
- ~~**anotheroption account**~~ — emptied 2026-04-25 (R2 buckets migrated). safe to close any time.

### R2 buckets (garrett account)
| bucket | purpose | public URL |
|---|---|---|
| `creaseworks-evidence` | canonical image bucket — creaseworks evidence + vault + harbour tile images + site assets | `https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev` |
| `wv-harbour-cache` | OpenNext ISR cache for `wv-harbour-harbour` | (internal) |
| `wv-depth-chart-cache` | OpenNext ISR cache for `wv-harbour-depth-chart` | (internal) |
| `port-assets` | port (CRM) assets | (internal) |

**old `pub-c685a810f5794314a106e0f249c740c9.r2.dev` is now broken** (lived on the migrated-out anotheroption account). update any remaining references to point at `pub-60282cf378c248cf9317acfb691f6c99.r2.dev`.

### CF Workers in production (garrett account)
- `wv-site` — replaces deleted Vercel `windedvertigo-site` project
- `wv-harbour-harbour` — harbour hub
- `wv-harbour-depth-chart` — direct routes for `windedvertigo.com/harbour/depth-chart/*`
- 11 threshold-concept apps
- `paper-trail`, `mirror-log`, `raft-house`, `tidal-pool`, `deep-deck`

---

## vercel project status

| project | git-connected | builds on push | notes |
|---------|:---:|:---:|-------|
| creaseworks | yes | yes (turbo-ignore) | main product, 3 cron jobs |
| ~~windedvertigo-site~~ | — | — | **deleted 2026-04-25** — migrated to CF Workers (`wv-site`). one fewer build per monorepo push. |
| pocket-prompts | yes | yes (turbo-ignore) | serverless functions (Anthropic SDK) |
| vertigo-vault | yes | yes (turbo-ignore) | Next.js + Neon + Stripe |
| depth-chart | yes | yes (turbo-ignore) | Next.js + Anthropic SDK |
| **harbour** | **migrated to CF Workers 2026-04-25** | no | now `wv-harbour-harbour` on Cloudflare Workers; deploy via `cd apps/harbour && npx opennextjs-cloudflare build && deploy` |
| **nordic-sqr-rct** | **disconnected** | no | stable, deploy manually via `vercel --prod` |
| **deep-deck** | **disconnected** | no | stable, deploy manually via `vercel --prod` |
| **tidal-pool** | **disconnected** | no | Next.js + Notion (elements/scenarios DBs), deploy via `scripts/deploy-tidal-pool.sh` |
| **paper-trail** | **disconnected** | no | Next.js + Notion (activities DB) + camera API, deploy via `scripts/deploy-paper-trail.sh` |
| **mirror-log** | **disconnected** | no | Next.js client-only (shared localStorage), deploy via `scripts/deploy-mirror-log.sh` |
| **values-auction** | **disconnected** | no | Vite SPA (Lit 3 + ws), deploy via `scripts/deploy-values-auction.sh`. static assets only, no serverless functions — negligible cost impact. |
| conference-experience | never connected | no | CLI-deployed once |
| automations | separate branch | manual | weekly summary serverless function |

---

## how to deploy disconnected projects

when a project is disconnected from Git, pushes to the monorepo no longer trigger builds for it. the existing deployment stays live. to deploy changes:

### option 1: vercel CLI (recommended)

```bash
# from the monorepo root
cd apps/harbour          # or deep-deck, nordic-sqr-rct
vercel --prod            # deploys to production
```

this builds locally and uploads to Vercel. no git connection needed.

### option 2: reconnect temporarily

if you need preview deployments for a sprint on a disconnected project:
1. go to the project's Settings > Git in Vercel dashboard
2. click "GitHub" and reconnect to `ghandoff/windedvertigo`
3. do your work with normal push-to-deploy
4. disconnect again when the sprint is done

### what changes in your workflow

| before (connected) | after (disconnected) |
|---------------------|----------------------|
| `git push` auto-deploys | `git push` does nothing for this project |
| preview URLs on PRs | no preview URLs (use `vercel` CLI for previews) |
| production deploys on merge to main | run `vercel --prod` manually |
| every monorepo push burns build minutes | zero build minutes consumed |

### when to reconnect vs. stay disconnected

- **reconnect** if the project enters active development (multiple deploys/week)
- **stay disconnected** if it's stable and only needs occasional updates
- **rule of thumb**: if you're not touching it this week, disconnect it

---

## best practices to keep costs low

### 1. batch your pushes

during active development sprints, avoid pushing after every small commit. instead:
- make multiple commits locally
- push once when you have a logical chunk of work

each push triggers ~5 builds (4 connected projects after windedvertigo-site deletion 2026-04-25 + turbo-ignore checks). pushing 3x instead of 15x saves ~60 wasted build attempts.

### 2. use `[skip ci]` for non-code commits

add `[skip ci]` to any commit message where you don't need Vercel to build:
- content-only changes (JSON data, copy updates)
- documentation changes
- config changes that don't affect deployed apps

vercel respects `[skip ci]` and skips all project builds for that push.

### 3. disconnect dormant projects

if a project hasn't been deployed in >2 weeks, disconnect it from Git. reconnect when you need it.

### 4. watch the Vercel billing dashboard

check `vercel.com/ghandoffs-projects/~/settings/billing` periodically. the spending cap is set to $10 on-demand, so your max bill is $30/month. if you hit the cap, Vercel will pause production deployments — you'll need to either wait for the next billing cycle or raise the cap.

### 5. monitor cron job costs

creaseworks has 3 cron jobs that consume serverless function invocations:
- `sync-notion` (daily 6 AM UTC)
- `send-digests` (Monday 9 AM UTC)
- `send-nudges` (daily 8 AM UTC)

these are lightweight but count toward the 1M invocation limit on Pro.

### 6. anthropic API costs are separate

the claude API charges are billed by Anthropic, not Vercel. pocket.prompts uses `claude-opus-4-6` for intent detection — this is the most expensive model. monitor usage at console.anthropic.com. **never downgrade pocket.prompts to sonnet** — it's a deliberate choice for accuracy.

---

## critical constraints

- **pocket.prompts model**: must use `claude-opus-4-6` for intent detection. do not downgrade.
- **shared auth cookies**: creaseworks and vertigo-vault share session cookies on `.windedvertigo.com`. changes to `AUTH_SECRET` in one will break sessions in the other.
- **site rewrites**: the site (now on `wv-site` CF Worker) proxies `/harbour/*` to per-app workers. rewrites live in the sibling `ghandoff/windedvertigo` repo. if a harbour app's URL changes, update rewrites there and redeploy `wv-site`.
- **neon connection pooling**: always use `POSTGRES_URL` (pooled) for app connections and `POSTGRES_URL_NON_POOLING` (direct) only for migrations.

---

## security audit log

### 07 april 2026 — full sweep across all four local repos

triggered by github dependabot email about **CVE-2026-39363** (vite arbitrary file read via dev server websocket).

| repo | before | after | notes |
|---|---|---|---|
| harbour-apps | 5 (3 mod, 2 high) | 4 dev-only | vite CVE patched. remaining 4 alerts all in `partykit → miniflare/undici/esbuild` chain (raft-house). zero production exposure — partykit is local dev only. **waiting upstream**. |
| windedvertigo | 4 (2 mod, 2 high) | **0** | bumped `@anthropic-ai/sdk` 0.80 → 0.84 in `crm/` (patches GHSA-5474-4w2j-mq4c memory tool sandbox escape). path-to-regexp, picomatch, brace-expansion auto-fixed. |
| nordic-sqr-rct | 6 (2 mod, 4 high) | **0** | clean. |
| pocket-prompts/backend | 17 (1 low, 8 mod, 8 high) | 15 dev-only | bumped `@anthropic-ai/sdk` 0.78 → 0.84. remaining 15 are **all** transitive deps of `vercel` CLI 41 (devDependency). vercel 50 actually brings *more* vulns (30), so we held at 41. **dev-only, never reaches production**. future fix: remove `vercel` from devDependencies and rely on globally-installed CLI. |
| pocket-prompts/backend/mcp | 2 (1 mod, 1 high) | **0** | clean. |
| pocket-prompts/app | 5 (2 mod, 3 high) | **0** | clean. |

**production runtime exposure: zero across all repos.**

**known dev-only exceptions tracked here:**
1. `harbour-apps` — partykit chain in raft-house (4 alerts). **investigated 07 apr 2026:** partykit is load-bearing for raft-house's multiplayer backend (`apps/raft-house/party/room.ts` is a full `Party.Server` class). vulnerable chain (`miniflare/undici/esbuild`) is in the local emulator, not runtime. `partykit@0.0.115` is the latest published version — **no upgrade path exists**, package appears dormant. options to eliminate: (a) wait for upstream partykit release, (b) migrate raft-house to liveblocks / cloudflare durable objects directly / pusher (multi-day rewrite). holding for now.
2. `pocket-prompts/backend` — vercel CLI 41 transitives (15 alerts). next check: evaluate removing vercel from devDependencies entirely.

**also verified:** 19/20 harbour apps have static CSP in `next.config.ts`. vertigo-vault uses **per-request CSP with nonce + strict-dynamic** in `proxy.ts` (stricter — gold standard).

**next sweep due:** 07 july 2026 (quarterly), or sooner if dependabot pages.

### 25 april 2026 — CF migration credential hygiene

- **revoke when stable**: CF API token "Edit Cloudflare Workers" (Workers Scripts:Edit, R2:Edit, Pages:Edit) created today for autonomous deploys. fall back to `wrangler login` for normal flow once new CF Workers topology is stable.
- **delete now**: DNS API token (cfut_H1x9...903e3, redacted — see vault/keepass for full value if revocation hasn't happened yet) — DNS work is settled, token no longer needed.
- **close when convenient**: anotheroption Cloudflare account — emptied today (R2 migrated to garrett's account). nothing depends on it.
