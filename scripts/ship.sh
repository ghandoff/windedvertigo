#!/usr/bin/env bash
# scripts/ship.sh — one-shot deploy.
#
# Run from anywhere in your windedvertigo clone:
#     bash scripts/ship.sh                   # deploy site only (urgent path)
#     bash scripts/ship.sh --rubric          # also deploy rubric-co-builder worker
#     bash scripts/ship.sh --va-pages        # also rebuild + redeploy values-auction SPA to CF Pages
#     bash scripts/ship.sh --all             # site + rubric + va-pages
#
# This script:
#   1. Auto-finds the repo root (works from any subdirectory).
#   2. Stashes any in-progress local edits so the checkout doesn't fail.
#   3. Switches to the deploy branch + pulls latest.
#   4. Runs the appropriate deploy script(s).
#   5. Restores your stash.
#   6. Prints smoke-test commands.
#
# Designed so you never have to think about cd / git / stash again.

set -euo pipefail

INCLUDE_RUBRIC=false
INCLUDE_VA_PAGES=false
for arg in "$@"; do
  case "$arg" in
    --rubric)   INCLUDE_RUBRIC=true ;;
    --va-pages) INCLUDE_VA_PAGES=true ;;
    --all)      INCLUDE_RUBRIC=true; INCLUDE_VA_PAGES=true ;;
    -h|--help)
      sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
  esac
done

# ─── helpers ────────────────────────────────────────────────────────────────
bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
arrow(){ printf '\033[1;36m▶\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m⚠\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ─── 1. find repo root ──────────────────────────────────────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || \
  die "Not in a git repo. cd into your windedvertigo clone, then re-run."
cd "$REPO_ROOT"

# ─── 2. stash in-progress work ──────────────────────────────────────────────
STASHED=0
if ! git diff --quiet HEAD -- 2>/dev/null || [ -n "$(git status --porcelain)" ]; then
  arrow "Stashing in-progress work so checkout doesn't fail..."
  git stash push -u -m "auto-stash before ship.sh $(date +%Y%m%d-%H%M%S)" >/dev/null
  STASHED=1
  ok "Stashed. (Will restore at the end. 'git stash list' to inspect.)"
fi

# ─── 3. sync deploy branch ──────────────────────────────────────────────────
BRANCH="claude/remove-vercel-migrate-cloudflare-omCpK"
arrow "Syncing $BRANCH..."
git fetch origin "$BRANCH" >/dev/null 2>&1
git checkout "$BRANCH" >/dev/null 2>&1
git pull --ff-only origin "$BRANCH" >/dev/null 2>&1
HEAD_LINE="$(git log -1 --pretty='%h %s')"
ok "HEAD: $HEAD_LINE"

# ─── 4. preflight wrangler ──────────────────────────────────────────────────
if ! command -v wrangler >/dev/null 2>&1 && ! npx --no-install wrangler --version >/dev/null 2>&1; then
  die "wrangler not found on PATH or via npx. Install with: npm i -g wrangler"
fi

# ─── 5. deploy site ─────────────────────────────────────────────────────────
echo ""
bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bold "  Deploying wv-site (fixes values-auction + vault + cuts)"
bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/deploy-site.sh
ok "wv-site deployed."

# ─── 6. deploy rubric (optional) ────────────────────────────────────────────
RUBRIC_FAILED=false
if $INCLUDE_RUBRIC; then
  echo ""
  bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  bold "  Deploying wv-harbour-rubric-co-builder"
  bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if ./scripts/deploy-rubric-co-builder.sh; then
    ok "wv-harbour-rubric-co-builder deployed."
  else
    RUBRIC_FAILED=true
    warn "Rubric deploy failed. Most likely cause: secrets aren't set yet."
    cat <<EOF

  Set them once with:
    npx wrangler secret put POSTGRES_URL      --name wv-harbour-rubric-co-builder
    npx wrangler secret put ANTHROPIC_API_KEY --name wv-harbour-rubric-co-builder

  Then re-run: bash scripts/ship.sh --rubric
EOF
  fi
fi

# ─── 6b. deploy values-auction Pages SPA (optional) ─────────────────────────
VA_PAGES_FAILED=false
if $INCLUDE_VA_PAGES; then
  echo ""
  bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  bold "  Rebuilding + deploying values-auction SPA to CF Pages"
  bold "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  VA_DIR="$REPO_ROOT/apps/harbour/values-auction"
  if [ ! -d "$VA_DIR" ]; then
    warn "values-auction app dir not found at $VA_DIR — skipping"
    VA_PAGES_FAILED=true
  else
    (cd "$VA_DIR" && npm install && npm run deploy:spa) || VA_PAGES_FAILED=true
    if $VA_PAGES_FAILED; then
      warn "values-auction Pages deploy failed. Check wrangler auth + Pages project name."
    else
      ok "values-auction SPA deployed to CF Pages."
    fi
  fi
fi

# ─── 7. restore stash ───────────────────────────────────────────────────────
if [ "$STASHED" = "1" ]; then
  echo ""
  arrow "Restoring your stashed work..."
  if git stash pop >/dev/null 2>&1; then
    ok "Stash restored cleanly."
  else
    warn "Stash pop had conflicts. Your work is preserved in 'git stash list'."
    warn "Resolve later with: git stash show -p stash@{0} | git apply"
  fi
fi

# ─── 8. smoke tests ─────────────────────────────────────────────────────────
echo ""
bold "✓ Done. Smoke-test these:"
echo ""
for path in \
  "/portfolio/assets/values-auction/" \
  "/harbour/values-auction/" \
  "/harbour/cuts-catalogue/" \
  "/harbour/vertigo-vault/" \
; do
  echo "  curl -sI https://windedvertigo.com$path | head -3"
done
if $INCLUDE_RUBRIC && ! $RUBRIC_FAILED; then
  echo "  curl -sI https://windedvertigo.com/harbour/rubric-co-builder/ | head -3"
fi
echo ""
echo "  Or run the full audit in one go:"
echo "    bash scripts/smoke-test.sh"
echo ""
echo "  Expect: HTTP/2 200, cf-ray present, NO x-vercel-* headers."

if $RUBRIC_FAILED || $VA_PAGES_FAILED; then
  exit 1
fi
