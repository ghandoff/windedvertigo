#!/usr/bin/env bash
# Deploy the wv-harbour-creaseworks Cloudflare Worker from the monorepo root.
#
# Two-step build:
#   1. Build Next.js from apps/harbour/ using -w creaseworks.
#      This pins the npm workspace root to apps/harbour/ (not windedvertigo/),
#      so Next.js sets relativeAppDir:"creaseworks" (not "apps/harbour/creaseworks").
#      Without this, the handler bundles absolute paths that fail in CF Workers
#      with "Dynamic require of '/.next/server/middleware-manifest.json'".
#   2. Bundle for CF Workers with OpenNext --skipNextBuild (run from app dir).
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
HARBOUR_ROOT="$REPO_ROOT/apps/harbour"
APP_DIR="$HARBOUR_ROOT/creaseworks"
PREVIEW=false

for arg in "$@"; do
  case $arg in
    --preview) PREVIEW=true ;;
  esac
done

echo "==> Step 1: Building Next.js (from apps/harbour/ with -w creaseworks — pins harbour as workspace root)..."
# Run from apps/harbour/ with -w creaseworks so npm uses apps/harbour/ as the
# workspace root. This makes Next.js set relativeAppDir:"creaseworks" (short),
# not "apps/harbour/creaseworks" (absolute from windedvertigo/ root).
# Running from the app dir alone doesn't work — npm still walks up to windedvertigo/.
cd "$HARBOUR_ROOT"
npm run build -w creaseworks

echo "==> Step 2: Bundling for Cloudflare Workers (OpenNext)..."
# OpenNext detects apps/harbour/ as the monorepo root (nearest package-lock.json).
# Since Next.js was built with apps/harbour/ as root, the standalone output
# is at .next/standalone/creaseworks/ — no path fix needed.
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
