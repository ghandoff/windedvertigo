# winded.vertigo infrastructure migration plan

version 1.0 · 2026-02-21 · documented for future execution when priorities allow

---

## summary

this document outlines the plan to consolidate all winded.vertigo web properties onto vercel, enabling shared branding, subdomain routing, and a foundation for future app development. the plan is deferred — not because it's unimportant, but because revenue-generating apps (creaseworks, sqr-rct) take priority.

---

## current state

| property | hosting | repo | url |
|----------|---------|------|-----|
| windedvertigo.com (static site) | github pages | `ghandoff/windedvertigo-site` | `windedvertigo.com` |
| creaseworks | vercel (hobby) | `ghandoff/creaseworks` | `creaseworks.windedvertigo.com` |
| sqr-rct | vercel | private repo | TBC |
| future w.v apps | TBC | TBC | TBC |

### how github pages works today

- the `windedvertigo-site` repo has a `CNAME` file pointing to `windedvertigo.com`
- DNS A records point to github's IPs (`185.199.108-111.153`)
- every push to `main` triggers a github pages deploy
- a github actions workflow (`sync-notion.yml`) runs daily at 06:00 UTC, fetching Notion content (portfolio assets, vertigo vault activities) and committing JSON + images to the repo — which triggers a redeploy
- the site is pure HTML/CSS/JS with no server-side logic

### what the static site contains

- home page (`/`) — hero nav with "what. we. do." links
- about pages (`/what/`, `/we/`, `/do/`)
- portfolio (`/portfolio/`) — Notion-synced project showcase with package builder
- vertigo vault (`/vertigo-vault/`) — Notion-synced activity gallery
- project pages (`/projects/impactful-five/`, `/projects/play-for-all-accelerator/`)
- shared CSS (`/styles/main.css`), brand assets (`/images/`)

### DNS (current)

| record | type | value | purpose |
|--------|------|-------|---------|
| `windedvertigo.com` | A | `185.199.108.153` (x4) | github pages |
| `www.windedvertigo.com` | CNAME | `ghandoff.github.io` | github pages redirect |
| `creaseworks.windedvertigo.com` | CNAME | `cname.vercel-dns.com` | vercel |

---

## target state

all winded.vertigo properties hosted on vercel under `windedvertigo.com`, with each app on its own subdomain sharing the brand header, footer, and CSS.

| property | hosting | url |
|----------|---------|-----|
| static site | vercel | `windedvertigo.com` |
| creaseworks | vercel | `creaseworks.windedvertigo.com` |
| sqr-rct | vercel | `nordic-sqr-rct.windedvertigo.com` (or similar) |
| future apps | vercel | `{app}.windedvertigo.com` |

### future goal (phase 2)

path-based routing under `windedvertigo.com/studio/{app}/` using vercel rewrites — true "lives within the website" integration with shared CSS, header, footer. this requires `basePath` config in each Next.js app and coordinated deploys. defer until subdomains are stable.

---

## migration steps

### step 1: add static site to vercel (30 min)

1. log into vercel dashboard
2. click "add new project" → import `ghandoff/windedvertigo-site` from github
3. framework preset: "other" (static site, no build step)
4. output directory: `.` (root — the repo IS the static site)
5. deploy — vercel assigns a `.vercel.app` preview URL
6. verify the preview looks identical to the current live site
7. check that all pages load: `/`, `/what/`, `/we/`, `/do/`, `/portfolio/`, `/vertigo-vault/`, `/projects/*`
8. check that Notion-synced content (portfolio, vault) displays correctly

### step 2: configure custom domain in vercel (15 min)

1. in the vercel project settings → domains → add `windedvertigo.com`
2. vercel shows the DNS records you need to update
3. do NOT update DNS yet — just note the values

### step 3: update DNS (15 min + propagation)

at your domain registrar, update records:

| record | type | old value | new value |
|--------|------|-----------|-----------|
| `windedvertigo.com` | A | `185.199.108.153` (x4) | `76.76.21.21` |
| `www.windedvertigo.com` | CNAME | `ghandoff.github.io` | `cname.vercel-dns.com` |

keep existing:

