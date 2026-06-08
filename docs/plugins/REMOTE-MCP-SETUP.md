# Mo / PaM / cARL — remote MCP setup (Claude Code + Cowork)

The three agents share one memory ("the brain") behind the port API
(`port.windedvertigo.com/api/{cmo,pam,carl}/*` + Supabase). Claude's apps reach it
through a hosted **remote MCP** endpoint — no local `node` server, so it works in both
Claude Code **and** Cowork (Claude Desktop), on any machine, Windows included.

Hosted endpoints (one per agent):

| agent | URL |
|-------|-----|
| Mo (CMO) | `https://port.windedvertigo.com/api/mcp/agents/mo` |
| PaM | `https://port.windedvertigo.com/api/mcp/agents/pam` |
| cARL | `https://port.windedvertigo.com/api/mcp/agents/carl` |

**Auth:** a single shared bearer token (ask Garrett for `WV_AGENT_TOKEN`). It's the same
token the agents already use. Treat it like a password — don't paste it into public chats
or commit it.

---

## A. Claude Code (terminal, each machine)

1. **Set the token** once in your shell profile (so the plugin can read it):
   - macOS/Linux (`~/.zshrc` or `~/.bashrc`): `export WV_AGENT_TOKEN="<token>"`
   - Windows (PowerShell, persistent): `setx WV_AGENT_TOKEN "<token>"` then reopen the terminal.
2. **Add the marketplace + install the plugins** (from the repo root):
   ```
   /plugin marketplace add ghandoff/windedvertigo
   /plugin install mo-cmo
   /plugin install pam-pm
   /plugin install carl-research
   ```
   (Or `/plugin marketplace add .` if you're inside a local checkout.)
3. **Restart the Claude Code session.** Each plugin's `.mcp.json` now points at the hosted
   URL with `Authorization: Bearer ${WV_AGENT_TOKEN}`, so the memory server connects over
   HTTP — no local node process.
4. **Use it:** in a session opened in the repo, say "I want to talk to Mo." The persona skill
   activates and silently calls `cmo_briefing` to load shared memory. Decisions you log show
   up on the `/strategy` (Mo), `/pam`, or `/carl` dashboards.

Verify: `/mcp` should list `mo-memory` / `pam-memory` / `carl-memory` as **connected**.

---

## B. Cowork (Claude Desktop app, each machine)

Cowork can't run local servers, so add each agent as a **custom connector** (remote MCP):

1. Open **Settings → Connectors → Add custom connector** (a.k.a. "Add remote MCP server").
2. **Name:** `mo-memory` · **URL:** `https://port.windedvertigo.com/api/mcp/agents/mo`
3. When asked for authentication, provide the **bearer token** (`WV_AGENT_TOKEN`) — this build
   uses a static token, not OAuth, so paste it in the token/authorization field (under
   "Advanced" if that's where the token field lives in your version).
4. Repeat for **pam** (`…/api/mcp/agents/pam`) and **carl** (`…/api/mcp/agents/carl`).
5. Start a Cowork session and confirm the agent's tools appear (e.g. `cmo_briefing`) and a
   briefing loads.

> Cowork's connector UI changes between Desktop versions. If "Add custom connector" isn't
> where this says, look for **Connectors / MCP servers / Developer** in Settings. If a clean
> marketplace install becomes available for Cowork, that's preferred — this manual connector
> path is the always-works fallback. Flag anything that doesn't match and we'll update this doc.

---

## Quick health check (no Claude needed)

Anyone with the token can confirm the endpoint is alive:

```
curl -s https://port.windedvertigo.com/api/mcp/agents/mo \
  -H "Authorization: Bearer $WV_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq '.result.tools[].name'
```
Should print `cmo_briefing`, `cmo_log_decision`, `cmo_update_memory`. Swap `mo` → `pam` / `carl`
for the others.

## Troubleshooting

- **401 unauthorized** → token wrong/missing. Re-check `WV_AGENT_TOKEN`.
- **Tools don't appear in Claude Code** → restart the session; confirm the plugin is enabled
  (`/plugin`) and the env var is set in the shell that launched Claude Code.
- **Tools don't appear in Cowork** → re-add the connector; confirm the URL has no trailing
  slash and the token is in the auth field.
- **A tool errors** → the hosted endpoint proxies the same `/api/{agent}/*` API; a 500 there
  usually means the backend, not the connector. Check the `/strategy|/pam|/carl` dashboard loads.

## How this is wired (for maintainers)

- Hosted endpoint: `port/app/api/mcp/agents/[agent]/route.ts` (JSON-RPC 2.0 MCP over HTTP;
  mirrors `port/app/api/mcp/v1/route.ts`). It's a thin shim that self-fetches the existing
  `/api/{cmo,pam,carl}/*` API. To add/rename a tool, edit that one file.
- Plugins point here via `docs/plugins/*/.mcp.json` (`type: http`, `url`, `Authorization` header).
- The old local `docs/plugins/*/mcp-servers/*/index.js` servers are kept as reference/fallback.
