# pocket.prompts — Claude Code Conventions

> Auto-loaded by Claude Code when working in this directory.
> Full project spec: `files/CLAUDE.md`. System prompt reference: `files/SYSTEM_PROMPT.md`.

## What This Is

Hands-free voice command pipeline for the winded.vertigo collective. User speaks via AirPods → iOS Shortcut transcribes → POST /voice → Claude Opus detects intent → routes to Notion/Slack/code → speaks response back.

## Stack

- **Runtime**: Node.js serverless on Vercel (no build step, no framework)
- **AI**: `claude-opus-4-6` via `@anthropic-ai/sdk` — never use sonnet for this project
- **Data**: Notion API (`@notionhq/client`) — 3 databases (inbox, voice log, @tasks)
- **Messaging**: Slack Web API (`@slack/web-api`)
- **Auth**: Per-user OAuth via `api/auth.js` + Vercel KV (`lib/kv.js`). Falls back to shared bot tokens.

## File Layout

```
api/          → Vercel serverless functions (each file = an endpoint)
lib/          → Shared utilities (intent, notion, slack, tts, users, voice-log)
config/       → members.json (collective member IDs)
mcp/          → MCP server for Claude Code integration
public/       → Static assets (PWA, install page, shortcut files)
shortcuts/    → iOS Shortcut generation scripts
files/        → Reference docs (CLAUDE.md spec, SYSTEM_PROMPT.md)
```

## Coding Rules

- **JavaScript only** — no TypeScript
- **Lowercase** variable names, concise functions, no unnecessary abstraction
- **Error handling**: try/catch on all API calls; errors return spoken fallback from `lib/tts.js`
- **Logging**: `console.log` with prefixes: `[voice]`, `[intent]`, `[notion]`, `[slack]`, `[voice-log]`, `[kv]`, `[auth]`
- **No database**: stateless backend. Notion is the data store. Vercel KV for tokens (phase 4).
- **No frameworks**: use Vercel's built-in routing, not Express

## Spoken Response Rules

Responses are read aloud via TTS. Design them to be:
- Conversational, not robotic (1-2 sentences max)
- Always confirm the action taken
- Use member names ("assigned to lamis", not "assigned to user")
- Never read URLs aloud (include in JSON, not spoken text)
- End with a CTA ("anything else?" or "want to check slack?")

## Key Notion Database IDs

```
NOTION_INBOX_DATABASE_ID=7fdb708708e942f89e033de3690790c9
NOTION_VOICE_LOG_DB_ID=a93a805b13ba4826aec3c29d47f680f5
NOTION_TASKS_DB_ID=224e4ee74ba48121ac6ecb9664f5dfc4
```

## Running Locally

```bash
# from monorepo root — requires .env.local with API keys
cd apps/pocket.prompts && npx vercel dev
```

## Current Phase

Phase 4 (Polish + Distribution) — code complete, pending Vercel env config (KV store, OAuth credentials, SETUP_SECRET). See `memory/pocket-prompts.md` for detailed status.
