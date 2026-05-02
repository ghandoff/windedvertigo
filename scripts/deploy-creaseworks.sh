#!/usr/bin/env bash
# Deploy the wv-harbour-creaseworks Cloudflare Worker from the monorepo root.
#
# Two-step build (same pattern as deploy-nordic.sh):
#   1. Build Next.js via npm workspace from monorepo root.
#   2. Bundle for CF Workers with OpenNext --skipNextBuild.
#   3. Deploy via wrangler.
#
# Usage:
#   ./scripts/deploy-creaseworks.sh            # production deploy
#   ./scripts/deploy-creaseworks.sh --preview  # canary deploy (workers.dev only)
#
# Prerequisites:
#   - wrangler authenticated (`npx wrangler whoami`)
#   - Secrets set on wv-harbour-creaseworks worker (see creaseworks/wrangler.jsonc)

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/harbour/creaseworks"
PREVIEW=false

for arg in "$@"; do
  case $arg in
    --preview) PREVIEW=true ;;
  esac
done

HARBOUR_ROOT="$REPO_ROOT/apps/harbour"

echo "==> Step 1: Building Next.js (from harbour sub-monorepo root)..."
# creaseworks lives in apps/harbour/ which is its own npm workspaces monorepo.
cd "$HARBOUR_ROOT"
npm run build -w creaseworks

echo "==> Step 1.5: Fixing standalone path for OpenNext monorepo detection..."
# OpenNext detects apps/harbour/ as the monorepo root (nearest package-lock.json),
# so it expects .next/standalone/creaseworks/. But Next.js standalone outputs
# relative to the windedvertigo/ root: .next/standalone/apps/harbour/creaseworks/.
# Create a symlink so OpenNext finds the files where it expects them.
cd "$APP_DIR"
STANDALONE_ACTUAL=".next/standalone/apps/harbour/creaseworks"
STANDALONE_EXPECTED=".next/standalone/creaseworks"
if [ -d "$STANDALONE_ACTUAL" ] && [ ! -e "$STANDALONE_EXPECTED" ]; then
  (cd .next/standalone && ln -sf apps/harbour/creaseworks creaseworks)
  echo "  symlink: .next/standalone/creaseworks -> apps/harbour/creaseworks"
fi

echo "==> Step 2: Bundling for Cloudflare Workers (OpenNext)..."
cd "$APP_DIR"
npx @opennextjs/cloudflare build --skipNextBuild

echo "==> Step 3: Deploying wv-harbour-creaseworks..."
if [ "$PREVIEW" = true ]; then
  echo "  (preview — deploying to workers.dev only)"
  npx wrangler deploy
  echo ""
  echo "Canary URL: https://wv-harbour-creaseworks.windedvertigo.workers.dev"
else
  npx wrangler deploy
fi
