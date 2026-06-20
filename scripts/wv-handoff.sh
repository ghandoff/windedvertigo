#!/usr/bin/env bash
# wv-handoff — "I'm leaving this machine." Run before you close the laptop or
# head to the office. Commits any work-in-progress and pushes it, so the next
# machine (or teammate) can pick up exactly where you left off. The remote is
# the only copy another machine can see — this guarantees it's there.
#
# Usage:  ./scripts/wv-handoff.sh
set -uo pipefail

root=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "not inside a git repo"; exit 1; }
cd "$root"

branch=$(git rev-parse --abbrev-ref HEAD)

if [ "$branch" = "main" ]; then
  echo "⚠ you're on main, and main auto-deploys some apps. Don't park WIP here."
  echo "  move your work onto a branch first, then re-run:"
  echo "    git switch -c wip/$(date +%Y%m%d)-<short-topic>"
  echo "    ./scripts/wv-handoff.sh"
  exit 1
fi

dirty=$(git status --porcelain | grep -cv '^$' || true)
if [ "$dirty" -gt 0 ]; then
  # Be transparent about NEW (untracked, non-ignored) files before sweeping them
  # in, so nothing unexpected gets committed. Personal configs like CLAUDE.md are
  # gitignored and excluded automatically.
  new=$(git ls-files --others --exclude-standard)
  if [ -n "$new" ]; then
    echo "including these NEW files (not previously tracked):"
    echo "$new" | sed 's/^/    + /'
    echo "  (gitignored files like personal CLAUDE.md are excluded automatically)"
    echo
  fi
  echo "committing ${dirty} changed file(s) as work-in-progress…"
  git add -A
  git commit -q -m "wip: handoff $(date '+%Y-%m-%d %H:%M')" \
                -m "Auto-committed by wv-handoff before switching machines." \
    || { echo "nothing to commit"; }
fi

echo "pushing ${branch}…"
if git push -u origin "$branch"; then
  echo "✓ pushed — safe to switch machines."
  echo "  on the other machine:  git fetch && git switch ${branch} && ./scripts/wv-sync.sh"
else
  echo "✗ push failed. Resolve the error above before switching machines, or your"
  echo "  work stays stranded on THIS machine only."
  exit 1
fi
