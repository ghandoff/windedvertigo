#!/usr/bin/env bash
# Transfer secrets from the Vercel wv-ops project to the CF wv-ops worker.
# Values are NEVER printed to stdout — they flow directly from Vercel API
# response file → wrangler secret put stdin pipe.
#
# Run once after `wrangler deploy` creates the wv-ops CF Worker.
# Safe to re-run (wrangler secret put is idempotent).
#
# Usage:
#   cd /Users/garrettjaeger/Projects/windedvertigo
#   bash scripts/set-ops-secrets.sh

set -euo pipefail

VERCEL_TEAM="team_wrpRda7ZzXdu7nKcEVVXY3th"
VERCEL_PROJECT="prj_kmYvoUECyaAxND4GHj1WmiePGzU3"
CF_WORKER="wv-ops"

# Get Vercel token from CLI auth file
TOKEN=$(python3 -c "
import json, os
paths = [
  os.path.expanduser('~/Library/Application Support/com.vercel.cli/auth.json'),
  os.path.expanduser('~/.config/com.vercel.cli/auth.json'),
]
for p in paths:
  if os.path.exists(p):
    print(json.load(open(p))['token'])
    break
")

if [ -z "$TOKEN" ]; then
  echo "ERROR: could not read Vercel token. Run \`vercel login\` first."
  exit 1
fi

# Pull decrypted env values into a temp file
TMPFILE=$(mktemp /tmp/ops-secrets-XXXXX.json)
trap "rm -f '$TMPFILE'" EXIT

echo "→ Fetching env vars from Vercel wv-ops..."
curl -s "https://api.vercel.com/v9/projects/${VERCEL_PROJECT}/env?teamId=${VERCEL_TEAM}&decrypt=true&limit=50" \
  -H "Authorization: Bearer $TOKEN" > "$TMPFILE"

# Verify the response looks like env var data
if ! python3 -c "import json; d=json.load(open('$TMPFILE')); assert 'envs' in d" 2>/dev/null; then
  echo "ERROR: unexpected response from Vercel API. Check token/project ID."
  cat "$TMPFILE"
  exit 1
fi

# Secrets to transfer (never printed — piped directly to wrangler)
SECRETS=(
  AUTH_SECRET
  NOTION_TOKEN
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SECRET_KEY
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  KV_WRITE_TOKEN
  CLOUDFLARE_ACCOUNT_ID
  CLOUDFLARE_API_TOKEN
  SLACK_WEBHOOK_URL
  NOTION_TASKS_DB_ID
  NOTION_CONTENT_CALENDAR_DB_ID
  AUTH_URL
  ALLOWED_EMAILS
)

echo "→ Setting secrets on CF Worker ${CF_WORKER}..."
for SECRET in "${SECRETS[@]}"; do
  VALUE=$(python3 -c "
import json
data = json.load(open('$TMPFILE'))
for e in data.get('envs', []):
    if e.get('key') == '$SECRET' and e.get('value') and e.get('type') in ('encrypted', 'plain'):
        print(e['value'], end='')
        break
")
  if [ -n "$VALUE" ]; then
    echo "$VALUE" | npx wrangler secret put "$SECRET" --name "$CF_WORKER" 2>&1 \
      | grep -E "✓|Created|Updated|Error|ERROR" \
      | head -2
    echo "  ✓ $SECRET"
  else
    echo "  ⚠  $SECRET — not found in Vercel env (check manually)"
  fi
done

echo ""
echo "Done. Verify at: https://wv-ops.windedvertigo.workers.dev"
echo "Check: curl -s -o /dev/null -w '%{http_code}' https://wv-ops.windedvertigo.workers.dev/"
