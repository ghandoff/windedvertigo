# winded.vertigo agent plugins

three cowork plugins — one per AI agent. each plugin gives claude persistent memory via the port API.

## plugins

| plugin | agent | file |
|--------|-------|------|
| `mo-cmo.plugin` | Mo — CMO | `dist/mo-cmo.plugin` |
| `pam-pm.plugin` | PaM — project manager | `dist/pam-pm.plugin` |
| `carl-research.plugin` | cARL — research | `dist/carl-research.plugin` |

## one-time setup

add the API token to your shell environment. ask garrett for the `WV_AGENT_TOKEN` value, then:

```bash
# add to ~/.zshrc
export WV_AGENT_TOKEN=<token-from-garrett>
```

restart your terminal (or `source ~/.zshrc`) after adding.

## building the .plugin files

the `dist/` directory is gitignored. to build and install locally:

```bash
# from this directory
cd mo-cmo && zip -r ../dist/mo-cmo.plugin . -x "*.DS_Store" && cd ..
cd pam-pm && zip -r ../dist/pam-pm.plugin . -x "*.DS_Store" && cd ..
cd carl-research && zip -r ../dist/carl-research.plugin . -x "*.DS_Store" && cd ..
```

## installing a plugin in cowork

1. open cowork
2. go to plugins → install from file
3. select the `.plugin` file from `docs/plugins/dist/`
4. restart the session

## architecture

each plugin has:
- `.claude-plugin/plugin.json` — manifest
- `.mcp.json` — stdio MCP server config (points to local node process)
- `skills/{agent}/SKILL.md` — persona and behaviour instructions
- `mcp-servers/{agent}-memory/index.js` — MCP server (reads `WV_AGENT_TOKEN` from env)

the MCP server calls `https://port.windedvertigo.com/api/{agent}/*` with bearer auth.
memory is stored in supabase (wv-port-pilot project).
