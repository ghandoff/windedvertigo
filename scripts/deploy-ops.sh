#!/usr/bin/env bash
# Deploy the wv-ops Cloudflare Worker from the monorepo root.
#
# Two-step build (same pattern as deploy-nordic.sh):
#   1. Build Next.js via npm workspace from monorepo root (Turbopack workspace
#      root detection works correctly from here).
#   2. Bundle for CF Workers with OpenNext --skipNextBuild.
#   3. Deploy via wrangler.
#
# Usage:
#   ./scripts/deploy-ops.sh            # production deploy
#   ./scripts/deploy-ops.sh --preview  # canary deploy (workers.dev only)
#
# Prerequisites:
#   - wrangler authenticated (`npx wrangler whoami`)
#   - Secrets set on wv-ops worker (see ops/wrangler.jsonc comment block)

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/ops"
PREVIEW=false

for arg in "$@"; do
  case $arg in
    --preview) PREVIEW=true ;;
  esac
done

echo "==> Step 1: Building Next.js (from monorepo root)..."
cd "$REPO_ROOT"
npm run build -w @windedvertigo/ops

echo "==> Step 2: Bundling for Cloudflare Workers (OpenNext)..."
cd "$APP_DIR"
npx @opennextjs/cloudflare build --skipNextBuild

echo "==> Step 3: Deploying wv-ops..."
if [ "$PREVIEW" = true ]; then
  echo "  (preview — deploying to workers.dev only)"
  npx wrangler deploy
  echo ""
  echo "Canary URL: https://wv-ops.windedvertigo.workers.dev"
else
  npx wrangler deploy
fi
