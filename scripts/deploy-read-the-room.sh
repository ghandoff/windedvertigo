#!/usr/bin/env bash
# Deploy the wv-harbour-read-the-room Cloudflare Worker.
#
# Static-asset Worker with a Durable Object (Room) for shared-room sync.
# No Next.js, no OpenNext — wrangler bundles worker.ts + the Room DO and
# ships public/ as static assets.
#
# Routing: the worker has its own CF edge routes for
# windedvertigo.com/harbour/read-the-room* (see wrangler.jsonc), so live
# traffic comes here directly. The site/next.config.ts rewrite under the
# same path is a redundant fallback — both have to break for the URL to
# 404.
#
# (Renamed from feel-cards on 2026-05-06; CF routes added 2026-05-07.)
#
# Usage:
#   ./scripts/deploy-read-the-room.sh            # production deploy + smoke
#   ./scripts/deploy-read-the-room.sh --tail     # then stream logs
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
LIVE_URL="https://www.windedvertigo.com/harbour/read-the-room"

# Helper — fail loudly with context.
fail() { echo "  ✗ $1"; exit 1; }
ok()   { echo "  ✓ $1"; }

echo ""
echo "==> Smoke checks (workers.dev)..."
HTTP_CODE=$(curl -sS -o /tmp/rtr-wd.html -w "%{http_code}" "$WORKER_URL/")
[ "$HTTP_CODE" = "200" ] && ok "GET $WORKER_URL/ → 200" || fail "GET / → $HTTP_CODE"
grep -q "read the room: a quiet game of interpretation" /tmp/rtr-wd.html \
  && ok "title matches"  || fail "title not found in served HTML"
CREATE_OUT=$(curl -sS -X POST "$WORKER_URL/api/room")
echo "$CREATE_OUT" | grep -q '"code"' \
  && ok "POST /api/room → $CREATE_OUT" || fail "POST /api/room → $CREATE_OUT"

# Live URL via CF edge route (windedvertigo.com). The X-Served-By header
# proves traffic actually hit this worker via the route, not a fallback.
echo ""
echo "==> Smoke checks (live URL via CF route)..."
HEAD_OUT=$(curl -sS -D /tmp/rtr-live.headers -o /tmp/rtr-live.html -w "%{http_code}" "$LIVE_URL?_=smoke$(date +%s)")
[ "$HEAD_OUT" = "200" ] && ok "GET $LIVE_URL → 200" || fail "GET live → $HEAD_OUT"
grep -q "read the room: a quiet game of interpretation" /tmp/rtr-live.html \
  && ok "live title matches" || fail "live HTML missing the title — route may not be serving this Worker"
grep -qi "^x-served-by: wv-harbour-read-the-room" /tmp/rtr-live.headers \
  && ok "X-Served-By header confirms CF route hit this Worker directly" \
  || echo "  ! X-Served-By header missing — live URL may be served via the wv-site fallback rewrite. Not fatal, but worth investigating."

echo ""
echo "✓ wv-harbour-read-the-room deployed — $LIVE_URL"

if [ "$TAIL" = true ]; then
  echo ""
  echo "==> Streaming logs (ctrl-c to exit)..."
  npx wrangler tail
fi
