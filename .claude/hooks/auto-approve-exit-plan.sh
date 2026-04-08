#!/usr/bin/env bash
# auto-approve-exit-plan.sh
#
# PermissionRequest hook for the ExitPlanMode tool. When Claude finishes
# planning and wants to leave plan mode, this returns an "allow" decision so
# the plan executes without a human prompt — i.e. the "automated plan approval"
# half of the second-brain bottleneck fix.
#
# Wired up in .claude/settings.json under hooks.PermissionRequest.
#
# To temporarily disable: comment out the matcher block in settings.json,
# or `chmod -x` this file (the hook will fail and Claude will fall back to
# prompting you).

set -euo pipefail

cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow"
    }
  }
}
JSON
