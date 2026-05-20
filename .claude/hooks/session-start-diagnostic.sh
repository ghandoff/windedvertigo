#!/usr/bin/env bash
# session-start-diagnostic.sh
#
# SessionStart hook for the windedvertigo monorepo. Reports collision-surface
# state at the top of every Claude Code session so concurrent sessions notice
# each other BEFORE editing — without taking any auto-actions on the tree.
#
# Reports:
#   - current branch + tracking + dirty-file count
#   - local main divergence from origin/main (the today-incident pattern)
#   - currently open draft PRs (work-in-flight signals from other sessions)
#
# Wired up in .claude/settings.json under hooks.SessionStart.
#
# To temporarily disable: comment out the matcher block in settings.json,
# or `chmod -x` this file (the hook will fail and the session starts silently).

set -uo pipefail

# Be silent and harmless if anything goes wrong — never block session start.
emit_empty() {
  echo '{}'
  exit 0
}

cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || emit_empty
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || emit_empty

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
tracking=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "(no upstream)")
dirty=$(git status --porcelain 2>/dev/null | grep -cv '^$' || echo 0)

# Refresh origin refs quietly with a hard timeout so a slow network never
# blocks session start. Failure here is fine — we report what we know.
timeout 5 git fetch --quiet origin 2>/dev/null || true

main_ahead=0
main_behind=0
if git rev-parse --verify main >/dev/null 2>&1 && \
   git rev-parse --verify origin/main >/dev/null 2>&1; then
  main_ahead=$(git rev-list --count origin/main..main 2>/dev/null || echo 0)
  main_behind=$(git rev-list --count main..origin/main 2>/dev/null || echo 0)
fi

lines=()
lines+=("branch: ${branch}  →  ${tracking}")
lines+=("dirty files: ${dirty}")

if [ "${main_ahead}" -gt 0 ]; then
  lines+=("")
  lines+=("⚠ local main is ${main_ahead} commit(s) AHEAD of origin/main.")
  lines+=("   another session may have unpushed work here. before committing to main:")
  lines+=("     git log origin/main..main --oneline    # see which commits")
  lines+=("     git log origin/main..main --format='%h %an %s %d'    # by author")
fi

if [ "${main_behind}" -gt 0 ]; then
  lines+=("ℹ local main is ${main_behind} commit(s) behind origin/main.")
  lines+=("   pull/rebase before starting main-track work.")
fi

# Open draft PRs — work-in-flight signals from concurrent sessions.
if command -v gh >/dev/null 2>&1; then
  drafts=$(gh pr list --draft --state open \
    --json number,title,headRefName,author \
    --template '{{range .}}  #{{.number}}  {{.title}}  ({{.headRefName}}, {{.author.login}}){{"\n"}}{{end}}' \
    2>/dev/null || true)
  if [ -n "${drafts}" ]; then
    lines+=("")
    lines+=("open draft PRs — work in flight, do not edit the same files:")
    while IFS= read -r line; do
      [ -n "${line}" ] && lines+=("${line}")
    done <<< "${drafts}"
  fi
fi

# Compose the additionalContext block.
body=$(printf '%s\n' "${lines[@]}")
context=$'<session-start-diagnostic>\n'"${body}"$'\n</session-start-diagnostic>'

# jq is the safe way to JSON-encode an arbitrary multiline string.
if command -v jq >/dev/null 2>&1; then
  jq -n --arg ctx "${context}" \
    '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
else
  # Fallback: best-effort string escaping. Newlines → \n, quotes → \".
  escaped=$(printf '%s' "${context}" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk 'BEGIN{ORS="\\n"} {print}')
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "${escaped}"
fi
