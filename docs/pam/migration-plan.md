# PaM migration plan — supabase → PM tool

> written: june 4, 2026  
> context: august is evaluating clickup vs linear (presentation: june 15-17)

---

## current state (june 4 – june 17)

PaM stores commitment data in supabase (`pam_commitments`, `pam_decisions`, `pam_memory`) on the wv-port-pilot project.

**why supabase first:** the trial period generates real usage patterns — how often commitments are created, how PaM's voice lands with the team, what fields matter — which directly informs august's tool recommendation.

---

## migration path (after august's june 15-17 presentation)

### the thing that stays the same

PaM's **persona, voice, and operating posture stay identical** regardless of the backend. the personality is in `docs/pam/posture.md`, not in the data store. a team member talking to PaM will notice no difference.

### the thing that changes

the MCP server in `docs/plugins/pam-pm/mcp-servers/pam-memory/index.js` currently calls `https://port.windedvertigo.com/api/pam/commitments`. after migration, those calls swap to the new tool's API.

### option A: clickup

clickup has a confirmed working MCP integration with claude. migration steps:

1. create the winded.vertigo workspace in clickup (or use an existing one)
2. create a "commitments" list with custom fields: who, what, due_date, source, status, blocker
3. update `index.js` to call the clickup MCP server tools instead of the port API
4. keep the `pam_briefing` function — it still calls `/api/pam/briefing` on the port (which now reads from clickup via the MCP layer)
5. or: move briefing to be constructed entirely client-side from clickup data

the SKILL.md does not change. the plugin.json does not change. only the MCP server's tool implementations change.

### option B: linear

linear has an MCP server or API. migration steps:

1. create the winded.vertigo team/workspace in linear
2. map commitments to linear issues with labels for who and status
3. update `index.js` to use linear's API (or MCP tools if available)
4. same outcome as option A — the port API wrapper can remain as a thin translation layer

### option C: stay on supabase

if august's recommendation is "no single PM tool", PaM continues on supabase indefinitely. supabase is a perfectly valid long-term backend — this was framed as a trial, not a temporary measure.

---

## what august needs for his presentation

august should look at:
- what fields PaM uses most frequently (check `pam_commitments` table)
- how often `pam_briefing` is called vs `pam_create_commitment` (proxy for read vs write usage)
- whether the team's slack communication patterns suggest a tool with async notifications

access the port's supabase project (wv-port-pilot) to pull usage data. garrett can grant read access.

---

## technical handoff notes

- the supabase pam tables will remain after migration (for historical data)
- the port API routes (`/api/pam/*`) can be deprecated after migration but don't need to be immediately — they're cheap to keep running
- the MCP server's `API_TOKEN` is the same across all three agents. if the token rotates, update all three `index.js` files and rebuild the `.plugin` files
- plugin source lives in `docs/plugins/pam-pm/`, `.plugin` files in `docs/plugins/dist/`
