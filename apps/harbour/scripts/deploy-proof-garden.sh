#!/usr/bin/env bash
# Deploy the proof-garden Vercel project from the monorepo root.
#
# Usage:
#   ./scripts/deploy-proof-garden.sh            # production deploy
#   ./scripts/deploy-proof-garden.sh --preview  # preview deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERCEL_DIR="$REPO_ROOT/.vercel"
PROJECT_JSON="$VERCEL_DIR/project.json"
BACKUP_JSON="$VERCEL_DIR/project.json.bak"

PROJECT_ID="prj_ndsM19uuXDayc7DjoZMexjVin3E6"
ORG_ID="team_wrpRda7ZzXdu7nKcEVVXY3th"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Swapping .vercel/project.json to target proof-garden"
cp "$PROJECT_JSON" "$BACKUP_JSON"

cleanup() {
  echo "→ Restoring .vercel/project.json"
  mv "$BACKUP_JSON" "$PROJECT_JSON"
}
trap cleanup EXIT

printf '{"projectId":"%s","orgId":"%s","projectName":"proof-garden"}\n' \
  "$PROJECT_ID" "$ORG_ID" > "$PROJECT_JSON"

echo "→ Deploying from monorepo root"
cd "$REPO_ROOT"
vercel deploy $DEPLOY_FLAGS
