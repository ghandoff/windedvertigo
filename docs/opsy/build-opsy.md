# build Opsy — ops agent for winded.vertigo

you're building the fourth AI agent for the winded.vertigo collective. the
first three (Mo, PaM, cARL) already exist and share a common architecture —
study them before writing any code.

## start here

1. read `docs/opsy/posture.md` — Opsy's personality, principles, and monitoring scope
2. read `docs/opsy/implementation-prompt.md` — full technical spec with deliverables, schemas, phased rollout, and implementation notes
3. study the existing agent architecture:
   - `port/app/api/mcp/agents/[agent]/route.ts` — the MCP server (add Opsy here)
   - `port/app/api/cmo/` — Mo's API endpoints (pattern to follow)
   - `port/app/api/pam/` — PaM's API endpoints
   - `docs/plugins/dist/mo-cmo.plugin` — example plugin structure

## build order

start with phase 1 (foundation) from the implementation prompt. don't skip ahead.

1. supabase tables (5 tables, all with RLS enabled)
2. port API endpoints (`/api/opsy/*`)
3. MCP tools registered in the `[agent]` route
4. tier 1 health check cron

commit after each step. push when phase 1 is complete.
