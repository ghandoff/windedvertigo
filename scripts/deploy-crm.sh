#!/usr/bin/env bash
# Deploy the wv-crm Vercel project from the monorepo root.
#
# Vercel needs the full monorepo to resolve workspace packages
# (e.g. @windedvertigo/notion). This script temporarily swaps
# .vercel/project.json to target wv-crm, deploys, then restores.
#
# Usage:
#   ./scripts/deploy-crm.sh            # production deploy
#   ./scripts/deploy-crm.sh --preview  # preview deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERCEL_DIR="$REPO_ROOT/.vercel"
PROJECT_JSON="$VERCEL_DIR/project.json"
BACKUP_JSON="$VERCEL_DIR/project.json.bak"

CRM_PROJECT_ID="prj_rlsjo62EFnVofPUyjt0eYgzcrjmC"
CRM_ORG_ID="team_wrpRda7ZzXdu7nKcEVVXY3th"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Swapping .vercel/project.json to target wv-crm"
cp "$PROJECT_JSON" "$BACKUP_JSON"

cleanup() {
  echo "→ Restoring .vercel/project.json"
  mv "$BACKUP_JSON" "$PROJECT_JSON"
}
trap cleanup EXIT

printf '{"projectId":"%s","orgId":"%s","projectName":"wv-crm"}\n' \
  "$CRM_PROJECT_ID" "$CRM_ORG_ID" > "$PROJECT_JSON"

echo "→ Deploying from monorepo root"
cd "$REPO_ROOT"
vercel deploy $DEPLOY_FLAGS

# cleanup() runs automatically via trap on EXIT
