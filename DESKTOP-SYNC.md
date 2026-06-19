# Desktop (Mac mini) sync checklist

_Run these in the office on the Mac mini so it matches the laptop's GitHub state._
_GitHub account: **ghandoff**. Source of truth = whatever is pushed to GitHub._

The laptop is already clean and fully pushed (synced 2026-06-16). The only real risk is
the **desktop having local work it never pushed** — do step 1 first.

---

## 1. Push any desktop-only work FIRST (most important)
For every repo under `~/Projects`, make sure nothing is stranded locally:

```bash
cd ~/Projects
for d in */; do
  [ -d "$d/.git" ] || continue
  echo "=== $d ==="
  git -C "$d" status -sb | head -1
  git -C "$d" stash list
done
```
Commit + `git push` anything that shows uncommitted changes, stashes, or `ahead`.
If you skip this, those commits never reach the laptop.

## 2. Fetch the new backup branches
The laptop's local-only work was pushed to GitHub under `laptop-backup/*` and a WIP branch:

```bash
git -C ~/Projects/windedvertigo fetch origin   # gets laptop-backup/* branches
# creaseworks WIP (if you still have that repo): laptop-wip-2026-06-15
```
Backups now on GitHub:
- windedvertigo: `laptop-backup/{heuristic-shannon, nifty-chebyshev, vercel-build, compassionate-engelbart, old-main-graeagle}`
- creaseworks (archived repo): `laptop-wip-2026-06-15`

## 3. If git auth fails (`could not read Username`)
The laptop had a broken credential helper pointing at a deleted `/tmp/gh_install/.../gh`.
If the desktop was set up the same way, fix it once:

```bash
git config --global --unset-all credential.https://github.com.helper
gh auth setup-git
```

## 4. creaseworks: use the monorepo copy, not the standalone
The live page runs off **`harbour-apps/apps/creaseworks`** (Cloudflare Workers, ~4 months
ahead). The standalone `creaseworks` repo is a dead Vercel-era snapshot.
If a standalone `~/Projects/creaseworks` exists on the desktop, it's safe to delete the
local folder (the GitHub repo stays archived as a backstop).

---

## Verify (should be 0 ahead / 0 behind everywhere)
```bash
cd ~/Projects
for d in */; do
  [ -d "$d/.git" ] || continue
  echo "=== $d ==="
  git -C "$d" fetch -q origin
  git -C "$d" status -sb | head -1
done
```
