#!/usr/bin/env bash
# wv-sync — safe "start work here" for the windedvertigo repo, on any machine.
#
# Run this the moment you sit down at a machine (MacBook, Mac Mini, anyone's).
# It fetches the latest, tells you exactly how your local copy relates to the
# remote (the source of truth), and ONLY fast-forwards when it's completely
# safe to do so. It never force-anything and never touches uncommitted work.
#
# Usage:  ./scripts/wv-sync.sh
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not inside a git repo"; exit 1; }
cd "$root"

branch=$(git rev-parse --abbrev-ref HEAD)
echo "repo: $(basename "$root")   branch: ${branch}"

if ! git fetch --quiet origin 2>/dev/null; then
  echo "⚠ couldn't reach origin (offline?). Showing local state only."
fi

dirty=$(git status --porcelain | grep -cv '^$' || true)
echo "uncommitted files: ${dirty}"

# A branch with no upstream isn't tracked anywhere yet — publish it.
if ! git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  echo
  echo "ℹ branch '${branch}' isn't published yet (no upstream)."
  echo "  publish it so other machines can see it:  git push -u origin ${branch}"
  exit 0
fi

ahead=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)
behind=$(git rev-list --count 'HEAD..@{u}' 2>/dev/null || echo 0)
echo "vs origin/${branch}: ${ahead} ahead, ${behind} behind"
echo

if   [ "$behind" -eq 0 ] && [ "$ahead" -eq 0 ]; then
  if [ "$dirty" -gt 0 ]; then
    echo "✓ committed history matches origin/${branch}."
    echo "  ⚠ but ${dirty} uncommitted file(s) live ONLY on this machine — other"
    echo "    machines and teammates can't see them. Run 'git status' to review;"
    echo "    commit + push anything you want saved or visible elsewhere."
  else
    echo "✓ in sync with the source of truth — clear to work."
  fi
elif [ "$behind" -gt 0 ] && [ "$ahead" -eq 0 ] && [ "$dirty" -eq 0 ]; then
  echo "→ ${behind} new commit(s) on the remote, nothing local to lose. Fast-forwarding…"
  git pull --ff-only && echo "✓ now in sync — clear to work."
elif [ "$behind" -gt 0 ] && [ "$dirty" -gt 0 ]; then
  echo "⚠ you're ${behind} behind AND have uncommitted changes."
  echo "  commit or stash first, then rebase:"
  echo "    git add -A && git commit -m '…'   # or: git stash"
  echo "    git pull --rebase"
elif [ "$behind" -gt 0 ] && [ "$ahead" -gt 0 ]; then
  echo "⚠ diverged: ${ahead} local commit(s) and ${behind} remote commit(s)."
  echo "  reconcile with:  git pull --rebase"
  echo "  if it reports conflicts, STOP and ask for help — do not force."
else # ahead > 0, behind == 0
  echo "ℹ ${ahead} unpushed commit(s). Your other machines can't see them yet."
  echo "  push when ready:  git push"
fi
