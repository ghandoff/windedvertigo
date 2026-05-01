#!/usr/bin/env bash
# Deploy the tidal-pool Vercel project from the monorepo root.
#
# Vercel needs the full monorepo to resolve workspace packages
# (e.g. @windedvertigo/tokens, @windedvertigo/mirror-log). This
# script temporarily swaps .vercel/project.json to target
# tidal-pool, deploys, then restores.
#
# Usage:
#   ./scripts/deploy-tidal-pool.sh            # production deploy
#   ./scripts/deploy-tidal-pool.sh --preview  # preview deploy
#
# Prerequisites:
#   1. Create a Vercel project named "tidal-pool" in the dashboard
#   2. Set rootDirectory to "apps/tidal-pool"
#   3. Enable "Include source files outside of the Root Directory"
#   4. Copy the project ID below

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERCEL_DIR="$REPO_ROOT/.vercel"
PROJECT_JSON="$VERCEL_DIR/project.json"
BACKUP_JSON="$VERCEL_DIR/project.json.bak"

# TODO: Replace with actual project ID after creating Vercel project
TIDAL_POOL_PROJECT_ID="prj_cbNGb206jHi08fgSVjSKdOvLgdYt"
TIDAL_POOL_ORG_ID="team_wrpRda7ZzXdu7nKcEVVXY3th"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Swapping .vercel/project.json to target tidal-pool"
cp "$PROJECT_JSON" "$BACKUP_JSON"

cleanup() {
  echo "→ Restoring .vercel/project.json"
  mv "$BACKUP_JSON" "$PROJECT_JSON"
}
trap cleanup EXIT

printf '{"projectId":"%s","orgId":"%s","projectName":"tidal-pool"}\n' \
  "$TIDAL_POOL_PROJECT_ID" "$TIDAL_POOL_ORG_ID" > "$PROJECT_JSON"

echo "→ Deploying from monorepo root"
cd "$REPO_ROOT"
vercel deploy $DEPLOY_FLAGS
