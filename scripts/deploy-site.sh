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

# ─── pre-flight: abort if next.config.ts isn't sound ──────────────────
# Twice in May 2026 the read-the-room rewrite vanished from next.config.ts
# right before a deploy fired, silently shipping a config that 404'd a
# live URL we were actively using. These checks turn that silent
# regression into a loud failure. To deploy past them, fix the working
# tree first or pass --skip-config-check (only if you know you removed
# the rewrite on purpose).
SKIP_CONFIG_CHECK=false
for arg in "$@"; do
  [[ "$arg" == "--skip-config-check" ]] && SKIP_CONFIG_CHECK=true
done

if ! $SKIP_CONFIG_CHECK; then
  CFG="$REPO_ROOT/site/next.config.ts"
  if ! grep -q "wv-harbour-read-the-room" "$CFG"; then
    echo "✗ ABORT: $CFG is missing the read-the-room rewrite."
    echo "  This config would deploy a live worker that 404s on /harbour/read-the-room."
    echo "  Fix the working tree (likely 'git checkout main -- site/next.config.ts')"
    echo "  or pass --skip-config-check if you genuinely intend to ship without it."
    exit 1
  fi
  if ! git -C "$REPO_ROOT" diff --quiet -- "$CFG"; then
    echo "✗ ABORT: $CFG has uncommitted changes."
    echo "  Deploying a dirty config is what got the URL 404'd in the first place."
    echo "  Commit your changes (or 'git checkout -- site/next.config.ts')"
    echo "  or pass --skip-config-check if you genuinely intend to ship the diff."
    exit 1
  fi
fi
# ──────────────────────────────────────────────────────────────────────

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
