#!/usr/bin/env bash
# Deploy the wv-ancestry Vercel project from the monorepo root.
#
# Vercel needs the full monorepo to resolve workspace packages
# (e.g. @windedvertigo/auth). This script temporarily swaps
# .vercel/project.json to target wv-ancestry, deploys, then restores.
#
# Usage:
#   ./scripts/deploy-ancestry.sh            # production deploy
#   ./scripts/deploy-ancestry.sh --preview  # preview deploy

set -euo pipefail

# Ensure Homebrew bin is on PATH (needed when invoked from a non-login shell)
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERCEL_DIR="$REPO_ROOT/.vercel"
PROJECT_JSON="$VERCEL_DIR/project.json"
BACKUP_JSON="$VERCEL_DIR/project.json.bak"

ANCESTRY_PROJECT_ID="prj_2n927YkHJvCRsBdVRGdhkBpBWupl"
ANCESTRY_ORG_ID="team_wrpRda7ZzXdu7nKcEVVXY3th"
HARBOUR_PROJECT_ID="prj_O2JU3Algj8MuFt3DGuwGC32KuvXd"

DEPLOY_FLAGS="--prod"
if [[ "${1:-}" == "--preview" ]]; then
  DEPLOY_FLAGS=""
fi

echo "→ Swapping .vercel/project.json to target wv-ancestry"
cp "$PROJECT_JSON" "$BACKUP_JSON"

cleanup() {
  echo "→ Restoring .vercel/project.json to harbour (windedvertigo)"
  printf '{"projectId":"%s","orgId":"%s","projectName":"windedvertigo"}\n' \
    "$HARBOUR_PROJECT_ID" "$ANCESTRY_ORG_ID" > "$PROJECT_JSON"
  rm -f "$BACKUP_JSON"
}
trap cleanup EXIT

printf '{"projectId":"%s","orgId":"%s","projectName":"wv-ancestry"}\n' \
  "$ANCESTRY_PROJECT_ID" "$ANCESTRY_ORG_ID" > "$PROJECT_JSON"

echo "→ Deploying from monorepo root"
cd "$REPO_ROOT"
VERCEL_BIN="${VERCEL_BIN:-$(command -v vercel 2>/dev/null || echo /opt/homebrew/bin/vercel)}"
"$VERCEL_BIN" deploy $DEPLOY_FLAGS

# cleanup() runs automatically via trap on EXIT
