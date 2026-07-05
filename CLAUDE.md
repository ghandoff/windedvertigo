# windedvertigo — claude code conventions

> auto-loaded by Claude Code in this directory. Sibling repo `harbour-apps`
> (one level up) holds the full conventions — see `harbour-apps/CLAUDE.md`.
> This file covers windedvertigo specifics + cross-repo gotchas.
>
> **Keep this file to durable conventions.** Dated incident post-mortems and
> the full pre-2026-06-19 version live in `docs/decisions/` (complete snapshot:
> `docs/decisions/CLAUDE-full-snapshot-2026-06-19.md`). Add new war-stories there,
> not here — over-stuffed always-loaded rules anchor newer Claude versions.

## active sprint — creaseworks animation (remove after ~2026-07-19)

plan + state: `docs/prompts/creaseworks-animation-sprint.md` (sprint log + checkboxes)
· research: `research/creaseworks-animation-pipeline-options-2026-07.md`
· branch: `feat/animation-sprint` (draft PR #326).
if garrett says **"continue the animation sprint"**, that means: read the sprint
plan's log + checkboxes and the freshest handoff notes in `.brain/memory/handoff/`,
report where things stand, and propose the next step — wait for a go before building.

## what lives here

- **site/** — the main `windedvertigo.com` Next.js app (deployed to CF as the
  `wv-site` Worker). Marketing site, harbour landing, contribution forms.
- **apps/harbour/** — parallel checkout of harbour sub-apps mirrored from
  `harbour-apps/`. **Don't assume parity** — check both before claiming a file
  is the source of truth.
- **port/** — internal AI proposal tooling, kanban, harbour ops.
- **apps/ppcs-impact/** — PPCS 2026 engagement dashboard. D1-backed, no PII.
  Deploy: `cd apps/ppcs-impact && npm run deploy`. Data refresh (no redeploy):
  `bash scripts/refresh_d1.sh`. **This repo is the single source of truth — the
  Google Drive copy is a read-only backup; don't edit it.**
- **ops/, research/, strategy-*.md** — company ops + documents (not code).

## session protocol (cross-conversation hygiene)

Multiple Claude Code conversations against this repo and `harbour-apps` have
caused changes to revert. Three habits fix it:

1. **Start every session with `git pull --rebase origin main`.**
2. **End every session by committing + pushing** (PR, or admin-merge for solo).
   The `/end-of-day-sync` skill automates this.
3. **Kill long-lived branches** (older than ~3 days). `/branch-cleanup` audits.

For parallel work on the same repo, use `git worktree add`.

## deployment — merged ≠ deployed (the #1 recurring mistake)

**GitHub and Cloudflare are TWO SEPARATE STEPS.**

- **merge to `main`** = code saved / version-controlled. Production still serves OLD code.
- **deploy** (`cd <app> && npm run deploy:cf`) = the worker actually serves the new code.
- Vocabulary, every time: "merged" / "on main" = saved, not live. "deployed" /
  "live" / "serving" = Cloudflare, requires `npm run deploy:cf`. Never call a
  change "live" after only merging — it's **"merged, pending deploy."**
- **No CI deploys `port` or `wv-site` on push.** They deploy ONLY via manual
  `npm run deploy:cf`. CI auto-deploy exists only for `ppcs-impact`, `nordic`,
  `values-auction`.
- **Definition of done** for a `port`/`wv-site` change: merged ✓ → deployed
  (needs explicit user approval) ✓ → DB migration applied via the Supabase SQL
  editor if the change adds one ✓ → if MCP agent tools changed, user reconnects
  the agents connector in Cowork ✓.
- **Deploy-state check:** `curl -s https://port.windedvertigo.com/api/version` →
  compare the `built` timestamp to when you merged (use `built`, not `sha`).

## wv-site deploy specifics

- `cd site && npm run deploy:cf` chains build → `write-assets-headers.mjs` →
  deploy. **Don't skip the headers step** — without it content-hashed
  `_next/static/*` chunks lose `immutable` caching and repeat-visit perf
  collapses. Requires `CLOUDFLARE_API_TOKEN` in env or `site/.env`.
- Routes claimed by wv-site: `windedvertigo.com/*` and `www.windedvertigo.com/*`.
  Other workers override specific subpaths.
- **ISR cache backend is KV** (`open-next.config.ts` → `kvIncrementalCache`).
  Don't revert to `staticAssetsIncrementalCache` (read-only).
- **Keep `/harbour/*` content pages free of server-side per-request inputs.**
  Reading `searchParams`, `cookies()`, or `headers()` in a server component
  silently flips the page to per-request dynamic rendering — `revalidate` is
  ignored and edge caching dies. Handle UI flags client-side. (Background +
  the regenerative-practices-catalogue post-mortem: `docs/decisions/`.)

## harbour-nav widget

`harbour-nav-widget.js` + `harbour-apps.json` are served from **`site/public/`**
via wv-site's `/*` route (since 2026-05-28). To update: rebuild in `harbour-apps`
(`npm run rebuild-nav`), copy both artifacts to `site/public/`, redeploy wv-site.
(Why it's served here rather than a dedicated CDN worker: `docs/decisions/`.)

## Cloudflare WAF carve-out — do NOT delete

The `windedvertigo.com` zone blocks AI-bot user-agents. Anthropic's MCP
connection uses one, so the WAF rule **"allow anthropic mcp + oauth on api
paths"** skips bot protection for `/api/mcp/`, `/api/oauth/`, `/.well-known/oauth`,
and `/api/voice/`. Remove it and Cowork connections silently fail with
*"the integration rejected the credentials"* while the marketing site keeps full
scraper protection. `/api/voice/` is in the list because Vapi calls the
custom-llm endpoint as `OpenAI/JS` (an AI-bot UA) — drop it and voice calls
connect, greet, then die the instant you speak (the first LLM turn is blocked at
the edge, invisible to `wrangler tail`; check firewall events). Full
post-mortem + the diagnostic GraphQL query: `docs/decisions/2026-06-22-voice-agents-waf-block-and-stacked-bugs.md`.

## conventions inherited from harbour-apps

- Lowercase UI copy, british spelling, oxford comma, kebab-case files.
- Brand name: always `winded.vertigo` (lowercase with period).
- All other writing/coding conventions per `../harbour-apps/CLAUDE.md`.

## git workflow

- Always rebase before push, never amend published commits.
- Branch naming `feat/`, `fix/`, `chore/`; commits `type(scope): concise summary`.
- Solo merge: `gh pr merge --admin --squash --delete-branch`.

## services in use

Cloudflare Workers (wv-site + ~17 harbour worker apps), R2 (creaseworks-evidence
bucket), Notion (CMS), Anthropic (Claude API via port), Resend (email). Full
inventory + cost discipline in `../harbour-apps/docs/infrastructure-and-costs.md`.

## AI agents

Four agents serve the collective; each has a Cowork plugin + an API-backed
memory layer on port.windedvertigo.com.

- **Connector URL (Cowork):** `https://port.windedvertigo.com/api/mcp/agents/all`
  (leave OAuth client fields blank → Connect → Google sign-in → approve). Setup:
  `docs/plugins/REMOTE-MCP-SETUP.md`.
- **Mo (CMO)** — strategy, brand, pipeline. brain `docs/cmo/` · dashboard
  /strategy. After decisions, append to `docs/cmo/decisions-log.md` and push.
- **PaM (PM)** — commitments, dependencies, follow-ups. brain `docs/pam/`.
- **cARL (research)** — literature, evidence base, threshold concepts. brain `docs/carl/`.
- **Opsy (ops)** — infra health monitoring + incident capture. brain `docs/opsy/`
  · dashboard /ops. Alerts route to #ops-alerts.

All four share a memory API (`/api/{cmo,pam,carl,opsy}/`); decisions are
transparent on the strategy page's mo-log tab. Per-agent "how to talk to" notes
+ OAuth/MCP implementation detail: `docs/decisions/CLAUDE-full-snapshot-2026-06-19.md`.

## file output rules (ALL conversations)

**Never write files to Google Drive or Cowork output folders.** Everything —
prompts, documents, HTML tools, configs — goes in the monorepo at
`~/Projects/windedvertigo/`:

- claude code prompts → `docs/prompts/`
- agent posture/memory → `docs/{agent}/`
- HTML tools/apps → `site/public/tools/{name}/index.html`
- documentation → `docs/` or the relevant subdirectory
- temporary working files → `/tmp` or the cowork scratchpad, NOT the mounted folder

Applies to garrett, maria, payton, jamie, lamis — every conversation. Drive sync
+ claude = lost files and confusion.
