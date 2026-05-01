#!/usr/bin/env bash
# Deploy the paper-trail Vercel project from the monorepo root.
#
# Usage:
#   ./scripts/deploy-paper-trail.sh            # production deploy
#   ./scripts/deploy-paper-trail.sh --preview  # preview deploy

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERCEL_DIR="$REPO_ROOT/.vercel"
PROJECT_JSON="$VERCEL_DIR/project.json"
BACKUP_JSON="$VERCEL_DIR/project.json.bak"

PAPER_TRAIL_PROJECT_ID="prj_CsXpWptX3hYTLd8wrGP0Bl8qHVvz"
PAPER_TRAIL_ORG_ID="team_wrpRda7ZzXdu7nKcEVVXY3th"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Swapping .vercel/project.json to target paper-trail"
cp "$PROJECT_JSON" "$BACKUP_JSON"

cleanup() {
  echo "→ Restoring .vercel/project.json"
  mv "$BACKUP_JSON" "$PROJECT_JSON"
}
trap cleanup EXIT

printf '{"projectId":"%s","orgId":"%s","projectName":"paper-trail"}\n' \
  "$PAPER_TRAIL_PROJECT_ID" "$PAPER_TRAIL_ORG_ID" > "$PROJECT_JSON"

echo "→ Deploying from monorepo root"
cd "$REPO_ROOT"
vercel deploy $DEPLOY_FLAGS
