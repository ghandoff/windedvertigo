#!/usr/bin/env bash
# Deploy site Worker after wrangler login refresh.
# Build is already staged at .open-next/worker.js (commit a3553a9).
#
# Usage:
#   ./scripts/deploy-after-login.sh
#
# Pre-req: `wrangler login` completed (ensure you can run `wrangler whoami`).

set -euo pipefail

cd "$(dirname "$0")/.."

unset CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID=097c92553b268f8360b74f625f6d980a

echo "→ Verifying wrangler auth..."
npx wrangler whoami | grep -E "logged in|email|associated" || {
  echo "  ✘ wrangler not authenticated. Run: wrangler login"
  exit 1
}

echo "→ Deploying via wrangler (skips OpenNext R2 cache-populate)..."
OPEN_NEXT_DEPLOY=true npx wrangler deploy

echo ""
echo "✓ Deploy complete. Smoke test:"
echo "  curl -sI https://windedvertigo.com/harbour | grep cf-ray"
echo "  Then sign in: https://windedvertigo.com/harbour/depth-chart/login"
