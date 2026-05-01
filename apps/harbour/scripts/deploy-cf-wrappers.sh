#!/usr/bin/env bash
# Deploy the @windedvertigo/security wrapper to all 16 harbour CF Worker apps.
#
# Per-app sequence:
#   1. cd apps/<app>
#   2. npx opennextjs-cloudflare build
#   3. npx wrangler deploy
#   4. curl -sI <worker URL> + assert all 6 security headers present
#
# Designed to run unattended after Claude has prepped each app's worker.ts,
# tsconfig.json, wrangler.jsonc, and package.json. Each app is independent;
# script continues past failures and reports per-app status at the end.
#
# Pre-requisite: ~/.cf-token must contain a valid CF API token with
# Workers Scripts:Edit + Workers Routes:Edit + Zone DNS:Edit on the
# windedvertigo.com zone.
#
# Usage:
#   ./scripts/deploy-cf-wrappers.sh           # deploy all 16 apps
#   ./scripts/deploy-cf-wrappers.sh bias-lens # deploy a single app
#   ./scripts/deploy-cf-wrappers.sh --include-depth-chart  # also redeploy depth-chart (A4)
#
# Output:
#   logs/deploy-cf-wrappers-YYYY-MM-DD-HHMMSS.log  (per-run timestamped log)

set -uo pipefail  # do NOT use -e — we want to continue on app-level failures

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f "$HOME/.cf-token" ]; then
  echo "ERROR: ~/.cf-token not found. Create a CF API token first." >&2
  exit 2
fi
export CLOUDFLARE_API_TOKEN
CLOUDFLARE_API_TOKEN="$(cat "$HOME/.cf-token")"

# Per-app fully-qualified worker URLs for header verification
declare -a APPS=(
  "bias-lens"
  "code-weave"
  "deep-deck"
  "emerge-box"
  "liminal-pass"
  "market-mind"
  "mirror-log"
  "orbit-lab"
  "paper-trail"
  "pattern-weave"
  "proof-garden"
  "raft-house"
  "rhythm-lab"
  "scale-shift"
  "tidal-pool"
  "time-prism"
)

# Optional flags
INCLUDE_DEPTH_CHART=0
SINGLE_APP=""
for arg in "$@"; do
  case "$arg" in
    --include-depth-chart) INCLUDE_DEPTH_CHART=1 ;;
    --help|-h)
      sed -n '2,/^$/p' "$0" | head -30
      exit 0
      ;;
    *) SINGLE_APP="$arg" ;;
  esac
done

mkdir -p "$REPO_ROOT/logs"
LOG="$REPO_ROOT/logs/deploy-cf-wrappers-$(date +%Y-%m-%d-%H%M%S).log"
echo "Logging to $LOG"
echo "=== deploy-cf-wrappers.sh — $(date) ===" | tee "$LOG"

# Required headers to verify per app
REQUIRED_HEADERS=(
  "strict-transport-security"
  "content-security-policy"
  "x-frame-options"
  "x-content-type-options"
  "referrer-policy"
  "permissions-policy"
)

deploy_one() {
  local app="$1"
  local app_dir="$REPO_ROOT/apps/$app"
  local worker_name="wv-harbour-$app"
  local worker_url="https://$worker_name.windedvertigo.workers.dev"

  echo "" | tee -a "$LOG"
  echo "=== [$app] starting ===" | tee -a "$LOG"

  if [ ! -d "$app_dir" ]; then
    echo "[$app] FAIL — app dir missing" | tee -a "$LOG"
    return 1
  fi

  cd "$app_dir"

  # 1. Build
  echo "[$app] build..." | tee -a "$LOG"
  if ! npx opennextjs-cloudflare build >> "$LOG" 2>&1; then
    echo "[$app] FAIL — build error (see $LOG)" | tee -a "$LOG"
    return 1
  fi

  # 2. Deploy
  echo "[$app] deploy..." | tee -a "$LOG"
  if ! npx wrangler deploy >> "$LOG" 2>&1; then
    echo "[$app] FAIL — deploy error (see $LOG)" | tee -a "$LOG"
    return 1
  fi

  # 3. Verify headers (give CF 5 seconds to propagate)
  sleep 5
  local headers
  headers="$(curl -sI "$worker_url/" 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  local missing=()
  for h in "${REQUIRED_HEADERS[@]}"; do
    if ! echo "$headers" | grep -q "^$h:"; then
      missing+=("$h")
    fi
  done

  if [ ${#missing[@]} -eq 0 ]; then
    echo "[$app] OK — all 6 headers emitting" | tee -a "$LOG"
    return 0
  else
    echo "[$app] WARN — missing headers: ${missing[*]}" | tee -a "$LOG"
    echo "  worker URL: $worker_url" | tee -a "$LOG"
    return 1
  fi
}

declare -a OK_APPS=()
declare -a FAIL_APPS=()

# Optional: redeploy depth-chart first (closes A4 — AUTH_URL secret already set)
if [ "$INCLUDE_DEPTH_CHART" -eq 1 ]; then
  echo "=== A4: depth-chart redeploy (AUTH_URL fix) ===" | tee -a "$LOG"
  if deploy_one "depth-chart"; then
    OK_APPS+=("depth-chart")
  else
    FAIL_APPS+=("depth-chart")
  fi
fi

# Main rollout
if [ -n "$SINGLE_APP" ]; then
  if deploy_one "$SINGLE_APP"; then
    OK_APPS+=("$SINGLE_APP")
  else
    FAIL_APPS+=("$SINGLE_APP")
  fi
else
  for app in "${APPS[@]}"; do
    if deploy_one "$app"; then
      OK_APPS+=("$app")
    else
      FAIL_APPS+=("$app")
    fi
  done
fi

echo "" | tee -a "$LOG"
echo "=== Summary ===" | tee -a "$LOG"
echo "OK (${#OK_APPS[@]}): ${OK_APPS[*]:-none}" | tee -a "$LOG"
echo "FAIL (${#FAIL_APPS[@]}): ${FAIL_APPS[*]:-none}" | tee -a "$LOG"
echo "Log: $LOG" | tee -a "$LOG"

if [ ${#FAIL_APPS[@]} -gt 0 ]; then
  exit 1
fi
exit 0
