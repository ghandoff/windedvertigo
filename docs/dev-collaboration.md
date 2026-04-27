# dev collaboration handbook

> reference for garrett & maria — how the codebase is split across repos, what changed in the cloudflare migration, and the git workflow we use to avoid stepping on each other.
>
> last updated: 2026-04-27 (post values-auction error 1019 incident — see section 7 "case study" at the bottom).
>
> sections: (1) which repo owns which file · (2) vercel → cloudflare migration · (3) the tool chain · (4) secrets and access · (5) git workflow for shared repos · (6) common pitfalls · (7) case study · (8) ip & promotion when building for prme · (9) quick command reference.

---

## 1. which repo owns which file

we work across multiple repos under `~/Projects/`. before editing anything, check which repo you're in:

```bash
pwd                              # where am i?
git remote -v                    # which github repo is "origin"?
git rev-parse --show-toplevel    # what's the repo root?
```

| repo | github | what lives here |
|---|---|---|
| **harbour-apps** | `ghandoff/harbour-apps` | the app source: values-auction, systems-thinking, cuts-catalogue, rubric-co-builder, feel-cards, etc. each app has its own deploy config (`vite.config.ts`, `wrangler.toml`, `package.json`). |
| **windedvertigo** | `ghandoff/windedvertigo` | the site shell + routing: **`site/next.config.ts` (the rewrites that route `windedvertigo.com/*` to all the harbour apps)**, the main marketing site, port (CRM), ops dashboard. also where `.brain/` lives. |
| **pocket-prompts** | `ghandoff/pocket-prompts` | voice pipeline backend + mobile app |
| **nordic-sqr-rct** | `ghandoff/nordic-sqr-rct` | nordic SQR-RCT review platform |

**the most common confusion:** the apps live in `harbour-apps`, but the URL routing for those apps lives in `windedvertigo/site/next.config.ts`. when an app changes URL, BOTH repos may need updates:
- the app: deploy config, base path, env vars
- the site: a rewrite rule pointing at the app's new origin

**rule of thumb:** if you're editing how a URL is routed → `windedvertigo`. if you're editing the app itself → `harbour-apps`.

---

## 2. the vercel → cloudflare migration (2026-04-25)

we migrated the public-facing stack from vercel to cloudflare workers/pages. the apps that moved had three things change:

| before (vercel) | after (cloudflare) |
|---|---|
| `*.vercel.app` URLs (e.g. `values-auction-pi.vercel.app`) | `*.pages.dev` for static SPAs (e.g. `values-auction-d9m.pages.dev`) or `*.windedvertigo.workers.dev` for next.js apps via OpenNext |
| `vercel deploy` | `npx wrangler pages deploy dist --project-name <name>` (Pages SPAs) **or** `npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy` (OpenNext apps) |
| rewrite destinations in `site/next.config.ts` pointed at `*.vercel.app` | rewrite destinations now point at `*.pages.dev` or `*.windedvertigo.workers.dev` |

**which apps still on vercel:** port (CRM) `wv-crm`, creaseworks, vertigo-vault, nordic. these need workflow devkit / vercel blob features that don't exist on CF yet.

**which apps moved to CF:** site (`wv-site`), harbour hub (`wv-harbour-harbour`), depth-chart (`wv-harbour-depth-chart`), values-auction (`values-auction` Pages project + `wv-values-auction-relay` Worker), systems-thinking, and the long tail of harbour apps.

**finding URLs after the migration:**

```bash
npx wrangler pages project list                    # all CF Pages projects in the current account
npx wrangler deployments list --name <worker>     # recent deploys for a Worker
gh repo view ghandoff/<repo> --web                # open the repo in github
```

**the most dangerous habit post-migration:** typing `*.vercel.app` from muscle memory. before you add a rewrite or a fetch URL, search the codebase for the right destination — odds are it's already wired correctly somewhere.

```bash
grep -rn "values-auction" site/next.config.ts     # does this app already have a route?
```

---

## 3. the tool chain — what each CLI does

we have a small constellation of command-line tools. each does one specific thing. knowing which one you need for which job saves a lot of "why isn't this working."

### wrangler — cloudflare's CLI

`wrangler` is to cloudflare what `vercel` is to vercel. it's the deploy/inspect/manage tool for everything on the CF stack: workers, pages, KV, R2, durable objects, queues, D1.

**what we use it for:**

