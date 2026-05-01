#!/usr/bin/env bash
# deploy.sh — provision secrets + deploy wv-port-jobs CF Worker
#
# SAFE TO RUN: secrets are piped directly into wrangler and never printed.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKER_NAME="wv-port-jobs"
ENV_FILE="${SCRIPT_DIR}/.env.port-jobs-tmp"

# Always start clean — previous failed run may have left a stale file
rm -f "${ENV_FILE}"

echo "▶ Pulling production env from Vercel project wv-port..."
vercel env pull "${ENV_FILE}" --environment production --scope ghandoffs-projects --yes 2>&1 | grep -v "^$"

echo "▶ Setting secrets on ${WORKER_NAME}..."

# Use Python to parse the .env file (handles quoted multi-line values correctly)
# then pipe each secret into wrangler one at a time — values never printed.
set_secret() {
  local worker_key="$1"
  local env_key="${2:-$1}"
  local value
  value=$(python3 -c "
import re, sys
with open('${ENV_FILE}') as f:
    content = f.read()
# Parse KEY=\"value\" or KEY=value (handles multi-line quoted values)
pattern = r'^' + re.escape('${env_key}') + r'=\"((?:[^\"\\\\]|\\\\.)*)\"'
m = re.search(pattern, content, re.MULTILINE | re.DOTALL)
if m:
    print(m.group(1).replace('\\\\n', '\n').replace('\\\\\"','\"'), end='')
    sys.exit(0)
# Unquoted value
pattern2 = r'^' + re.escape('${env_key}') + r'=([^\n]*)'
m2 = re.search(pattern2, content, re.MULTILINE)
if m2:
    print(m2.group(1).strip(), end='')
" 2>/dev/null)
  if [ -z "${value}" ]; then
    echo "  ⚠ ${env_key} not found — skipping ${worker_key}"
    return
  fi
  printf '%s' "${value}" | wrangler secret put "${worker_key}" --name "${WORKER_NAME}" 2>&1 | grep -v "^$"
  echo "  ✓ ${worker_key} set"
}

# Direct matches
set_secret ANTHROPIC_API_KEY
set_secret RESEND_API_KEY
set_secret SLACK_WEBHOOK_URL
set_secret SLACK_BOT_TOKEN
set_secret NOTION_TOKEN

# Vercel stores these under different names — map to what the worker expects
set_secret SUPABASE_URL         NEXT_PUBLIC_SUPABASE_URL
set_secret SUPABASE_SERVICE_KEY SUPABASE_SECRET_KEY

# Clean up
rm -f "${ENV_FILE}"

echo "▶ Deploying ${WORKER_NAME}..."
wrangler deploy --config "${SCRIPT_DIR}/wrangler.jsonc"

echo ""
echo "✅ wv-port-jobs deployed."
echo ""
echo "Verify:"
echo "  wrangler tail ${WORKER_NAME}"
echo "  wrangler queues list"
