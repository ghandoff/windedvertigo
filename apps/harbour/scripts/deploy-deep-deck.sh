#!/usr/bin/env bash
# Deploy the deep-deck Vercel project from the monorepo root.
#
# Vercel needs the full monorepo to resolve workspace packages
# (e.g. @windedvertigo/tokens, @windedvertigo/feedback). This script
# temporarily swaps .vercel/project.json to target deep-deck, deploys,
# then restores.
#
# Usage:
#   ./scripts/deploy-deep-deck.sh            # production deploy
#   ./scripts/deploy-deep-deck.sh --preview  # preview deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERCEL_DIR="$REPO_ROOT/.vercel"
PROJECT_JSON="$VERCEL_DIR/project.json"
BACKUP_JSON="$VERCEL_DIR/project.json.bak"

PROJECT_ID="prj_Z2zpJXnsOrVp5hyoJ89ERuQHmOru"
ORG_ID="team_wrpRda7ZzXdu7nKcEVVXY3th"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Swapping .vercel/project.json to target deep-deck"
cp "$PROJECT_JSON" "$BACKUP_JSON"

cleanup() {
  echo "→ Restoring .vercel/project.json"
  mv "$BACKUP_JSON" "$PROJECT_JSON"
}
trap cleanup EXIT

printf '{"projectId":"%s","orgId":"%s","projectName":"deep-deck"}\n' \
  "$PROJECT_ID" "$ORG_ID" > "$PROJECT_JSON"

echo "→ Deploying from monorepo root"
cd "$REPO_ROOT"
vercel deploy $DEPLOY_FLAGS
