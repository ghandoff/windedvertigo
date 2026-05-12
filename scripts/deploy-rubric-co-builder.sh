#!/usr/bin/env bash
# Deploy the wv-harbour-rubric-co-builder Cloudflare Worker from monorepo root.
#
# Two-step build (mirrors deploy-creaseworks.sh):
#   1. Build Next.js from apps/harbour/ using -w rubric-co-builder.
#      Pins the npm workspace root to apps/harbour/ so Next.js sets
#      relativeAppDir:"rubric-co-builder" (short), not the absolute path
#      from windedvertigo/ root that breaks CF Workers handler bundling.
#   2. Bundle for CF Workers with OpenNext --skipNextBuild (run from app dir).
#   3. Deploy via wrangler.
#
# Usage:
#   ./scripts/deploy-rubric-co-builder.sh            # production deploy
#   ./scripts/deploy-rubric-co-builder.sh --preview  # canary (workers.dev only)
#
# Prerequisites:
#   - wrangler authenticated (`npx wrangler whoami`)
#   - Secrets set on wv-harbour-rubric-co-builder:
#       wrangler secret put POSTGRES_URL      --name wv-harbour-rubric-co-builder
#       wrangler secret put ANTHROPIC_API_KEY --name wv-harbour-rubric-co-builder

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HARBOUR_ROOT="$REPO_ROOT/apps/harbour"
APP_DIR="$HARBOUR_ROOT/rubric-co-builder"
PREVIEW=false

for arg in "$@"; do
  case $arg in
    --preview) PREVIEW=true ;;
  esac
done

echo "==> Step 1: Building Next.js (from apps/harbour/ with -w rubric-co-builder)..."
cd "$HARBOUR_ROOT"
npm run build -w rubric-co-builder

echo "==> Step 2: Bundling for Cloudflare Workers (OpenNext)..."
cd "$APP_DIR"
npx @opennextjs/cloudflare build --skipNextBuild

echo "==> Step 3: Deploying wv-harbour-rubric-co-builder..."
if [ "$PREVIEW" = true ]; then
  echo "  (preview — deploying to workers.dev only)"
  npx wrangler deploy
  echo ""
  echo "Canary URL: https://wv-harbour-rubric-co-builder.windedvertigo.workers.dev"
else
  npx wrangler deploy
fi
