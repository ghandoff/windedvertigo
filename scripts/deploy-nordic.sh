#!/usr/bin/env bash
# Deploy the wv-nordic Cloudflare Worker from the monorepo root.
#
# Uses a two-step build to work around Turbopack's workspace root detection
# in the monorepo: Next.js is built via npm workspace from the monorepo root,
# then OpenNext wraps it for CF Workers with --skipNextBuild.
#
# Usage:
#   ./scripts/deploy-nordic.sh            # production deploy
#   ./scripts/deploy-nordic.sh --preview  # canary deploy (workers.dev only)
#
# Prerequisites:
#   - wrangler authenticated (`npx wrangler whoami`)
#   - Secrets set on wv-nordic worker (see apps/nordic-sqr-rct/wrangler.jsonc)

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/nordic-sqr-rct"
PREVIEW=false

for arg in "$@"; do
  case $arg in
    --preview) PREVIEW=true ;;
  esac
done

# Step 1: Build Next.js from the monorepo root (workspace-aware; Turbopack
# finds the hoisted `next` package correctly from this context).
echo "==> Step 1: Building Next.js (from monorepo root)..."
cd "$REPO_ROOT"
npm run build -w nordic-sqr-rct

# Step 2: Run OpenNext CF Workers bundle with --skipNextBuild (Next.js already built).
echo "==> Step 2: Bundling for Cloudflare Workers (OpenNext)..."
cd "$APP_DIR"
npx @opennextjs/cloudflare build --skipNextBuild

# Step 3: Deploy.
echo "==> Step 3: Deploying wv-nordic..."
if [ "$PREVIEW" = true ]; then
  echo "  (preview — deploying to workers.dev only)"
  npx wrangler deploy
  echo ""
  echo "Canary URL: https://wv-nordic.windedvertigo.workers.dev"
else
  npx wrangler deploy
fi
