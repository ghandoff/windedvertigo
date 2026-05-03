#!/usr/bin/env bash
# Deploy the wv-vault Cloudflare Worker from the monorepo root.
#
# Two-step build:
#   1. Build Next.js from apps/harbour/ using -w @windedvertigo/vertigo-vault.
#      This pins the npm workspace root to apps/harbour/ (not windedvertigo/),
#      so Next.js sets relativeAppDir:"vertigo-vault" (not "apps/harbour/vertigo-vault").
#      Without this, the handler bundles absolute paths that fail in CF Workers
#      with "Dynamic require of '/.next/server/middleware-manifest.json'".
#   2. Bundle for CF Workers with OpenNext --skipNextBuild (run from app dir).
#   3. Deploy via wrangler.
#
# Usage:
#   ./scripts/deploy-vault.sh            # production deploy
#   ./scripts/deploy-vault.sh --preview  # canary deploy (workers.dev only)
#
# Prerequisites:
#   - wrangler authenticated (`npx wrangler whoami`)
#   - Secrets set on wv-vault worker (see vertigo-vault/wrangler.jsonc)

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HARBOUR_ROOT="$REPO_ROOT/apps/harbour"
APP_DIR="$HARBOUR_ROOT/vertigo-vault"
PREVIEW=false

for arg in "$@"; do
  case $arg in
    --preview) PREVIEW=true ;;
  esac
done

echo "==> Step 1: Building Next.js (from apps/harbour/ with -w @windedvertigo/vertigo-vault — pins harbour as workspace root)..."
# Run from apps/harbour/ with -w so npm uses apps/harbour/ as the workspace root.
# This makes Next.js set relativeAppDir:"vertigo-vault" (short),
# not "apps/harbour/vertigo-vault" (absolute from windedvertigo/ root).
# Running from the app dir alone doesn't work — npm still walks up to windedvertigo/.
cd "$HARBOUR_ROOT"
npm run build -w @windedvertigo/vertigo-vault

echo "==> Step 2: Bundling for Cloudflare Workers (OpenNext)..."
# OpenNext detects apps/harbour/ as the monorepo root (nearest package-lock.json).
# Since Next.js was built with apps/harbour/ as root, the standalone output
# is at .next/standalone/vertigo-vault/ — no path fix needed.
cd "$APP_DIR"
npx @opennextjs/cloudflare build --skipNextBuild

echo "==> Step 3: Deploying wv-vault..."
if [ "$PREVIEW" = true ]; then
  echo "  (preview — deploying to workers.dev only)"
  npx wrangler deploy
  echo ""
  echo "Canary URL: https://wv-vault.windedvertigo.workers.dev"
else
  npx wrangler deploy
fi
