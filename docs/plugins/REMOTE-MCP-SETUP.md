# Mo / PaM / cARL — remote MCP setup (Claude Code + Cowork)

The three agents share one memory ("the brain") behind the port API
(`port.windedvertigo.com/api/{cmo,pam,carl}/*` + Supabase). Claude's apps reach it
through a hosted **remote MCP** endpoint — no local `node` server, so it works in both
Claude Code **and** Cowork (Claude Desktop), on any machine, Windows included.

Hosted endpoints:

| use | URL |
|-----|-----|
| **Cowork** — all three agents in one | `https://port.windedvertigo.com/api/mcp/agents/all` |
| Claude Code — Mo (CMO) | `https://port.windedvertigo.com/api/mcp/agents/mo` |
| Claude Code — PaM | `https://port.windedvertigo.com/api/mcp/agents/pam` |
| Claude Code — cARL | `https://port.windedvertigo.com/api/mcp/agents/carl` |

**Two ways to authenticate, depending on the app:**
- **Cowork → sign in.** You click *Connect* and sign in with your winded.vertigo Google
  account. **No token to paste.** (Cowork connectors use OAuth, not pasted tokens.)
- **Claude Code → a shared token.** The plugin reads `WV_AGENT_TOKEN` from your shell (ask
  Garrett for the value). Treat it like a password — don't paste it into public chats or commit it.

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

## B. Cowork (Claude Desktop app, each machine) — ONE connector, sign in

You add **one** connector and sign in. No token, no `WV_AGENT_TOKEN`, nothing to paste.

1. Open **Settings → Connectors → Add custom connector** (a.k.a. "Add remote MCP server").
2. **Name:** `winded.vertigo agents` · **URL:** `https://port.windedvertigo.com/api/mcp/agents/all`
   — leave the OAuth Client ID / Secret fields **blank**.
3. Save, then click **Connect**. A browser window opens → sign in with your **winded.vertigo
   Google account** → click **approve** on the "connect to your agents" screen.
4. Done. All three agents' tools (Mo `cmo_*`, PaM `pam_*`, cARL `carl_*` — 14 in total) appear
   in Cowork. Start a chat and say "talk to Mo".

> The connection lasts ~30 days, then you just click Connect + sign in again. If you don't see
> "Add custom connector" exactly here, look for **Connectors / MCP servers / Developer** in
> Settings — Cowork moves these between Desktop versions. Screenshot anything that doesn't match
> and ping Garrett.

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
- **OAuth (Cowork sign-in):** `port/app/api/oauth/*` (discovery metadata, dynamic client
  registration, PKCE `/authorize` reusing the Auth.js Google login + one-click consent,
  `/token`) + `port/lib/oauth/*` (HS256 JWTs signed with `NEXTAUTH_SECRET`, PKCE verify,
  `OAUTH_KV` store for codes + clients). The combined `…/agents/all` connector accepts the
  OAuth token; per-agent URLs accept the static token. `next.config.ts` rewrites the
  `/.well-known/oauth-*` paths onto the metadata routes; `middleware.ts` exempts
  `/.well-known/oauth` + `/api/oauth/`.
- **⚠️ Cloudflare WAF carve-out — do NOT delete.** The `windedvertigo.com` zone blocks AI-bot
  UAs (`ClaudeBot`/`anthropic-ai`/`Claude-User`), which is exactly what Anthropic's MCP
  connection sends. A WAF custom rule **"allow anthropic mcp + oauth on api paths"** skips
  bot/managed protection for `/api/mcp/`, `/api/oauth/`, `/.well-known/oauth` only. Without it,
  Cowork fails with *"the integration rejected the credentials"* even though the OAuth handshake
  looks perfect in the worker logs (the block happens at the CF edge, before the worker). The
  marketing site keeps full AI-scraper protection.
