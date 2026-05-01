#!/usr/bin/env bash
# deploy.sh — provision secrets + deploy wv-port-jobs CF Worker
#
# SAFE TO RUN: secrets are piped directly into wrangler and never printed.
# Run this from the port-jobs/ directory.
#
# Prerequisites:
#   - wrangler authenticated (wrangler whoami should show your account)
#   - vercel CLI authenticated (vercel whoami should show your account)
#   - CLOUDFLARE_ACCOUNT_ID set, or your wrangler.jsonc account_id configured
#
# Usage:
#   cd port-jobs
#   bash deploy.sh
#
set -euo pipefail

WORKER_NAME="wv-port-jobs"
VERCEL_PROJECT="wv-port"
ENV_FILE=".env.port-jobs-tmp"

echo "▶ Pulling production env from Vercel project ${VERCEL_PROJECT}..."
# Pull into a temp file — secrets stay on disk, not in shell history
# Note: .env.port-jobs-tmp is in .gitignore
cd "$(dirname "$0")"

# Create .vercel/project.json so `vercel env pull` knows which project
mkdir -p .vercel
cat > .vercel/project.json <<JSON
{
  "projectId": "prj_rlsjo62EFnVofPUyjt0eYgzcrjmC",
  "orgId": "team_winded-vertigo"
}
JSON

vercel env pull "${ENV_FILE}" --environment production --yes 2>&1 | grep -v "^$"

echo "▶ Setting secrets on ${WORKER_NAME}..."

# Read each secret from the temp file and pipe it into wrangler
# (value is never echoed to stdout)
set_secret() {
  local key="$1"
  local value
  value=$(grep "^${key}=" "${ENV_FILE}" | cut -d= -f2- | sed 's/^"//' | sed 's/"$//')
  if [ -z "${value}" ]; then
    echo "  ⚠ ${key} not found in env — skipping"
    return
  fi
  echo "${value}" | wrangler secret put "${key}" --name "${WORKER_NAME}" 2>&1 | grep -v "^$"
  echo "  ✓ ${key} set"
}

set_secret ANTHROPIC_API_KEY
set_secret RESEND_API_KEY
set_secret SLACK_WEBHOOK_URL
set_secret SLACK_BOT_TOKEN
set_secret NOTION_TOKEN
set_secret SUPABASE_URL
set_secret SUPABASE_SERVICE_KEY

# Clean up temp env file
rm -f "${ENV_FILE}"
rm -f .vercel/project.json

echo "▶ Deploying ${WORKER_NAME}..."
wrangler deploy

echo ""
echo "✅ wv-port-jobs deployed. Queues will begin consuming backed-up messages."
echo ""
echo "Verify:"
echo "  wrangler tail ${WORKER_NAME}   — live log stream"
echo "  wrangler queues list           — confirm consumers=1 per queue"