| record | type | value | notes |
|--------|------|-------|-------|
| `creaseworks.windedvertigo.com` | CNAME | `cname.vercel-dns.com` | already on vercel |

propagation takes 5 min to 48 hours. during propagation, some users see the old github pages site, some see vercel — content is identical so this is invisible.

### step 4: verify and clean up (15 min)

1. confirm `windedvertigo.com` loads from vercel (check response headers for `x-vercel-id`)
2. confirm SSL certificate is active (vercel auto-provisions)
3. confirm `creaseworks.windedvertigo.com` still works
4. disable github pages: repo settings → pages → source → none
5. delete the `CNAME` file from the repo (vercel doesn't use it)
6. update `robots.txt` — change any references to `ghandoff.github.io` to `windedvertigo.com`

### step 5: notion sync workflow (no changes needed)

the github actions workflow (`sync-notion.yml`) commits to the repo on push. vercel deploys on push. so the existing workflow automatically triggers vercel deploys instead of github pages deploys. no code changes needed.

if you later want to move the sync to a vercel cron function (like creaseworks does), that's optional and can be done anytime.

### step 6: subdomain setup for other apps (15 min per app)

for each app (sqr-rct, future apps):

1. in the app's vercel project → settings → domains
2. add `{app}.windedvertigo.com`
3. add a CNAME record at your registrar: `{app}.windedvertigo.com` → `cname.vercel-dns.com`
4. vercel auto-provisions SSL

---

## shared CSS integration (future work)

once all properties are on vercel under the same domain, apps can load the shared CSS directly:

```html
<!-- in each Next.js app's layout.tsx -->
<link rel="stylesheet" href="https://windedvertigo.com/styles/main.css" />
```

for tighter integration (shared header/footer), options include:

- **HTML partials**: maintain header/footer as standalone HTML files in the static site, fetch and inject them in each app's layout
- **web components**: build the header/footer as custom elements that any app can drop in
- **shared npm package**: extract the header/footer into a package that all Next.js apps import

the simplest approach is loading the CSS and duplicating the header/footer HTML in each app's layout — it's a small amount of markup and avoids build-time dependencies.

---

## pricing

| tier | cost | what you get |
|------|------|-------------|
| hobby (free) | $0/month | 1 personal account, non-commercial use only |
| pro | $20/month per team member | commercial use, unlimited projects, custom domains, analytics |

since creaseworks and sqr-rct generate revenue, you need pro ($20/month). if maria deploys under the same vercel team, add her as a team member (+$20/month). if she has her own vercel account for separate projects, those are independent.

---

## decision log

| decision | date | rationale |
|----------|------|-----------|
| defer migration | 2026-02-21 | revenue-generating apps take priority. static site works fine on github pages. |
| subdomains first, paths later | 2026-02-21 | subdomains are already working. path-based routing adds complexity without immediate business value. |
| keep notion sync in github actions | 2026-02-21 | it works, it's tested. moving to vercel cron is optional optimisation. |
| evaluate supabase on next new project | 2026-02-21 | don't migrate creaseworks/sqr-rct mid-flight. test supabase on fresh project first. |
| vercel pro when ready | 2026-02-21 | required for commercial use. $20/month is trivial relative to app revenue. |

---

## risks and mitigations

| risk | likelihood | impact | mitigation |
|------|-----------|--------|------------|
| DNS propagation causes brief downtime | low | low | content is identical on both hosts during transition |
| vercel pricing changes | low | medium | static site can always go back to github pages. apps need a server host regardless. |
| vercel outage affects all properties | low | high | accept this tradeoff — separate hosts means separate deploy pipelines to maintain |
| notion sync breaks after migration | very low | medium | no code changes needed — same github actions workflow triggers vercel deploy instead of github pages |

---

## when to execute this plan

triggers for revisiting:

- when you're ready to share CSS between the static site and creaseworks
- when a new w.v app needs a subdomain and you're tired of managing DNS piecemeal
- when you want preview deploys for the static site
- when maria needs to deploy under the same domain
- when the business model / pricing decisions are settled and you're focused on polish

this is a ~2 hour migration. it's not urgent, but it unblocks a lot of future integration work.
