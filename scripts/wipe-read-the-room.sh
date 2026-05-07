#!/usr/bin/env bash
# Wipe a single read-the-room room by code. Use when someone reports being
# stuck in a room and the client-side ?reset=1 hatch doesn't fix it
# (e.g., they're locked into a phase the UI doesn't have an exit for).
#
# Wiping a room:
#   - Closes every active WebSocket on that room with close code 4404
#     (the client treats 4404 as "room gone", clears its localStorage,
#     and bounces back to the welcome screen).
#   - Deletes all DO storage for that code.
#   - Idempotent — running it on a code that's already empty is fine.
#
# The token lives at ~/.config/wv/read-the-room-wipe-token (chmod 600).
# Provisioned via:
#   printf "$TOKEN" | (cd apps/harbour/read-the-room && npx wrangler secret put WIPE_TOKEN)
#
# (Renamed from feel-cards on 2026-05-06.)
#
# Usage:
#   scripts/wipe-read-the-room.sh ABCDEF

set -euo pipefail

CODE="${1:-}"
if [[ -z "$CODE" ]]; then
  echo "usage: $0 <ROOM-CODE>"
  echo "  e.g.: $0 ABCDEF"
  exit 1
fi

CODE_UPPER=$(echo "$CODE" | tr '[:lower:]' '[:upper:]')
if [[ ! "$CODE_UPPER" =~ ^[BCDFGHJKLMNPQRSTVWXYZ]{6}$ ]]; then
  echo "error: code must be 6 uppercase consonants (no vowels). got: $CODE_UPPER"
  exit 1
fi

TOKEN_FILE="$HOME/.config/wv/read-the-room-wipe-token"
if [[ ! -f "$TOKEN_FILE" ]]; then
  echo "error: token file missing at $TOKEN_FILE"
  echo "rotate via:"
  echo "  printf \"\$NEW\" | (cd apps/harbour/read-the-room && npx wrangler secret put WIPE_TOKEN)"
  exit 1
fi
TOKEN=$(cat "$TOKEN_FILE")

HOST="https://wv-harbour-read-the-room.windedvertigo.workers.dev"

echo "→ wiping room $CODE_UPPER..."
RESPONSE=$(curl -sS -X POST -H "Authorization: Bearer $TOKEN" "$HOST/api/admin/wipe/$CODE_UPPER")
echo "  response: $RESPONSE"

if echo "$RESPONSE" | grep -q '"wiped":true'; then
  echo "✓ room had state — wiped clean. Any connected clients were kicked."
elif echo "$RESPONSE" | grep -q '"wiped":false'; then
  echo "✓ room was already empty (idempotent — no harm done)."
else
  echo "✗ unexpected response."
  exit 1
fi