| command | does what |
|---|---|
| `npx wrangler login` | OAuth into your CF account. drops a token in `~/.wrangler/`. all subsequent commands act as you. |
| `npx wrangler whoami` | prints which account you're authenticated as — useful when you're not sure which account `wrangler` is acting on. |
| `npx wrangler pages project list` | list all CF Pages projects in the current account |
| `npx wrangler pages deploy dist --project-name <name>` | deploy a static SPA's `dist/` to a Pages project. used by every harbour app's `npm run deploy:spa` script. |
| `npx wrangler deploy` | deploy a worker (server-side code). reads `wrangler.toml` for config + bindings. used for `wv-values-auction-relay`, `wv-launch-smoke`, etc. |
| `npx wrangler dev` | local dev server emulating the CF runtime — including bindings (KV, R2, DO). use this before pushing to prod. |
| `npx wrangler tail <worker>` | live-stream production logs from a worker. invaluable for debugging "it works locally but breaks live." |

**`wrangler.toml` is the source of truth.** every worker has one. it declares `name`, `main` (entry point), `compatibility_date`, `account_id`, and bindings (durable objects, KV, R2). when you run `wrangler deploy`, it reads this file, packages your code, applies any DO migrations, and uploads. fixing a deploy usually means editing `wrangler.toml` (e.g. today's `new_classes` → `new_sqlite_classes` fix on the values-auction relay).

**why `npx` in front?** so the version pinned in the project's `package.json` is used (the relay is on wrangler 3.x; the harbour-apps root is on 4.x). a global wrangler install would override this and silently use the wrong version.

**openNext + wrangler:** `npx opennextjs-cloudflare deploy` for the site/harbour/depth-chart apps wraps wrangler under the hood. it builds the next.js app into a worker bundle, then calls `wrangler deploy`. you don't have to call wrangler directly for those, but knowing it's there helps when you're debugging.

### gh — github's CLI

`gh` is github wrapped in a terminal. used for everything git/github that isn't core git: PRs, issues, releases, repo metadata, CI run inspection.

| command | does what |
|---|---|
| `gh auth login` | OAuth into github. one-time per machine. |
| `gh pr create --fill` | open a PR from your current branch — `--fill` uses the commit message as title/body. |
| `gh pr view <number>` / `gh pr diff <number>` | inspect any PR — title, body, mergeability, full diff. |
| `gh pr close <number> --comment "..."` | close a PR with an explanation comment. |
| `gh pr merge <number>` | merge a PR (squash, rebase, or merge — picks default). |
| `gh repo view --web` | open the current repo in github in your browser. |
| `gh run list --repo <repo>` | recent CI runs. |
| `gh api <endpoint>` | raw github api — useful when the CLI doesn't have a wrapper for what you need. |

we used `gh pr close 11` today to close maria's superseded PR with an explanation. all PR review and merge happens through `gh` or the github web UI — both work.

### vercel — vercel's CLI (still used for some apps)

`vercel` is the CF-equivalent for the apps that didn't migrate (port, creaseworks, vault, nordic). same shape as wrangler but for vercel's platform.

| command | does what |
|---|---|
| `vercel login` | OAuth into vercel. |
| `vercel --prod` | deploy current dir to production. |
| `vercel env pull .env.local` | pull env vars from the linked vercel project into a local `.env.local`. |
| `vercel logs <deployment>` | stream logs from a deployment. |

most harbour apps no longer use this. only port (CRM), creaseworks, vault, and nordic still do.

### git, node, npm, npx — the foundations

these are the actual building blocks under everything else.

- **git** — version control. `git pull`, `git commit`, `git push`, `git status`, `git log`, `git diff`. branching covered in section 5.
- **node** — JavaScript runtime. `node 24 LTS` is the current default for our stack (set via `nvm use 24` if you have multiple versions installed).
- **npm** — node's package manager. `npm install` to install deps from `package.json`. `npm run <script>` to invoke a script defined in `package.json`'s `scripts` block.
- **npx** — runs a package without installing it globally. `npx wrangler ...` runs the wrangler version from the local `node_modules` (preferred over a global install, which can drift).

### a quick "which tool for which job" cheat

| you want to... | use |
|---|---|
| deploy a static SPA to CF Pages | `npx wrangler pages deploy dist --project-name <name>` |
| deploy a CF Worker | `cd <worker-dir> && npx wrangler deploy` |
| deploy a Next.js app to CF | `cd <app-dir> && npx opennextjs-cloudflare build && npx opennextjs-cloudflare deploy` |
| deploy any app to vercel | `cd <app-dir> && vercel --prod` |
| open a PR from your branch | `gh pr create --fill` |
| see live logs from a worker | `npx wrangler tail <worker-name>` |
| install/update deps | `npm install` |
| run a one-off task from a package | `npx <package>` |
| see what's deployed where | `npx wrangler pages project list` (CF) or vercel dashboard |

---

## 4. secrets and access — never paste a token into chat

this is the most-likely-to-cause-an-incident category. read this section even if you skip the others.

### the rule

**any secret value (API token, password, env-pull dump, dashboard "reveal" output) belongs in a terminal or in 1password — never in slack, email, claude, or any web form.** if claude or slack ever asks you for a token's value, the answer is "no, but i'll tell you whether it works."

### why

- chat history is searchable, exported, screenshotted, archived. a token pasted once may live forever in a place you don't control.
- 1password (or another vault) gives you: encryption at rest, sharing controls, revocation, audit logs, and the ability to rotate without hunting for stale copies.
- claude in particular has a memory layer. anything you paste might end up referenced later in unrelated conversations.

### the right way to share access between teammates

**preferred: invite as a member of the cloudflare account.** dash.cloudflare.com → manage account → members → invite. assign the smallest permission policy that does the job (e.g. "Workers Platform Admin" only — not "Super Administrator"). benefits:
- audit trail by user
- revoke in one click if they leave or their machine is compromised
- no shared secret to rotate
- they get their own auth via `wrangler login`

**fallback: API token via 1password.** only if the recipient is automated (CI, a script). steps:
1. dash.cloudflare.com/profile/api-tokens → create token with the minimum scopes needed + an expiration date (90 days max).
2. copy value DIRECTLY into a new 1password item in a vault the recipient has access to. never via chat.
3. verify it works without printing the value:
   ```bash
   op read "op://Shared/<item-name>/credential" | xargs -I{} \
     curl -sS -H "Authorization: Bearer {}" \
     https://api.cloudflare.com/client/v4/user/tokens/verify | jq '.result.status'
   # should print "active"
   ```
4. tell the recipient the 1password item name. they pull it into `CLOUDFLARE_API_TOKEN` from there.

### the same logic for other services

| service | preferred access | fallback |
|---|---|---|
| github | invite to org (already done for maria as `winded-maria`) | personal access token via 1password |
| vercel | invite to team (`ghandoffs-projects`) | API token via 1password |
| neon postgres | per-user auth | connection string via 1password (project-scoped) |
| anthropic / openai | shared workspace | API key via 1password (rotate quarterly) |

### scopes to never grant casually

- **CF "Super Administrator"** — can change billing, manage members, revoke other admins. only garrett.
- **CF "Administrator"** — can edit subscriptions. mostly garrett.
- **github org "Owner"** — can transfer the org. only garrett.
- **vercel "Owner"** — same.
- **CF API token without expiration** — set 90 days max; rotate on a calendar.

### what to do if a secret leaks

1. **rotate immediately** — go to the dashboard, regenerate the token. the old value dies the moment the new one is created.
2. **find every place the old value is stored** (1password, `.env` files, vercel/cf env vars, CI secrets). update all.
3. **check audit logs** for anything that ran with the leaked token between leak and rotation.
4. **post-mortem in slack** — short note in `#engineering` with what leaked, blast radius, and how to prevent next time.

never use `git filter-branch` or `git push --force` to "remove" a leaked secret from history — once it's pushed, assume it was scraped. only rotation makes a leaked secret safe.

---

## 5. git workflow for shared repos

**the golden rule: shared config files (`site/next.config.ts`, `wrangler.toml`, `package.json` at repo root, anything in `packages/`) need a branch + PR.** your own app's source code in `apps/<your-app>/` you can push directly if you're confident.

### the standard flow

```bash
# 1. start fresh — always pull before you start
cd ~/Projects/windedvertigo
git checkout main
git pull --rebase origin main

# 2. branch with a descriptive name
git checkout -b fix/values-auction-cleanup
# naming: feat/<thing>, fix/<thing>, chore/<thing>, docs/<thing>

# 3. edit, test locally
# ... your changes ...
npm run build          # or npm run dev — make sure it doesn't crash

# 4. commit with a clear message
git add site/next.config.ts
git commit -m "fix(site): remove dead /harbour/values-auction rewrites"

# 5. push the branch and open a PR
git push -u origin fix/values-auction-cleanup
gh pr create --fill   # or use the github UI

# 6. wait for review (or self-review if it's straightforward)

# 7. merge via the github UI (squash & merge keeps history clean)
```

### when you can skip the PR

- changes only to your own app folder (`apps/<your-app>/`) where no one else is working
- `[skip ci]` docs/scripts updates that don't affect deploys
- urgent prod fixes (but tell the team in slack first)

### before editing a shared config, read it first

this would have prevented today's incident:

```bash
# before adding a rewrite for values-auction, check if one exists
grep -n "values-auction" site/next.config.ts

# look at the surrounding context — is there a beforeFiles block? an afterFiles block?
sed -n '30,60p' site/next.config.ts

# check the file's history
git log --oneline -10 site/next.config.ts
```

if you find existing rules, your job is to **edit or delete** them — not duplicate them.

### the "which repo am i in" check

if you're about to push and you're not 100% sure which repo:

```bash
git remote -v
# origin  https://github.com/ghandoff/harbour-apps.git (push)
# vs
# origin  https://github.com/ghandoff/windedvertigo.git (push)
```

different repos = different files. `site/next.config.ts` only exists in `windedvertigo`.

### force-push safety

- never `git push --force` to main
- on your own branch: `git push --force-with-lease` is safe (rejects if someone else pushed)
- if you accidentally pushed something bad: don't force-push to fix it — open a `git revert` PR instead

---

## 6. common pitfalls (lessons from the migration so far)

### pitfall 1: stale destinations

every `*.vercel.app` in the codebase post-migration is suspect. before merging anything that adds a rewrite, fetch destination, or redirect, verify the destination exists:

```bash
curl -sI https://that-thing.vercel.app | head -3
# if you get HTTP/2 404 with server: vercel — the project is gone
```

### pitfall 2: `dist/` is gitignored

`dist/` (the build output) is gitignored in every app. if you manually drop a config file (like `_redirects` for cloudflare pages) into `dist/`, it disappears on the next clean build. **source-control config files in `public/`** (vite copies `public/` → `dist/` on every build) so they survive.

### pitfall 3: env files are baked at build time

`.env.production` in vite apps is read AT BUILD TIME, not at runtime. if you change `VITE_WS_URL`, you must rebuild and redeploy the SPA. visiting `pages.dev` won't pick up the new URL until a new bundle ships.

### pitfall 4: forgetting the worker

a SPA that talks to a backend worker (like values-auction's websocket relay) needs the worker deployed separately. the SPA deploy doesn't include the worker. always check: "if this app has a `workers/` or `relay/` or `server/` directory, is the worker actually deployed?"

```bash
curl -sI https://your-worker-name.windedvertigo.workers.dev/health
# 200 = deployed. 404 = the worker doesn't exist on that subdomain.
```

### pitfall 5: rewrite-into-rewrite loops

if site A rewrites a path to site B, and site B has a `_redirects` rule sending traffic back to site A, you've got an infinite loop. cloudflare returns **error 1019** for these. fix: remove the canonicalisation rule on the destination (it's already canonical from the user's perspective via the rewrite).

---

## 7. case study: values-auction error 1019 (2026-04-27)

a worked example of every pitfall above, all in one app:

**symptom:** `windedvertigo.com/portfolio/assets/values-auction` returned cloudflare error 1019. clicking "create new session" did nothing.

**root causes (three of them):**

1. **redirect loop.** maria deployed the SPA with a `_redirects` file in `dist/` that sent `pages.dev/*` → `windedvertigo.com/portfolio/assets/values-auction/*`. but the site rewrite proxies `/portfolio/assets/values-auction/*` → `pages.dev/*`. infinite loop → error 1019. the `_redirects` file was only in `dist/` (not in source), so nobody could find it via `git log`. **fix:** moved an empty/comment-only `_redirects` to `public/` so the file is source-controlled and the bad rule can't come back.

2. **websocket relay never deployed.** the SPA's `.env.production` told it to connect to `wss://wv-values-auction-relay.windedvertigo.workers.dev/ws`. that worker didn't exist (`relay/node_modules` was empty — never even installed). every "create new session" call hit a 404. **fix:** `cd relay && npm install && npx wrangler deploy` (after switching `new_classes` → `new_sqlite_classes` for the free-tier DO migration). also fixed `.env.production` which was missing the `/ws` path suffix.

3. **stale vercel rewrites.** `site/next.config.ts:408-425` had three rules routing `/harbour/values-auction*` and `/wordmark.svg` to `values-auction-pi.vercel.app` (dead — vercel project removed during migration). these were never cleaned up when maria added the new `/portfolio/assets/values-auction*` rules in `beforeFiles` at lines 37-49. PR #11 tried to clean up but accidentally pointed everything at the same dead vercel URL. **fix:** delete lines 408-425 entirely.

**meta-lesson:** the migration creates drift across both the apps and the routing config. when moving an app, do the cleanup (delete old rewrites, update env vars, redeploy worker dependencies) in the same PR as the migration — not as separate "i'll get to it later" tickets.

---

## 8. ip & promotion when building for prme

> *not legal advice. consequential decisions should be confirmed with counsel.*

most of our portfolio assets sit at `windedvertigo.com/portfolio/assets/...` and are accessed by prme signatories during the prme pedagogy certificate series. some of those tools are wv-original IP (we built them on our own time, on our own platform, as part of our broader work). some are prme-funded "new deliverables" — created in performance of the prme sub-grant agreement, which assigns the IP to the foundation.

the distinction matters for two reasons:
1. **what header / promotional language we can put on a tool** (quiet vs. bolder)
2. **whether we can migrate a tool to `/harbour/` as a freemium upsell** (some need written consent from prme; others don't)

### the contract clause that governs this

the may 2025 [sub-grant agreement](https://drive.google.com/file/d/1ooQXr8V2l0_UdqRnAY1ZGYf4ymuSjWtw/view) section 8 splits things three ways:

- **8a — existing IP:** anything we built before 2025-04-15 (or independently of any funder scope) stays ours. patents, copyrights, trademarks, trade secrets, know-how — all retained.
- **8c — new deliverables:** anything we conceive, reduce to practice, or create *in performance of services under the contract* (the certificate-series lessons, the facilitator guides, the participant-facing applied learning resources, etc.) is "the sole and exclusive property of the foundation." we irrevocably assign all rights to them. we "shall not use, disclose, or exploit any new deliverables for any purpose other than performing services under this contract without the prior written consent of the foundation."
- **8d — license back:** if any of our pre-existing IP is needed by the foundation to fully exploit the new deliverables, they get a non-exclusive, perpetual, irrevocable, worldwide, royalty-free license — but only "in connection with the new deliverables."

the 2026 PPCS work appears to flow under PO #2069 attached to the same master agreement. assume the same IP regime applies until / unless a new master is signed.

### the rule of thumb

| origin | portfolio header (`/portfolio/assets/...`) | harbour migration with promotional headers |
|---|---|---|
| **wv-original** (built before contract or independent) | full wv branding fine, "more at /harbour" CTAs fine | yes, no consent needed |
| **prme-funded new deliverable** (covered by section 8c) | quiet wv header only — wordmark + "back to windedvertigo.com" link. no CTAs to wv collective signup or harbour upsell. | **prior written consent required** from the foundation (meredith / alex stein). usually granted on request, but the consent has to exist on paper. |
| **mixed** (wv tooling layer + prme content layer, like depth-chart) | depends on which layer the header is promoting. wv tooling layer = wv branding fine. prme content layer = treat as prme-funded. | promote the wv tooling, not the prme content layer. |
| **3rd-party** (e.g. prme framework content under cc by 4.0) | attribution required, otherwise free to use | yes, with attribution |

### the per-tool register

actual classifications per tool (which is wv-original, which is prme-funded, what consent status, etc.) live in `.brain/memory/tool-ip-register.md`. that file is private to the wv collective (tracked via the `brain` remote, not `origin`). update it whenever a new tool ships or its classification changes. **before a tool moves to `/harbour/` with promotional CTAs, it must be classified in the register and not marked `tbd`.**

### the vertigo.vault precedent

the existing pattern — a free portfolio teaser version that links to a fuller version inside `/harbour/` — works cleanly **for wv-original tools**. for prme-funded tools, the same UX works but should be framed differently:

- the prme-facing version remains complete and unchanged. nothing is gated behind a wv freemium wall. prme signatories get the full deliverable they paid for.
- the harbour version is positioned as wv's *broader collection that includes this prme-licensed asset* — not as a "premium upgrade" of the prme tool. avoids the impression that prme's certified content has a paywalled tier.
- the invitation header reads as "explore winded.vertigo's wider work" rather than "unlock more features of this tool."

### the consent-ask flow

when a prme-funded tool needs to move to harbour:

1. identify the deliverable + PO# in the IP register
2. email meredith (PRME) cc'ing alex stein (foundation) requesting written consent for hosting an enhanced or broader-collection version on the wv harbour, with attribution + continued free access to the prme version
3. file the reply in `~/Drive/PRME/<contract>/consents/`
4. update the register with the consent date and scope
5. proceed with the harbour migration

most foundations are happy to see broader dissemination of their funded work, so this is usually a one-email gate. the friction exists to keep us honest about the contract.

### url stability — first deploy is permanent

**rule: a tool's URL never moves after first deploy. IP origin and audience are signaled by the page header, not by the URL path.**

it's tempting to say "wv-original tools live at `/portfolio/`, prme-funded tools live at `/portfolio/prme/`, monetizable tools live at `/harbour/`" — but that taxonomy creates a bug factory. tools' classifications evolve (a portfolio exemplar gets monetized, a wv-original tool gets re-licensed, a prme deliverable gets consent for harbour use). every move means:

- broken bookmarks held by prme signatories, conference attendees, anyone who shared the original link
- broken inbound links from prme communications, decks, emails sent before the move
- routing config churn in `site/next.config.ts` (the exact category of churn that produced today's error 1019 incident)
- env var path drift in the apps themselves (vite `base:`, asset references)
- caching artifacts in cf pages and the cdn

**so: where a tool first lands is where it lives forever.** if its IP / audience story changes later, change the header — not the URL. example:

- values-auction launched at `/portfolio/assets/values-auction/` and stays there even if wv later monetizes a pro version. the pro version gets a NEW URL like `/harbour/values-auction-pro/` and the original page links to it.
- a prme-funded tool that later gets consent for a harbour version: original portfolio URL is unchanged. the harbour version lives at a new sibling URL.
- a tool that wv stops promoting: leave the URL alone, just remove or quiet the promo header. URLs cost nothing to keep alive.

this is also why the per-tool register tracks IP category as a separate column from URL — the URL is permanent, the category may evolve.

### header convention (the part that does the actual signaling)

the header tells the visitor what they're looking at and who built it. four templates:

| origin | header pattern (top of page) |
|---|---|
| **wv-original** | "winded.vertigo · {tool name}" + optional lineage ("originally built for {context}") + optional "more at /harbour" CTA |
| **wv-original re-used in a partner context** | "winded.vertigo · {tool name} · shared with {partner name + year}" — example: values-auction in 2026 prme PPCS reads "winded.vertigo · values-auction · originally built for AOM 2025, shared with prme 2026 pedagogy certificate series" |
| **wv-derived** | "winded.vertigo · {tool name} · spinoff of {origin tool}" — example: systems-thinking reads "spinoff of tidal.pool" |
| **prme-funded** (or any funder-commissioned new deliverable) | "{funder name + program} · {tool name} · hosted by winded.vertigo" — wv reads as the platform host, not the brand. no wv collective signup CTAs, no harbour upsell. |
| **mixed** (wv tooling + funder content) | header reflects the LAYER being foregrounded. depth-chart's tooling page reads as wv; the embedded prme framework content reads as prme + cc by 4.0 attribution. |

**the discipline:** when in doubt about whether a tool should have a wv-promotional header, default to the quieter template. it's much cheaper to add brand presence later than to retroactively scrub it from a tool that prme signatories have already shared.

### what NOT to do

- don't add a "join the winded.vertigo collective" CTA to a prme-funded tool's portfolio page
- don't migrate a prme-funded tool to `/harbour/` without consent on file, even if the harbour version "adds features"
- don't reproduce prme-funded content in unrelated wv contexts (decks, marketing pages, conference talks) without consent
- don't gate the prme-facing version of a tool behind a wv signup
- don't assume the 2026 work is on a fresh master agreement — until a new master is signed, the may 2025 terms govern PO #2069 work

---

## 9. quick command reference

```bash
# am i in the right repo?
git remote -v
pwd

# what's already in this file?
grep -n "<keyword>" site/next.config.ts
git log --oneline -10 -- <file>

# is this URL still alive?
curl -sI https://<host>/<path> | head -3

# what cloudflare projects do we have?
npx wrangler pages project list
npx wrangler deployments list --name <worker>

# pull → branch → edit → push → PR
git pull --rebase origin main
git checkout -b fix/<thing>
# ... edit ...
git commit -am "fix(scope): summary"
git push -u origin fix/<thing>
gh pr create --fill

# check who deployed what when
gh run list --repo ghandoff/<repo> --limit 5
```
