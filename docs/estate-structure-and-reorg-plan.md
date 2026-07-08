# Estate structure + reorganization plan

*Created 08 Jul 2026 from a two-repo structural analysis. This is the plan of record for tidying the folder layout. Nothing here has been executed yet — it's analysis + a safe-first sequence.*

## The vision

Two "duo" repos side-by-side under `~/Projects/`, each with a **coherent hierarchy below**: deployable apps under `apps/`, shared code under `packages/`, docs under `docs/`, and **no loose app folders or files sitting at the repo root**.

- `~/Projects/windedvertigo/` — consulting arm (marketing site, port, ops + internal tooling)
- `~/Projects/harbour-apps/` — product arm (the harbour app suite)
- `~/Projects/hobbies/` — personal (ancestry, amy-messages)

## Where each repo stands today

### harbour-apps — mostly clean ✅
A proper monorepo: `apps/*` + `packages/*`, convention followed consistently. ~30 folders under `apps/` is **normal** — that's what `apps/` is for. The "too many folders" feeling is that **7 real products are buried among ~15 poetically-named concept apps** (`emerge-box`, `liminal-pass`, …) — a *labeling* problem, fixed with a `docs/APP-MAP.md`, **not** folder moves. Real cruft is small (~20 MB):
- `apps/harbour/public/images/_generated/` — 20 MB near-duplicate of the images one level up.
- `apps/conference-experience/` — 23 loose PNGs + 6 `(1)`-suffixed duplicate files.
- `apps/creaseworks/public/image/` (singular, 1 file) → merge into `public/images/`.

### windedvertigo — the real mess ⚠️
A **half-finished migration**: `site`, `port`, `ops`, `port-jobs` live at the **root**, while `harbour`, `nordic-sqr-rct`, `ppcs-impact`, `coding-verifier` live under `apps/`. Plus:
- **Trap folders:** root `harbour/` (29 MB dead build junk) vs the real `apps/harbour/`; `app/` (singular, 1 orphan file) vs `apps/`; ghost `apps/values-auction/` (only a `node_modules`).
- **~100 MB+ triplicated images** (vertigo-vault set ×3; some portfolio images in up to 6 copies incl. `(1)` dupes).
- **Loose `.docx`/`.html` documents** dumped at the repo root.
- 71 `tmp_obj_*` git garbage files (a `git gc` clears them).

## Target structure

```
windedvertigo/
├── apps/            site, port, port-jobs, ops (moved in) + ppcs-impact, nordic, coding-verifier
├── packages/        (already correct)
├── docs/            (loose root docs moved in)
├── scripts/  archive/  research/
harbour-apps/        (already close; add docs/APP-MAP.md grouping — no folder moves)
```

## Sequence — safe first, risky last

### ✅ SAFE (do first — near-zero risk, ~150 MB + clarity win)
Each after a quick `grep` confirming nothing references the path:
- Delete ghost `apps/values-auction/`, dead root `harbour/`, orphan `app/` (confirm its images live in `apps/harbour/` first).
- Move loose root `.docx`/`.html` → `docs/`.
- `git gc`.
- (harbour) delete `_generated/` duplicate + the `conference-experience` `(1)` dupes (verify each twin matches first).

### ⚠️ NEEDS CARE (references updated in lockstep)
- **De-dupe the triplicated image sets** to one copy per app — grep each app for its `/images/...` paths first (Next.js serves images from each app's own `public/`, so removing the copy an app reads → 404s). Biggest size win.
- **Merge** `apps/nordic-sqr-rct` + `apps/nordic-sqr-rct-cf-worker` into one folder (update `scripts/deploy-nordic.sh` + the workspace entry).
- Rename `apps/PEDAL-conference` → `apps/pedal-conference` (case consistency).
- (harbour) rename `packages/mirror-log` → `packages/mirror-log-core` (ends the app-vs-package name clash; update every import + the package `name`).

### 🔴 RISKY (do ONE app at a time, test-deploy after each — never batch)
- **Move `site`/`port`/`ops`/`port-jobs` under `apps/`.** High blast radius: root `package.json` `workspaces` + every `dev:`/`deploy:` script, `scripts/deploy-*.sh` (they `cd` into these), `.vercel/project.json` path-swapping, each app's `wrangler.jsonc` / `next.config.ts` / `open-next.config.ts`, and `.github/` workflows all hard-code these paths. Move one, update its refs together, run its `deploy:*:preview`, confirm, then the next.

## Files that encode paths (touch when moving anything)
Root `package.json` (workspaces + scripts) · every `scripts/deploy-*.sh` · each app's `wrangler.jsonc` / `next.config.ts` / `open-next.config.ts` / `.vercel/project.json` · `.github/` workflows · harbour nav registry (`apps/harbour-nav-cdn/public/harbour-apps.json`).

## Recommendation
Do the **SAFE batch first** as one reviewed, grep-verified PR (reclaims ~150 MB + kills the trap folders). Save the **risky root-app relocation** for a dedicated session with deploy testing between each app. The harbour "reorg" is mostly a labeled `APP-MAP.md`, not moves.
