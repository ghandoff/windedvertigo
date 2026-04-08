#!/usr/bin/env bash
# claude-remote.sh
#
# Launches Claude Code Remote Control for the winded.vertigo monorepo so you
# can steer the session and approve permissions from the Claude iOS app or
# claude.ai/code on Safari.
#
# One-time setup on your dev machine:
#   1. claude auth login            # full-scope login (NOT setup-token)
#   2. ./scripts/claude-remote.sh   # this script
#   3. Press SPACE in the terminal to toggle the QR code
#   4. Open the Claude app on iPhone → scan the QR
#
# After that, the session shows up in the app's session list and you can
# steer it from anywhere on the same network (or via Tailscale / cloudflared
# tunnel if you want it reachable off-network).
#
# Notes:
#   - Remote Control requires a full-scope login token. CLAUDE_CODE_OAUTH_TOKEN
#     and `claude setup-token` are inference-only and will fail with:
#       "Remote Control requires a full-scope login token."
#   - Combined with .claude/settings.json (defaultMode: acceptEdits + the
#     ExitPlanMode auto-approve hook), the only prompts you should see on the
#     phone are git push, vercel deploys, and the few items in permissions.ask.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSION_NAME="${CLAUDE_REMOTE_NAME:-w.v bench}"

cd "$REPO_DIR"

echo "→ launching claude remote-control"
echo "  repo:    $REPO_DIR"
echo "  session: $SESSION_NAME"
echo "  tip:     press SPACE in the claude UI to show the QR code"
echo

exec claude remote-control --name "$SESSION_NAME" "$@"
