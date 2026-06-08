#!/usr/bin/env python3
"""Add Mo, PaM, and cARL MCP servers to the Claude desktop config.

⚠️ SUPERSEDED — do not use for Cowork. This writes a LOCAL stdio server into
claude_desktop_config.json's mcpServers block. Cowork (Claude Desktop) runs in a
cloud VM that ignores that block and can't launch local node servers, so the
agents never appear there (see docs/cowork-mcp-findings-2026-06-08.md). The
agents are now a hosted REMOTE MCP endpoint — follow docs/plugins/REMOTE-MCP-SETUP.md
instead (works in Claude Code AND Cowork). Kept only for historical reference /
local Claude Code fallback.

Cross-platform: resolves the Claude Desktop config location for
macOS, Windows, and Linux. Run with `python3` (macOS/Linux) or
`python` (Windows). The agent token is written directly into each
server's env block, so no shell env var setup is required.
"""

import json
import os
import sys

# Resolve the Claude Desktop config directory per-OS.
if sys.platform == "darwin":  # macOS
    config_dir = os.path.expanduser("~/Library/Application Support/Claude")
elif sys.platform == "win32":  # Windows
    appdata = os.environ.get("APPDATA")
    if not appdata:
        sys.exit("APPDATA is not set — are you on Windows? Cannot locate the Claude config.")
    config_dir = os.path.join(appdata, "Claude")
else:  # Linux / other
    xdg = os.environ.get("XDG_CONFIG_HOME", os.path.expanduser("~/.config"))
    config_dir = os.path.join(xdg, "Claude")

config_path = os.path.join(config_dir, "claude_desktop_config.json")

os.makedirs(config_dir, exist_ok=True)

# Load existing config or start fresh.
if os.path.exists(config_path):
    with open(config_path) as f:
        config = json.load(f)
    print(f"found existing config with keys: {list(config.keys())}")
else:
    config = {}
    print("no existing config — creating fresh")

if "mcpServers" not in config:
    config["mcpServers"] = {}

existing = list(config["mcpServers"].keys())
if existing:
    print(f"existing mcpServers: {existing}")

# Build the three agent server paths. Forward slashes work for Node on every
# platform (including Windows), so normalise to them for a clean config.
base = os.path.expanduser("~/Projects/windedvertigo/docs/plugins")
token = "2dcbf0adfff31f6a5daff8a3b3b813732b27b7023ef0a99e4f7c50594e3bc4c8"


def server_path(*parts):
    return os.path.join(base, *parts).replace("\\", "/")


agents = {
    "mo-memory": {
        "command": "node",
        "args": [server_path("mo-cmo", "mcp-servers", "mo-memory", "index.js")],
        "env": {"WV_AGENT_TOKEN": token},
    },
    "pam-memory": {
        "command": "node",
        "args": [server_path("pam-pm", "mcp-servers", "pam-memory", "index.js")],
        "env": {"WV_AGENT_TOKEN": token},
    },
    "carl-memory": {
        "command": "node",
        "args": [server_path("carl-research", "mcp-servers", "carl-memory", "index.js")],
        "env": {"WV_AGENT_TOKEN": token},
    },
}

# Warn if the server files aren't where we expect (e.g. repo not cloned to
# ~/Projects/windedvertigo, or `npm install` not yet run for the servers).
for name, cfg in agents.items():
    js = cfg["args"][0]
    if not os.path.exists(js):
        print(f"  WARNING: {name} entry point not found at {js}")

config["mcpServers"].update(agents)

with open(config_path, "w") as f:
    json.dump(config, f, indent=2)

print(f"\nwrote: {config_path}")
print(f"all mcpServers: {list(config['mcpServers'].keys())}")
print("\nrestart the Claude desktop app for changes to take effect.")
