#!/usr/bin/env bash
# Set secrets on wv-vault CF Worker from the Vercel vertigo-vault project.
#
# Run from the monorepo root:
#   ./scripts/set-vault-secrets.sh
#
# Prerequisites:
#   - `vercel` CLI authenticated to the ghandoffs-projects team
#   - `wrangler` authenticated (`npx wrangler whoami`)
#
# What this does:
#   1. Pulls production env vars from the vertigo-vault Vercel project
#   2. Sets each relevant secret on wv-vault via `wrangler secret put`
#   3. Also sets AUTH_URL and WORKERS_AUTH_PAGES_BASEPATH (CF-specific values)
#   4. Deletes the temp .env file

set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

WORKER="wv-vault"
ENV_FILE="/tmp/.env.wv-vault-$$"

echo "==> Pulling production env vars from Vercel vertigo-vault project..."
vercel env pull "$ENV_FILE" \
  --environment production \
  --yes \
  --scope ghandoffs-projects \
  --project vertigo-vault 2>&1 | grep -v "^$"

echo ""
echo "==> Setting secrets on $WORKER..."

# Helper: read a var from the env file and set as wrangler secret
set_secret() {
  local key="$1"
  local value
  value=$(grep "^${key}=" "$ENV_FILE" | cut -d= -f2- | tr -d '"')
  if [ -z "$value" ]; then
    echo "  SKIP  $key (not found in env file)"
    return
  fi
  printf '%s' "$value" | npx wrangler secret put "$key" --name "$WORKER" 2>/dev/null \
    && echo "  SET   $key" \
    || echo "  FAIL  $key"
}

# Database
set_secret POSTGRES_URL

# Notion
set_secret NOTION_TOKEN
set_secret NOTION_DB_VAULT

# Auth (Pool A — shared with creaseworks, harbour, depth-chart)
set_secret AUTH_SECRET

# R2 storage (creaseworks-evidence bucket)
set_secret R2_ACCOUNT_ID
set_secret R2_ACCESS_KEY_ID
set_secret R2_SECRET_ACCESS_KEY
set_secret R2_BUCKET_NAME

# Email
set_secret RESEND_API_KEY
set_secret EMAIL_FROM

# Cron
set_secret CRON_SECRET

# Stripe
set_secret STRIPE_SECRET_KEY
set_secret STRIPE_WEBHOOK_SECRET

# CF Workers–specific values (not in Vercel project, set inline)
echo ""
echo "==> Setting CF Workers–specific secrets..."

printf '%s' "https://windedvertigo.com/harbour/vertigo-vault/api/auth" \
  | npx wrangler secret put AUTH_URL --name "$WORKER" 2>/dev/null \
  && echo "  SET   AUTH_URL" || echo "  FAIL  AUTH_URL"

printf '%s' "true" \
  | npx wrangler secret put AUTH_TRUST_HOST --name "$WORKER" 2>/dev/null \
  && echo "  SET   AUTH_TRUST_HOST" || echo "  FAIL  AUTH_TRUST_HOST"

printf '%s' "/harbour/vertigo-vault" \
  | npx wrangler secret put WORKERS_AUTH_PAGES_BASEPATH --name "$WORKER" 2>/dev/null \
  && echo "  SET   WORKERS_AUTH_PAGES_BASEPATH" || echo "  FAIL  WORKERS_AUTH_PAGES_BASEPATH"

# GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are 'sensitive' in Vercel and
# won't appear in the env pull. Set them manually if OAuth login is needed:
#   npx wrangler secret put GOOGLE_CLIENT_ID --name wv-vault
#   npx wrangler secret put GOOGLE_CLIENT_SECRET --name wv-vault
echo ""
echo "  NOTE  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are Vercel-sensitive —"
echo "        set them manually from the Google Cloud Console if OAuth is needed."

# R2_PUBLIC_URL is 'sensitive' in Vercel — set inline (it's the public read URL):
printf '%s' "https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev" \
  | npx wrangler secret put R2_PUBLIC_URL --name "$WORKER" 2>/dev/null \
  && echo "  SET   R2_PUBLIC_URL" || echo "  FAIL  R2_PUBLIC_URL"

echo ""
echo "==> Cleaning up temp file..."
rm -f "$ENV_FILE"

echo ""
echo "Done! To build and deploy the canary:"
echo "  ./scripts/deploy-vault.sh --preview"
echo "  → https://wv-vault.windedvertigo.workers.dev"
