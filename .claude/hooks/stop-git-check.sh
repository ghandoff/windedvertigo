#!/usr/bin/env bash
# stop-git-check.sh
#
# Stop hook for the windedvertigo monorepo. When a Claude Code session finishes
# responding, gently remind the user IF they have commits that haven't been
# pushed — because the remote is the only copy another machine or teammate can
# see, and stranded local commits are the #1 cause of cross-device messes.
#
# Deliberately low-noise: it stays silent unless there are unpushed commits. It
# never blocks the session. Shared via the repo (referenced in settings.json as
# $CLAUDE_PROJECT_DIR/.claude/hooks/stop-git-check.sh) so every clone behaves the
# same — replacing the old per-machine ~/.claude path that only worked for one
# person.
#
# To disable: comment out the Stop matcher block in .claude/settings.json.

set -uo pipefail

emit_empty() { echo '{}'; exit 0; }

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || emit_empty
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || emit_empty

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
unpushed=$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)

# Silent unless there's something another machine genuinely can't see.
[ "${unpushed}" -gt 0 ] 2>/dev/null || emit_empty

msg="🔄 ${unpushed} unpushed commit(s) on '${branch}'. Push so your other machines and teammates can see them: git push  (or ./scripts/wv-handoff.sh)"

if command -v jq >/dev/null 2>&1; then
  jq -n --arg m "${msg}" '{systemMessage: $m}'
else
  esc=$(printf '%s' "${msg}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
  printf '{"systemMessage":"%s"}\n' "${esc}"
fi
exit 0
