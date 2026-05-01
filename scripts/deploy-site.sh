#!/usr/bin/env bash
# Deploy the wv-site Cloudflare Worker (windedvertigo.com) via OpenNext + Wrangler.
#
# The site is served from Cloudflare Workers using @opennextjs/cloudflare.
# This script builds the Next.js app + converts it for CF Workers, then deploys.
#
# Usage:
#   ./scripts/deploy-site.sh              # production deploy
#   ./scripts/deploy-site.sh --preview    # wrangler --env preview (dev tail)

set -euo pipefail

# Ensure Homebrew bin is on PATH (needed when invoked from a non-login shell)
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_DIR="$REPO_ROOT/site"

PREVIEW=false
if [[ "${1:-}" == "--preview" ]]; then
  PREVIEW=true
fi

echo "→ Building site with OpenNext for Cloudflare Workers"
cd "$SITE_DIR"

# Install deps if needed (workspace hoisting means this is usually a no-op)
# npm install --prefix "$REPO_ROOT" --silent 2>/dev/null || true

# @opennextjs/cloudflare build wraps next build + CF Workers adapter
npx --yes @opennextjs/cloudflare build

if $PREVIEW; then
  echo "→ Deploying preview Worker (wrangler deploy --env preview)"
  wrangler deploy --env preview
else
  echo "→ Deploying production Worker (wrangler deploy)"
  wrangler deploy
fi

echo "✓ wv-site deployed — windedvertigo.com is live"
