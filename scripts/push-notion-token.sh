#!/usr/bin/env bash
# Prompts for the Notion integration token, validates the format, and pushes
# it as a secret to both wv-port and wv-port-jobs CF Workers. The token never
# touches a chat surface or persistent file — only stdin → wrangler stdin.
#
# Usage:
#   bash /Users/garrettjaeger/Projects/windedvertigo/scripts/push-notion-token.sh

set -uo pipefail

PORT_DIR="/Users/garrettjaeger/Projects/windedvertigo/port"
JOBS_DIR="/Users/garrettjaeger/Projects/windedvertigo/port-jobs"

echo
echo "Paste the Notion integration token from https://www.notion.so/my-integrations → Show → copy the secret."
echo "Then press Enter. (Token is hidden as you paste — that's normal.)"
echo
printf "Token: "
# bash builtin: -s hides input, -r prevents backslash mangling.
# Reads exactly one line into NTOK, regardless of how it was pasted.
read -rs NTOK
echo

# Trim leading/trailing whitespace + any stray newlines
NTOK="${NTOK#"${NTOK%%[![:space:]]*}"}"
NTOK="${NTOK%"${NTOK##*[![:space:]]}"}"

# Sanity checks
LEN=${#NTOK}
PREFIX="${NTOK:0:6}"

if [ "$LEN" -lt 40 ] || [ "$LEN" -gt 80 ]; then
  echo "✘ token length $LEN looks wrong (expected ~50 chars)."
  echo "  prefix observed: '$PREFIX'"
  echo "  → re-run this script and paste only the token value, nothing else."
  exit 1
fi

case "$PREFIX" in
  secret_*|ntn_*)
    echo "✓ token format looks right ($LEN chars, prefix '$PREFIX...')"
    ;;
  *)
    echo "✘ token prefix '$PREFIX' is not 'secret_' or 'ntn_' — that's not a Notion integration token."
    echo "  → re-run and paste the token from the 'Show' button on the integration page."
    exit 1
    ;;
esac

echo
echo "Pushing to wv-port..."
echo "$NTOK" | (cd "$PORT_DIR" && npx --no-install wrangler secret put NOTION_TOKEN 2>&1) | tail -3 || {
  echo "✘ wv-port push failed"
  unset NTOK
  exit 1
}

echo
echo "Pushing to wv-port-jobs..."
echo "$NTOK" | (cd "$JOBS_DIR" && npx --no-install wrangler secret put NOTION_TOKEN 2>&1) | tail -3 || {
  echo "✘ wv-port-jobs push failed"
  unset NTOK
  exit 1
}

unset NTOK
echo
echo "✓ both secrets uploaded. now reply 'go v5' in chat — the agent will verify and run the bulk regen."
