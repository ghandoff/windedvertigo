# prompt for payton — install the three agent MCP servers (windows)

> send this to payton **after** the `fix/cross-platform-mcp-setup` change is
> merged to main, so her `git pull` picks up the cross-platform script.
> paste everything below the line into a claude code session opened in her
> windedvertigo repo.

---

i'm on windows (claude code in a terminal). i want mo, pam, and cARL set up as
MCP servers for the claude **desktop app** so they're live in cowork with their
shared persistent memory — the memory layer they use is the same one the rest of
the winded.vertigo collective writes to, so they should already know our recent
decisions and commitments once connected.

please get them working on this machine. specifics that have tripped this up
before:

- the setup is for the claude **desktop app** (cowork), not this claude code
  session. on windows the config it writes is
  `%APPDATA%\Claude\claude_desktop_config.json`.
- the repo's `setup-mcp-servers.py` is cross-platform now and bakes the agent
  token straight into the config, so there is **no** `WV_AGENT_TOKEN` / `.zshrc`
  step — ignore the old mac instructions.
- run it with `python` (not `python3`).

steps i'd like you to walk me through and run:

1. `git pull --rebase origin main` so i have the latest cross-platform script.
2. confirm `node --version` and `python --version` both work; if node is
   missing, stop and tell me.
3. make sure the three servers under `docs\plugins\*\mcp-servers\*` have their
   `node_modules` (run `npm install` per server if not).
4. run `python setup-mcp-servers.py` and show me the output — flag any
   `WARNING: ... entry point not found` lines (means my repo isn't at
   `%USERPROFILE%\Projects\windedvertigo`).
5. tell me to fully quit the claude desktop app from the system tray (not just
   close the window) and reopen it.
6. then i'll open a cowork session with the windedvertigo folder mounted and say
   "i want to talk to Mo" — confirm with me that mo greets me with awareness of
   the pipeline and recent decisions, which proves the shared memory is wired.

if anything about the config path or server paths looks off on windows, fix it
and explain what you changed. full reference: `docs/windows-mcp-setup.md`.
