#!/usr/bin/env bash
# Deploy the wv-port Cloudflare Worker (OpenNext).
#
# port ships to Cloudflare Workers, NOT Vercel. Build is OpenNext
# (opennextjs-cloudflare); publish is wrangler. wrangler auth is the
# OAuth login (`wrangler whoami`) — no CLOUDFLARE_API_TOKEN needed.
#
# Usage:
#   ./scripts/deploy-port.sh                    # production deploy → port.windedvertigo.com
#   ./scripts/deploy-port.sh --preview          # preview version on *.workers.dev (no prod traffic)
#   ./scripts/deploy-port.sh --preview <alias>  # preview with a stable alias host:
#                                               #   https://<alias>-wv-port.windedvertigo.workers.dev
#
# A stable --preview alias only needs its /api/auth/callback/google URL
# whitelisted once in the port Google OAuth client for sign-in to work.

set -euo pipefail

# Ensure Homebrew bin is on PATH (needed when invoked from a non-login shell).
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# wrangler.jsonc (name: wv-port) lives in port/, so build + publish run there.
cd "$REPO_ROOT/port"

echo "→ Building OpenNext bundle (wv-port)"
npx opennextjs-cloudflare build

if [[ "${1:-}" == "--preview" ]]; then
  ALIAS="${2:-}"
  if [[ -n "$ALIAS" ]]; then
    echo "→ Uploading preview version with alias '$ALIAS' (no production traffic)"
    npx wrangler versions upload --preview-alias "$ALIAS"
  else
    echo "→ Uploading preview version (no production traffic)"
    npx wrangler versions upload
  fi
else
  echo "→ Deploying to production (port.windedvertigo.com/*)"
  npx wrangler deploy
fi
