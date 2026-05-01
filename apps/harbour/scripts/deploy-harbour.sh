#!/usr/bin/env bash
# Deploy the harbour hub Vercel project from the monorepo root.
#
# Vercel needs the full monorepo to resolve workspace packages
# (e.g. @windedvertigo/tokens). This script temporarily swaps
# .vercel/project.json to target harbour, deploys, then restores.
#
# Usage:
#   ./scripts/deploy-harbour.sh            # production deploy
#   ./scripts/deploy-harbour.sh --preview  # preview deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERCEL_DIR="$REPO_ROOT/.vercel"
PROJECT_JSON="$VERCEL_DIR/project.json"
BACKUP_JSON="$VERCEL_DIR/project.json.bak"

HARBOUR_PROJECT_ID="prj_KqjKxyhlGTublMolccOkvLFBZ8Xn"
HARBOUR_ORG_ID="team_wrpRda7ZzXdu7nKcEVVXY3th"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Swapping .vercel/project.json to target harbour"
cp "$PROJECT_JSON" "$BACKUP_JSON"

cleanup() {
  echo "→ Restoring .vercel/project.json"
  mv "$BACKUP_JSON" "$PROJECT_JSON"
}
trap cleanup EXIT

printf '{"projectId":"%s","orgId":"%s","projectName":"harbour"}\n' \
  "$HARBOUR_PROJECT_ID" "$HARBOUR_ORG_ID" > "$PROJECT_JSON"

echo "→ Deploying from monorepo root"
cd "$REPO_ROOT"
vercel deploy $DEPLOY_FLAGS
