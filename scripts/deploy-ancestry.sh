#!/usr/bin/env bash
# Deploy the wv-ancestry Cloudflare Worker from the monorepo root.
#
# Two-step build (same pattern as deploy-vault.sh):
#   1. Build Next.js via npm workspace from monorepo root.
#   2. Bundle for CF Workers with OpenNext --skipNextBuild.
#   3. Deploy via wrangler.
#
# Usage:
#   ./scripts/deploy-ancestry.sh            # production deploy
#   ./scripts/deploy-ancestry.sh --preview  # canary deploy (workers.dev only)
#
# Prerequisites:
#   - wrangler authenticated (`npx wrangler whoami`)
#   - Secrets set on wv-ancestry worker (see ancestry/wrangler.jsonc)

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/ancestry"
PREVIEW=false

for arg in "$@"; do
  case $arg in
    --preview) PREVIEW=true ;;
  esac
done

echo "==> Step 1: Building Next.js (from monorepo root)..."
cd "$REPO_ROOT"
npm run build -w @windedvertigo/ancestry

echo "==> Step 2: Bundling for Cloudflare Workers (OpenNext)..."
cd "$APP_DIR"
npx @opennextjs/cloudflare build --skipNextBuild

echo "==> Step 3: Deploying wv-ancestry..."
if [ "$PREVIEW" = true ]; then
  echo "  (preview — deploying to workers.dev only)"
  npx wrangler deploy
  echo ""
  echo "Canary URL: https://wv-ancestry.windedvertigo.workers.dev"
else
  npx wrangler deploy
fi
