#!/usr/bin/env bash
# Deploy the windedvertigo-site Vercel project (windedvertigo.com) from the monorepo root.
#
# The Vercel project has its Root Directory configured as `site`, so deploys
# must originate from the monorepo root (not from inside site/). This script
# temporarily swaps .vercel/project.json to target windedvertigo-site,
# deploys, then restores the default (legacy windedvertigo project).
#
# Usage:
#   ./scripts/deploy-site.sh            # production deploy
#   ./scripts/deploy-site.sh --preview  # preview deploy

set -euo pipefail

# Ensure Homebrew bin is on PATH (needed when invoked from a non-login shell)
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERCEL_DIR="$REPO_ROOT/.vercel"
PROJECT_JSON="$VERCEL_DIR/project.json"
BACKUP_JSON="$VERCEL_DIR/project.json.bak"

SITE_PROJECT_ID="prj_k02f1LutCsQLZEDIyM2xYJ1PGPCx"
ORG_ID="team_wrpRda7ZzXdu7nKcEVVXY3th"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Swapping .vercel/project.json to target windedvertigo-site"
cp "$PROJECT_JSON" "$BACKUP_JSON"

cleanup() {
  echo "→ Restoring .vercel/project.json"
  mv "$BACKUP_JSON" "$PROJECT_JSON"
}
trap cleanup EXIT

printf '{"projectId":"%s","orgId":"%s","projectName":"windedvertigo-site"}\n' \
  "$SITE_PROJECT_ID" "$ORG_ID" > "$PROJECT_JSON"

echo "→ Deploying from monorepo root"
cd "$REPO_ROOT"
VERCEL_BIN="${VERCEL_BIN:-$(command -v vercel 2>/dev/null || echo /opt/homebrew/bin/vercel)}"
"$VERCEL_BIN" deploy $DEPLOY_FLAGS
