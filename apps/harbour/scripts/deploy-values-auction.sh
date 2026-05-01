#!/usr/bin/env bash
# Deploy the values-auction Vite app to Vercel.
#
# One-time setup (run from this monorepo root):
#   cd apps/values-auction
#   vercel link
#   # pick the right org and either create a new project or connect to
#   # an existing one named "values-auction". vercel writes the
#   # projectId + orgId into apps/values-auction/.vercel/project.json.
#
# Usage:
#   ./scripts/deploy-values-auction.sh            # production deploy
#   ./scripts/deploy-values-auction.sh --preview  # preview deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/values-auction"

if [[ ! -f "$APP_DIR/.vercel/project.json" ]]; then
  echo "error: $APP_DIR/.vercel/project.json is missing."
  echo "run: cd apps/values-auction && vercel link"
  exit 1
fi

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Deploying values-auction from $APP_DIR"
cd "$APP_DIR"
vercel deploy $DEPLOY_FLAGS
