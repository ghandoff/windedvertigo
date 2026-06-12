#!/usr/bin/env bash
# rebuild all four agent .plugin files.
# run this after editing any plugin's source (index.js, SKILL.md, plugin.json…),
# then commit the updated dist/*.plugin files.
#
# requirements: node 18+ and the `zip` command (mac: built-in; linux: apt install zip;
# windows: use git-bash or WSL).
set -euo pipefail
cd "$(dirname "$0")"

AGENTS=(mo-cmo pam-pm carl-research opsy-ops)

for a in "${AGENTS[@]}"; do
  server_dir="$a/mcp-servers/$(ls "$a/mcp-servers")"
  echo "installing deps for $a ($server_dir)…"
  npm install --prefix "$server_dir" --silent
done

mkdir -p dist && rm -f dist/*.plugin
for a in "${AGENTS[@]}"; do
  ( cd "$a" && zip -rq "../dist/$a.plugin" . -x "*.DS_Store" "*/.in_use/*" )
  echo "built dist/$a.plugin"
done

echo ""
echo "done. the .plugin files are in dist/ — install them in cowork:"
echo "  plugins → install from file → pick dist/<agent>.plugin"
