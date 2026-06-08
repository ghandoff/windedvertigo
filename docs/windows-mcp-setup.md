# winded.vertigo agent MCP servers — windows setup

the original setup note was written for macos (zsh, `~/Library/Application
Support/Claude`, `python3`). on windows none of those steps land: there's no
`~/.zshrc` for windows to read, and the script as originally written pointed at
a mac-only config path. this is the windows-native version.

## what's actually needed

the token is written directly into each server's `env` block by the script, so
**you do not need to set `WV_AGENT_TOKEN` as a system variable** — skip the whole
`.zshrc` step. you just need:

1. **node** installed and on `PATH` (check: `node --version`).
2. **python** installed (check: `python --version`).
3. the **windedvertigo repo cloned to `%USERPROFILE%\Projects\windedvertigo`**
   (i.e. `C:\Users\<you>\Projects\windedvertigo`). if it's somewhere else, see
   the note at the bottom.
4. the **claude desktop app** installed (cowork lives in the desktop app, not
   the terminal claude code session).

## steps (powershell)

1. make sure the agent servers have their dependencies. from the repo root:

   ```powershell
   cd $HOME\Projects\windedvertigo\docs\plugins
   foreach ($a in 'mo-cmo\mcp-servers\mo-memory','pam-pm\mcp-servers\pam-memory','carl-research\mcp-servers\carl-memory') {
     if (Test-Path "$a\package.json") { npm install --prefix $a }
   }
   ```

   (skip this if `node_modules` already exists in each server folder.)

2. run the setup script — note it's `python`, not `python3`, on windows:

   ```powershell
   python $HOME\Projects\windedvertigo\setup-mcp-servers.py
   ```

   it will print where it wrote the config — on windows that's
   `%APPDATA%\Claude\claude_desktop_config.json`
   (`C:\Users\<you>\AppData\Roaming\Claude\claude_desktop_config.json`). if you
   see any `WARNING: ... entry point not found` lines, the repo isn't where the
   script expects — fix that before reopening claude.

3. fully quit the claude desktop app (right-click the system-tray icon →
   quit; closing the window isn't enough) and reopen it.

4. start a new cowork session with the `windedvertigo` folder mounted and say
   "i want to talk to Mo". mo should greet you with awareness of the pipeline
   and recent decisions.

## if the repo lives somewhere else

the script looks for the servers under `%USERPROFILE%\Projects\windedvertigo`.
if you cloned elsewhere, either move/clone it there, or edit the `base =` line
near the top of `setup-mcp-servers.py` to your actual path before running.

## desktop app vs. claude code

these servers are configured for the **claude desktop app** (cowork). if you
instead want them inside a **claude code** terminal session on windows, that's a
different config — use `claude mcp add` per server, or add them to
`%USERPROFILE%\.claude.json`. tell garrett if that's what you need and he'll
send the claude-code variant.
