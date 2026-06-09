# Cowork MCP setup — findings & fix (2026-06-08)

_From Payton's Windows cloud PC. Context: tried to get Mo, PaM, and cARL live in
the **Claude Desktop / Cowork** app via `setup-mcp-servers.py`._

## TL;DR

**`setup-mcp-servers.py` cannot make the agents appear in Cowork on this Claude
Desktop build (1.11187.4.0).** Prereqs, paths, `npm install`, config write, and a
clean app restart were all verified correct — the agents still don't show up in
Cowork. Root cause is architectural, not a misconfiguration: **Cowork/agent
sessions do not load the `mcpServers` block from
`claude_desktop_config.json`.** They build their tool surface from built-in
connectors + installed plugins only.

The **Claude Code** path on Windows *does* work, and is wired up now (see below),
so Payton can talk to the agents in a terminal today. Cowork needs a different
delivery mechanism.

## Evidence

After a confirmed clean restart (all desktop processes started 15:47, fresh
`app_ready` after the config write at 15:36), the session loaded **33 MCP
servers**. Full list from `main.log`:

> Canva, Gmail, Google Calendar, Google Drive, Notion, Slack, Claude in Chrome,
> mcp-registry, Claude Preview, ccd_session, ccd_directory, ccd_session_mgmt,
> scheduled-tasks, plugin:brand-voice:{notion,atlassian,box,figma,gong,
> microsoft-365,granola}, plugin:marketing:{slack,canva,figma,hubspot,amplitude,
> amplitude-eu,notion,ahrefs,similarweb,klaviyo,supermetrics,google calendar,gmail}

`mo-memory` / `pam-memory` / `carl-memory` appear **nowhere** — not in that list,
not anywhere in `main.log`, and `mcp-info.json` still lists only `mcp-registry` +
`Claude in Chrome`. Everything Cowork loads is either a built-in connector or a
`plugin:*` entry.

## Root cause

1. Cowork runs in a sandboxed VM. A server defined as `command: node` →
   `C:\Users\payto\...\index.js` can't execute there even if the config were read
   — the local path doesn't exist in the VM.
2. This Desktop build sources Cowork/agent MCP tools from connectors + installed
   plugins, **not** from `claude_desktop_config.json`'s `mcpServers`. So the
   script's whole approach is mismatched with how Cowork wires up. The claim in
   `docs/windows-mcp-setup.md` that "cowork reads this config" is not true for
   this version.

## Repo bugs found & fixed (this branch)

- **`plugin.json` `author` was a string**; the Claude Code plugin schema requires
  an object. Fixed in all three (`{"name": "winded.vertigo"}`). This blocked
  plugin install with `author: Invalid input: expected object, received string`.
- **No `marketplace.json`** existed. Added `.claude-plugin/marketplace.json` at
  the repo root listing the three plugins.
- **Cosmetic:** `mcp-servers/*/index.js` prints a stale `~/.zshrc` hint on missing
  token — harmless on Windows but worth updating.

## What works now (Claude Code on Windows)

Verified end-to-end:

- Node v24.16.0, Python 3.12.10 installed (were missing on the cloud PC).
- The shared memory API is live: `GET https://port.windedvertigo.com/api/cmo/briefing`
  with the agent token returns **HTTP 200** and current working state (entries
  dated 2026-06-08, written by `carl-automation`). The memory servers are thin
  proxies to this API — the shared layer is real and reachable.
- Added all three memory servers to Claude Code at **user scope**
  (`claude mcp add ...`, in `~/.claude.json`) — all three report **✓ Connected**.
- Installed all three plugins via the new local marketplace — all **enabled**.

→ In a **new Claude Code session opened in this repo**, "talk to Mo" activates the
persona (skill) and silently calls `cmo_briefing` (MCP) for shared memory.

## Resolution for Cowork (confirmed 2026-06-08)

Garrett stood up a **remote (HTTP) MCP endpoint** that serves all three agents,
which is exactly the path this investigation pointed to (the Cowork VM can reach a
URL; it can't run local stdio). No token, no terminal, no `claude_desktop_config`.

**Endpoint:** `https://port.windedvertigo.com/api/mcp/agents/all`
(verified live from the Windows cloud PC — returns HTTP 401 to an unauthenticated
GET, i.e. up and OAuth-gated.)

**Setup in Cowork (one-time, GUI):**

1. Cowork → Settings → Connectors → **Add custom connector**.
2. Name: `winded.vertigo agents` · URL: the endpoint above · leave OAuth Client
   ID/Secret blank → **Add**.
3. Click **Connect** → browser opens → sign in with your winded.vertigo Google
   account → **Approve**. Status flips to **Connected**.
4. Start a chat: _"talk to Mo, give me a briefing."_ — pulls the real shared
   memory (pipeline, play-conference campaign, team focus, etc.).

Note: this supersedes the config-file approach for Cowork. The Claude Code wiring
below (local stdio servers + local marketplace) still works for terminal use but
is optional now that the remote connector exists.
