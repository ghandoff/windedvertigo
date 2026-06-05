# winded.vertigo agent plugins

three cowork plugins — one per AI agent. each plugin gives claude persistent
memory via the port API, so Mo, PaM, and cARL remember decisions across sessions.

| plugin | agent | file |
|--------|-------|------|
| `mo-cmo.plugin` | Mo — CMO | `dist/mo-cmo.plugin` |
| `pam-pm.plugin` | PaM — project manager | `dist/pam-pm.plugin` |
| `carl-research.plugin` | cARL — research | `dist/carl-research.plugin` |

The built `.plugin` files are committed to the repo (in `dist/`), so you can
install them straight from a fresh clone — no build step needed.

## 1 · one-time setup: your agent token

the plugins talk to the memory api using a shared token, `WV_AGENT_TOKEN`.
**ask garrett for the value** (it's the same for all three agents and is
deliberately not stored in the repo), then add it to your shell:

**macOS / Linux (zsh or bash):**
```bash
echo 'export WV_AGENT_TOKEN="paste-the-token-from-garrett"' >> ~/.zshrc
source ~/.zshrc          # or ~/.bashrc if you use bash
```

**Windows (PowerShell):**
```powershell
setx WV_AGENT_TOKEN "paste-the-token-from-garrett"
# then open a NEW terminal so the variable is picked up
```

## 2 · install a plugin in cowork

1. open cowork
2. plugins → install from file
3. pick the `.plugin` you want from `docs/plugins/dist/`
4. start a session — the agent loads its memory automatically

prefer claude code? you don't need the plugins at all — just `cd docs/cmo`
(or `docs/pam`, `docs/carl`) and start talking.

## rebuilding the plugins (maintainers)

after editing any plugin's source — `mcp-servers/*/index.js`, a `SKILL.md`,
`plugin.json`, etc. — rebuild the `.plugin` files and commit them:

```bash
bash docs/plugins/build.sh
```

requirements: node 18+ and the `zip` command (mac: built-in; linux: `apt install
zip`; windows: git-bash or WSL). the script runs `npm install` in each MCP
server and re-zips all three plugins into `dist/`.

## architecture

each plugin has:
- `.claude-plugin/plugin.json` — manifest
- `.mcp.json` — stdio MCP server config (points to a local node process via `${CLAUDE_PLUGIN_ROOT}`)
- `skills/{agent}/SKILL.md` — persona and behaviour instructions
- `mcp-servers/{agent}-memory/index.js` — MCP server (reads `WV_AGENT_TOKEN` from env)

the MCP server calls `https://port.windedvertigo.com/api/{agent}/*` with bearer
auth. memory is stored in supabase (wv-port-pilot project). no secret values live
in the repo — the token comes from your shell environment.
