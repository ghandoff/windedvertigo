#!/usr/bin/env bash
# Deploy the wv-harbour-read-the-room Cloudflare Worker.
#
# Static-asset Worker with a Durable Object (Room) for shared-room sync.
# No Next.js, no OpenNext — wrangler bundles worker.ts + the Room DO and
# ships public/ as static assets. Routing through the site Worker is
# configured in windedvertigo/site/next.config.ts (rewrite under
# /harbour/read-the-room/*).
#
# (Renamed from feel-cards on 2026-05-06.)
#
# Usage:
#   ./scripts/deploy-read-the-room.sh            # production deploy
#   ./scripts/deploy-read-the-room.sh --tail     # deploy then stream logs
#
# Prerequisites:
#   - wrangler authenticated (`npx wrangler whoami`)

set -euo pipefail

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$PATH"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/apps/harbour/read-the-room"
TAIL=false

for arg in "$@"; do
  case $arg in
    --tail) TAIL=true ;;
  esac
done

echo "==> Deploying wv-harbour-read-the-room..."
cd "$APP_DIR"
npx wrangler deploy

WORKER_URL="https://wv-harbour-read-the-room.windedvertigo.workers.dev"
echo ""
echo "Worker URL: $WORKER_URL"

echo ""
echo "==> Smoke check..."
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$WORKER_URL/")
if [ "$HTTP_CODE" = "200" ]; then
  echo "  GET / → 200 ✓"
else
  echo "  GET / → $HTTP_CODE ✗ (expected 200)"
  exit 1
fi

CREATE_OUT=$(curl -sS -X POST "$WORKER_URL/api/room")
if echo "$CREATE_OUT" | grep -q '"code"'; then
  echo "  POST /api/room → $CREATE_OUT ✓"
else
  echo "  POST /api/room → $CREATE_OUT ✗"
  exit 1
fi

if [ "$TAIL" = true ]; then
  echo ""
  echo "==> Streaming logs (ctrl-c to exit)..."
  npx wrangler tail
fi
