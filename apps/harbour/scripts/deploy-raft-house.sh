#!/usr/bin/env bash
# Deploy raft-house to Vercel production from its subdirectory.
#
# Unlike most harbour apps, raft-house deploys from its own directory
# using workspace stubs (not from monorepo root) because it has a
# custom vercel-install.sh script that copies shared packages into
# node_modules manually. This avoids the turbo build pipeline which
# would fail due to harbour requiring NOTION_TOKEN.
#
# Usage:
#   ./scripts/deploy-raft-house.sh            # production deploy
#   ./scripts/deploy-raft-house.sh --preview  # preview deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/raft-house"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Deploying raft-house from subdirectory"
cd "$APP_DIR"
vercel deploy $DEPLOY_FLAGS
