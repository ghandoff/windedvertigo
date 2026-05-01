# Session 50 Handoff — Harbour Sync Admin Feature

*Created: Mar 5, 2026 | Worktree: `laughing-pare` | Branch: `claude/reservoir-admin-dashboard`*

---

## What Was Done This Session

### 1. Completed harbour → harbour rename (Phase 6: Notion CMS)
- Updated 5 Site Content CMS rows (renamed "harbor" → "harbour" in Name + Content fields)
- Updated 3 Harbour Games Href fields (`/harbor/creaseworks` → `/harbour/creaseworks`, etc.)
- Renamed Harbour Games database title to "Harbour Games"
- Fixed "harbor page" straggler row (Name + Tagline)
- Re-triggered GitHub Actions Notion sync to commit corrected JSON files
- Verified all live URLs: `/harbour/*` → 200, old paths → 404

### 2. Built harbour sync admin feature (NEW)
Added a new admin page at `/admin/harbour-sync` with two operations:

**Card A: Notion CMS Sync** — triggers the GitHub Actions `sync-notion.yml` workflow via the GitHub API. This runs `fetch-notion.js`, commits updated JSON files to main, and Vercel auto-deploys affected apps.

**Card B: Force Redeploy** — force-redeploys selected Vercel apps without a content change. Checkboxes for all 6 apps, parallel execution, per-app result display.

---

## Current State of the Worktree

### Location
```
/Users/garrettjaeger/Projects/windedvertigo/.claude/worktrees/laughing-pare/
```

### Branch
`claude/reservoir-admin-dashboard` — branched from pre-harbour-rename main.

### Uncommitted Changes
```
Modified:
  apps/creaseworks/src/app/admin/page.tsx          # added ⚓ harbour sync nav card
  turbo.json                                        # added GITHUB_TOKEN to passthrough

New files:
  apps/creaseworks/src/app/admin/harbour-sync/
    page.tsx                                        # server page (requireAdmin)
    harbour-sync-dashboard.tsx                      # client component (2-card UI)
  apps/creaseworks/src/app/api/admin/harbour-sync/
    notion/route.ts                                 # GitHub Actions dispatch API
    redeploy/route.ts                               # Vercel force-redeploy API
```

### ⚠️ Important: Branch is behind main
This worktree's branch predates the harbour rename (PRs #42 + #43 on main). The local codebase still references "reservoir" in many file paths and basePaths. The new harbour-sync files are written correctly — they use `apiUrl()` which resolves at runtime, and the Vercel project IDs are hardcoded constants that don't change.

**Before creating a PR**, you'll need to:
1. Rebase onto main: `git fetch origin && git rebase origin/main`
2. Resolve any conflicts (mainly around renamed files/paths)
3. Alternatively: cherry-pick the harbour-sync commits onto a fresh branch from main

---

## What's Left To Do

### Code (ready to commit/PR)
- [ ] Commit the uncommitted changes
- [ ] Rebase onto main (or create fresh branch from main + cherry-pick)
- [ ] Create PR for review
- [ ] Merge PR

### Manual Setup (after merge)
- [ ] **Create GitHub fine-grained PAT**
  - URL: https://github.com/settings/tokens?type=beta
  - Repository: `ghandoff/windedvertigo`
  - Permission: **Actions → Read and write**
- [ ] **Add `GITHUB_TOKEN` to Vercel**
  - Project: creaseworks
  - Environments: Production, Preview, Development
  - Team: ghandoffs-projects

### Verification (after deploy)
- [ ] Navigate to `www.windedvertigo.com/harbour/creaseworks/admin/harbour-sync`
- [ ] Click "sync notion content" → should show workflow dispatched with GitHub Actions link
- [ ] Click "force redeploy" → should show per-app deployment results
- [ ] Verify auth gate: unauthenticated access should redirect to login

---

## Key Technical Details

### API Routes Created

| Route | Method | What it does |
|-------|--------|-------------|
| `/api/admin/harbour-sync/notion` | POST | Dispatches `sync-notion.yml` GitHub Actions workflow, returns `{ success, runUrl, runStatus }` |
| `/api/admin/harbour-sync/redeploy` | POST | Accepts `{ apps: string[] }`, redeploys each via Vercel API, returns `{ results: [{ app, success, url?, error? }] }` |

### Vercel Project IDs (hardcoded in redeploy route)
| App | Project ID |
|-----|-----------|
| site | `prj_k02f1LutCsQLZEDIyM2xYJ1PGPCx` |
| harbour | `prj_KqjKxyhlGTublMolccOkvLFBZ8Xn` |
| creaseworks | `prj_EoDpRvw1kdAqcGVrcaYclfWFeX7b` |
| deep-deck | `prj_Z2zpJXnsOrVp5hyoJ89ERuQHmOru` |
| vertigo-vault | `prj_KHsZ60sQpj3ipSB5lzy9CGVAUYaW` |
| nordic-sqr-rct | `prj_laAl3qm5w20CrtIjO2klc9dj180z` |

### Environment Variables
| Var | Where | Status |
|-----|-------|--------|
| `VERCEL_ACCESS_TOKEN` | Vercel (creaseworks) | ✅ Already configured |
| `GITHUB_TOKEN` | Vercel (creaseworks) | ⬜ Needs to be added |
| `GITHUB_TOKEN` | `turbo.json` passthrough | ✅ Added in this session |

### GitHub API Details
- Dispatch endpoint: `POST /repos/ghandoff/windedvertigo/actions/workflows/sync-notion.yml/dispatches`
- Returns `204 No Content` (fire-and-forget)
- After 2s delay, polls `GET .../runs?per_page=1` for the workflow run URL
- Token needs `actions:write` scope on the repo

---

## Other Worktrees

| Worktree | Branch | Last commit | Status |
|----------|--------|-------------|--------|
| `laughing-pare` | `claude/reservoir-admin-dashboard` | (uncommitted harbour-sync work) | **Active — this session** |
| `determined-brattain` | `claude/determined-brattain` | site audit, security headers, sitemap | Stale |
| `frosty-thompson` | `claude/frosty-thompson` | merge from main | Stale |
| `nifty-aryabhata` | `claude/nifty-aryabhata` | checkout/dead code cleanup | Stale |
| `pedantic-ptolemy` | `claude/pedantic-ptolemy` | docs/reference updates | Stale |
| `silly-bose` | `claude/silly-bose` | tier-aware notification filtering | Stale |

---

## Main Branch State (as of this session)

```
e49755d chore: sync Notion content and vault covers       ← latest (post-harbour rename sync)
aef37ba chore: sync Notion content and vault covers
4a26424 correct harbour spelling (#43)                    ← harbour rename complete
0c0d41d chore: sync Notion content and vault covers
85ae247 rename reservoir to harbor (#42)                  ← original harbor rename
```

All harbour URLs are live and verified:
- `www.windedvertigo.com/harbour` → harbour hub ✅
- `www.windedvertigo.com/harbour/creaseworks` → creaseworks ✅
- `www.windedvertigo.com/harbour/vertigo-vault` → vertigo vault ✅
- `www.windedvertigo.com/harbour/deep-deck` → deep deck ✅

---

## Plan File

The detailed implementation plan is saved at:
```
/Users/garrettjaeger/.claude/plans/floating-watching-lamport.md
```
