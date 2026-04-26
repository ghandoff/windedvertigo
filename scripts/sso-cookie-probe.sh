#!/usr/bin/env bash
# SSO cookie-share regression probe.
#
# The windedvertigo stack has THREE auth pools, not one. See
# `harbour-apps/docs/security/auth-pool-audit-2026-04-25.md` for the
# full picture. The short version:
#
#   Pool A — harbour apps share cookies on `.windedvertigo.com`
#            (cookie name: `authjs.session-token`)
#            members today: creaseworks, vertigo-vault, depth-chart
#            launching: harbour hub (Phase 3)
#
#   Pool B — port (host-scoped on port.windedvertigo.com)
#            cookie name in prod: `__Secure-authjs.session-token`
#
#   Pool C — ops  (host-scoped on ops.windedvertigo.com)
#            cookie name in prod: `__Secure-authjs.session-token`
#
# Pool B and C use the same code but different hosts → independent. So
# this script tests pool-by-pool, each with its own captured cookie.
#
# Usage:
#   ./scripts/sso-cookie-probe.sh --harbour <cookie>   # probe pool A
#   ./scripts/sso-cookie-probe.sh --port    <cookie>   # probe pool B
#   ./scripts/sso-cookie-probe.sh --ops     <cookie>   # probe pool C
#
# How to capture each cookie:
#
#   Pool A (harbour):
#     1. Open https://www.windedvertigo.com/harbour/creaseworks in private window
#     2. Sign in with Google
#     3. DevTools → Application → Cookies → .windedvertigo.com
#     4. Copy the value of `authjs.session-token`
#
#   Pool B (port):
#     1. Open https://port.windedvertigo.com in private window
#     2. Sign in with Google
#     3. DevTools → Cookies → port.windedvertigo.com
#     4. Copy the value of `__Secure-authjs.session-token`
#
#   Pool C (ops):
#     Same as Pool B but origin `ops.windedvertigo.com`.
#
# Exit codes:
#   0 — every probe in the chosen pool returned a valid session
#   1 — at least one probe failed
#   2 — usage error

set -euo pipefail

POOL="${1:-}"
COOKIE_VALUE="${2:-}"

if [[ -z "$POOL" || -z "$COOKIE_VALUE" ]]; then
  cat <<USAGE >&2
usage:
  $0 --harbour <cookie-value>
  $0 --port    <cookie-value>
  $0 --ops     <cookie-value>
USAGE
  exit 2
fi

case "$POOL" in
  --harbour)
    POOL_LABEL="A (harbour)"
    COOKIE_NAME="authjs.session-token"
    declare -a PROBES=(
      "creaseworks  | https://www.windedvertigo.com/harbour/creaseworks/api/auth/session"
      "vault        | https://windedvertigo.com/harbour/vertigo-vault/api/auth/session"
      "depth-chart  | https://windedvertigo.com/harbour/depth-chart/api/auth/session"
    )
    ;;
  --port)
    POOL_LABEL="B (port)"
    COOKIE_NAME="__Secure-authjs.session-token"
    declare -a PROBES=(
      "port         | https://port.windedvertigo.com/api/auth/session"
    )
    ;;
  --ops)
    POOL_LABEL="C (ops)"
    COOKIE_NAME="__Secure-authjs.session-token"
    declare -a PROBES=(
      "ops          | https://ops.windedvertigo.com/api/auth/session"
    )
    ;;
  *)
    echo "unknown pool flag: $POOL" >&2
    exit 2
    ;;
esac

# /api/auth/session returns:
#   - "null" when no session
#   - {"user":{...},"expires":"..."} when authenticated
# We assert the response contains "user" — indicating a valid session.
EXPECT="user"
COOKIE_HEADER="${COOKIE_NAME}=${COOKIE_VALUE}"

PASS=0
FAIL=0
FAIL_DETAILS=""

printf "\n=== Pool %s — cookie %s ===\n" "$POOL_LABEL" "$COOKIE_NAME"
printf "%-14s %-72s %-8s %s\n" "origin" "url" "status" "result"
printf '%.0s-' {1..120}; printf "\n"

for row in "${PROBES[@]}"; do
  IFS='|' read -r LABEL URL <<< "$row"
  LABEL="$(echo -n "$LABEL" | xargs)"
  URL="$(echo -n "$URL" | xargs)"

  RESP="$(curl -s -L -m 10 -w '\n__HTTP__:%{http_code}' -H "Cookie: $COOKIE_HEADER" "$URL" 2>&1 || true)"
  STATUS="$(printf '%s' "$RESP" | tail -1 | sed 's/^__HTTP__://')"
  BODY="$(printf '%s' "$RESP" | sed '$d')"

  if [[ "$STATUS" == "200" ]] && printf '%s' "$BODY" | grep -q "$EXPECT"; then
    printf "%-14s %-72s %-8s ✓ session valid\n" "$LABEL" "$URL" "$STATUS"
    PASS=$((PASS + 1))
  else
    printf "%-14s %-72s %-8s ✗ FAIL\n" "$LABEL" "$URL" "$STATUS"
    FAIL=$((FAIL + 1))
    FAIL_DETAILS+=$'\n'"  - $LABEL → $URL"$'\n'"    status: $STATUS"$'\n'"    body (first 200 chars): $(printf '%s' "$BODY" | head -c 200)"
  fi
done

printf '%.0s-' {1..120}; printf "\n"
printf "passed: %d   failed: %d\n" "$PASS" "$FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  printf "\nfailure details:%s\n" "$FAIL_DETAILS"
  exit 1
fi
exit 0
