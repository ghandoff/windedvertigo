#!/usr/bin/env bash
# Migrate a harbour app from Vercel to Cloudflare Workers.
#
# Usage:
#   ./scripts/migrate-to-cloudflare.sh bias-lens        # set up + build
#   ./scripts/migrate-to-cloudflare.sh bias-lens --deploy  # build + deploy to CF
#   ./scripts/migrate-to-cloudflare.sh bias-lens --preview # build + local preview
#
# What this script does:
#   1. Generates wrangler.jsonc if it doesn't exist
#   2. Generates open-next.config.ts if it doesn't exist
#   3. Adds CF scripts to package.json if missing
#   4. Installs @opennextjs/cloudflare + wrangler if missing
#   5. Runs the OpenNext build
#   6. Optionally deploys or previews

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${1:?Usage: $0 <app-name> [--deploy|--preview]}"
ACTION="${2:-build}"
APP_DIR="$REPO_ROOT/apps/$APP_NAME"

if [[ ! -d "$APP_DIR" ]]; then
  echo "✗ App directory not found: $APP_DIR"
  exit 1
fi

WORKER_NAME="wv-harbour-${APP_NAME}"
BASE_PATH="/harbour/${APP_NAME}"

echo "→ Migrating $APP_NAME to Cloudflare Workers"
echo "  Worker: $WORKER_NAME"
echo "  Base path: $BASE_PATH"
echo ""

# --- Step 1: Generate wrangler.jsonc ---
if [[ ! -f "$APP_DIR/wrangler.jsonc" ]]; then
  echo "→ Creating wrangler.jsonc"
  cat > "$APP_DIR/wrangler.jsonc" << WRANGLER
{
  "\$schema": "node_modules/wrangler/config-schema.json",
  "name": "${WORKER_NAME}",
  "main": ".open-next/worker.js",
  "account_id": "097c92553b268f8360b74f625f6d980a",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],

  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },

  "services": [
    {
      "binding": "WORKER_SELF_REFERENCE",
      "service": "${WORKER_NAME}"
    }
  ]

  // Auth secrets — set via: wrangler secret put AUTH_SECRET
  // For local dev, create .dev.vars with:
  //   AUTH_SECRET=...
  //   AUTH_GOOGLE_ID=...
  //   AUTH_GOOGLE_SECRET=...

  // Uncomment for ISR:
  // "r2_buckets": [{ "binding": "NEXT_INC_CACHE_R2_BUCKET", "bucket_name": "wv-${APP_NAME}-cache" }]
}
WRANGLER
  echo "  ✓ wrangler.jsonc created"
else
  echo "  ✓ wrangler.jsonc already exists"
fi

# --- Step 2: Generate open-next.config.ts ---
if [[ ! -f "$APP_DIR/open-next.config.ts" ]]; then
  echo "→ Creating open-next.config.ts"
  cat > "$APP_DIR/open-next.config.ts" << 'OPENNEXT'
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
OPENNEXT
  echo "  ✓ open-next.config.ts created"
else
  echo "  ✓ open-next.config.ts already exists"
fi

# --- Step 3: Check dependencies ---
if ! grep -q "@opennextjs/cloudflare" "$APP_DIR/package.json" 2>/dev/null; then
  echo "→ Installing @opennextjs/cloudflare and wrangler"
  cd "$REPO_ROOT"
  npm install -D wrangler@latest @opennextjs/cloudflare@latest --workspace="apps/$APP_NAME"
  echo "  ✓ Dependencies installed"
else
  echo "  ✓ CF dependencies already installed"
fi

# --- Step 4: Add .open-next to gitignore ---
if [[ -f "$APP_DIR/.gitignore" ]]; then
  if ! grep -q ".open-next" "$APP_DIR/.gitignore" 2>/dev/null; then
    echo ".open-next" >> "$APP_DIR/.gitignore"
    echo "  ✓ Added .open-next to .gitignore"
  fi
else
  echo ".open-next" > "$APP_DIR/.gitignore"
  echo "  ✓ Created .gitignore with .open-next"
fi

# --- Step 5: Build ---
echo ""
echo "→ Running OpenNext build for $APP_NAME"
cd "$APP_DIR"
npx opennextjs-cloudflare build

echo ""
echo "✓ Build complete"

# --- Step 6: Deploy or preview ---
case "$ACTION" in
  --deploy)
    echo ""
    echo "→ Deploying $WORKER_NAME to Cloudflare Workers"
    npx opennextjs-cloudflare deploy
    echo ""
    echo "✓ Deployed! Check your Cloudflare dashboard for the .workers.dev URL"
    ;;
  --preview)
    echo ""
    echo "→ Starting local preview at http://localhost:8787${BASE_PATH}"
    npx opennextjs-cloudflare preview
    ;;
  *)
    echo ""
    echo "Build complete. Next steps:"
    echo "  Preview locally:  cd apps/$APP_NAME && npx opennextjs-cloudflare preview"
    echo "  Deploy to CF:     cd apps/$APP_NAME && npx opennextjs-cloudflare deploy"
    echo "  Or re-run:        ./scripts/migrate-to-cloudflare.sh $APP_NAME --deploy"
    ;;
esac
