#!/usr/bin/env bash
# Set secrets on wv-ancestry CF Worker from the Vercel wv-ancestry project.
#
# Run from the monorepo root:
#   ./scripts/set-ancestry-secrets.sh
#
# Prerequisites:
#   - `vercel` CLI authenticated to the ghandoffs-projects team
#   - `wrangler` authenticated (`npx wrangler whoami`)
#
# What this does:
#   1. Pulls production env vars from the wv-ancestry Vercel project
#   2. Sets each relevant secret on wv-ancestry via `wrangler secret put`
#   3. Also sets AUTH_URL and ANCESTRY_MEDIA_PUBLIC_URL (CF-specific values)
#   4. Deletes the temp .env file

set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

WORKER="wv-ancestry"
ENV_FILE="/tmp/.env.wv-ancestry-$$"

echo "==> Pulling production env vars from Vercel wv-ancestry project..."
vercel env pull "$ENV_FILE" \
  --environment production \
  --yes \
  --scope ghandoffs-projects \
  --project wv-ancestry 2>&1 | grep -v "^$"

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

# Auth (Pool A — shared with creaseworks, vault, depth-chart, harbour)
set_secret AUTH_SECRET

# Database (Supabase — migrated from Neon per PR #13)
set_secret DATABASE_URL

# Email
set_secret RESEND_API_KEY
set_secret EMAIL_FROM

# Cron
set_secret CRON_SECRET

# Anthropic (research assist + hints generation)
set_secret ANTHROPIC_API_KEY

# CF Workers–specific values (not in Vercel project, set inline)
echo ""
echo "==> Setting CF Workers–specific secrets..."

printf '%s' "https://ancestry.windedvertigo.com/api/auth" \
  | npx wrangler secret put AUTH_URL --name "$WORKER" 2>/dev/null \
  && echo "  SET   AUTH_URL" || echo "  FAIL  AUTH_URL"

printf '%s' "true" \
  | npx wrangler secret put AUTH_TRUST_HOST --name "$WORKER" 2>/dev/null \
  && echo "  SET   AUTH_TRUST_HOST" || echo "  FAIL  AUTH_TRUST_HOST"

# ANCESTRY_MEDIA_PUBLIC_URL: public R2 URL for the ancestry-media bucket.
# After creating the bucket and enabling public access, paste the URL here.
# Format: https://pub-<hash>.r2.dev
echo ""
echo "  NOTE  ANCESTRY_MEDIA_PUBLIC_URL must be set manually once you enable"
echo "        public access on the ancestry-media R2 bucket:"
echo "        npx wrangler secret put ANCESTRY_MEDIA_PUBLIC_URL --name wv-ancestry"

# GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are 'sensitive' in Vercel.
echo ""
echo "  NOTE  GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are Vercel-sensitive —"
echo "        set them manually from the Google Cloud Console:"
echo "        npx wrangler secret put GOOGLE_CLIENT_ID --name wv-ancestry"
echo "        npx wrangler secret put GOOGLE_CLIENT_SECRET --name wv-ancestry"

echo ""
echo "==> Cleaning up temp file..."
rm -f "$ENV_FILE"

echo ""
echo "Done! To build and deploy the canary:"
echo "  ./scripts/deploy-ancestry.sh --preview"
echo "  → https://wv-ancestry.windedvertigo.workers.dev"
