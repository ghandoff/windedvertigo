# claude code prompt: wire Mo, PaM, and cARL into the port agent (slack + web chat)

> paste this into a Claude Code conversation in ~/Projects/windedvertigo

---

## context

winded.vertigo has three AI agents — Mo (CMO), PaM (project manager), cARL (research) — with a live memory API on port.windedvertigo.com. the API routes exist and work:

- GET/POST `/api/cmo/{briefing,decisions,memory}`
- GET/POST `/api/pam/{briefing,decisions,memory,commitments}`
- GET/POST `/api/carl/{briefing,decisions,memory,findings,curriculum}`

all authenticated with `Bearer $CMO_API_TOKEN`.

there's also a working Slack agent at `/api/agent/slack/events` (the "wv-claw" app) with a full agentic loop in `lib/agent/index.ts`. it handles signature verification, user resolution, thread memory, budget caps, audit logging, and multi-turn tool use. currently it runs a generic "port agent" persona.

**the goal:** extend the existing agent loop so team members can talk to Mo, PaM, or cARL via Slack DM — and build a simple chat interface on port for the same thing via browser (mobile-friendly).

## part 1: agent routing in the slack event handler

### detect which agent is being addressed

when a slack message arrives, determine which agent to route to based on the message content. check for:
- explicit names: "mo", "moe", "cmo" → Mo
- explicit names: "pam", "pm", "project manager" → PaM
- explicit names: "carl", "cARL", "research" → cARL
- if none match, fall back to the existing generic port agent

the detection should be case-insensitive and work naturally: "hey mo, what's the pipeline?" or "pam, what's on maria's plate?" or "carl, what does the research say about threshold concepts?"

### where to put the routing logic

create `lib/agent/agent-router.ts`:

```typescript
export type AgentId = 'mo' | 'pam' | 'carl' | 'port';

export function detectAgent(text: string): AgentId {
  // case-insensitive check for agent names
  // return the matched agent, or 'port' for the generic fallback
}
```

### swap the system prompt based on agent

each agent needs a different system prompt. create `lib/agent/agent-prompts.ts`:

for each agent:
1. read the posture from `docs/{agent}/posture.md` at build time (embed as a string constant, or read from the filesystem — whichever works with the vercel deployment)
2. call the agent's briefing endpoint at runtime to get current state
3. combine posture + briefing + user context into the system prompt

example for Mo:
```
you are Mo — winded.vertigo's AI chief marketing officer.

[posture from docs/cmo/posture.md]

## current state (loaded from memory API)
[briefing response from /api/cmo/briefing]

you are talking to {displayName} ({email}) via Slack.

when a direction is chosen or a decision is made, call cmo_log_decision immediately.
when working state changes, call cmo_update_memory.
```

### swap the tools based on agent

each agent gets its own tools instead of the port agent's tools. create tool definitions in `lib/agent/tools/`:

**Mo tools:**
- `cmo_log_decision` — POST /api/cmo/decisions
- `cmo_update_memory` — POST /api/cmo/memory
- `cmo_read_strategy` — reads a strategy file from docs/cmo/ (optional — Mo could just reference the briefing)

**PaM tools:**
- `pam_log_decision` — POST /api/pam/decisions
- `pam_update_memory` — POST /api/pam/memory
- `pam_create_commitment` — POST /api/pam/commitments
- `pam_update_commitment` — PATCH /api/pam/commitments?id=X
- `pam_list_commitments` — GET /api/pam/commitments (filtered by who, status)

**cARL tools:**
- `carl_log_decision` — POST /api/carl/decisions
- `carl_update_memory` — POST /api/carl/memory
- `carl_add_finding` — POST /api/carl/findings
- `carl_search_findings` — GET /api/carl/findings?domain=X&tags=Y
- `carl_curriculum` — GET /api/carl/curriculum

all tool implementations call the port API internally using `CMO_API_TOKEN` from env. they don't need slack tokens — they're server-side calls within the same deployment.

### update runAgentTurn

modify `lib/agent/index.ts` to:

1. call `detectAgent(ev.text)` before the loop
2. if an agent is detected, load that agent's system prompt (including runtime briefing call)
3. use that agent's tool definitions instead of `AGENT_TOOLS`
4. thread memory should be namespaced per agent: prefix the thread key with the agent id so Mo conversations don't mix with PaM conversations in the same DM channel

the generic port agent (`AgentId = 'port'`) should continue to work exactly as it does now — no changes to its system prompt, tools, or behaviour. the agent routing is additive.

### important constraints

- do NOT create a new slack app. use the existing wv-claw app (SLACK_AGENT_BOT_TOKEN, SLACK_SIGNING_SECRET)
- do NOT create a new worker or separate deployment. everything runs on the existing port (vercel)
- keep the existing budget caps, audit logging, and user scope checks — they apply to agent conversations too
- the briefing API call happens once at the start of each conversation thread, not on every message. cache it in the thread context.
- decisions and memory updates happen via tool calls during the conversation — the agent decides when to log, not the user

## part 2: port chat interface

build a simple web chat at `port.windedvertigo.com/chat/[agent]` where `agent` is `mo`, `pam`, or `carl`.

### the page

create `port/app/(dashboard)/chat/[agent]/page.tsx`:

- a clean, mobile-friendly chat interface
- agent selector in the header (switch between mo, pam, carl)
- messages displayed in a chat bubble layout
- text input at the bottom with send button
- show the agent's name and role as a header
- use the existing port auth — user must be logged in
- responsive: works on phone browsers

### the API route

create `port/app/api/chat/route.ts`:

- POST endpoint that accepts `{ agent: AgentId, message: string, threadId: string }`
- uses the same agent prompt + tools logic from part 1
- streams the response back (use Anthropic streaming API)
- authenticated via the existing port session (not the CMO_API_TOKEN — that's for server-to-server)
- same thread memory, audit logging, and budget caps as the slack path

### the chat component

create `port/app/components/agent-chat.tsx`:

- react component with message history state
- auto-scroll to latest message
- loading indicator while agent is thinking
- markdown rendering for agent responses (agents use lowercase, links, etc.)
- mobile-optimised layout (full viewport height minus header)

### styling

use the existing port design system (harbour brand colours — cadet navy, champagne, sienna, teal). the chat should feel like part of the port, not a bolted-on widget.

## part 3: agent memory integration

both the slack path and the chat path should handle memory the same way:

### at conversation start
1. call the agent's briefing endpoint to load current state
2. inject the briefing into the system prompt
3. store the briefing in thread memory so it's not re-fetched on every message

### during conversation
1. when the agent makes a tool call to log a decision or update memory, execute it immediately
2. the agent decides when to log — it's part of the posture ("write as you go, don't batch at the end")
3. PaM should create commitments when people commit to things in conversation
4. cARL should add findings when research is surfaced

### cross-agent awareness
- PaM's briefing includes Mo's recent decisions (the API already does this)
- when someone asks PaM about strategy, PaM can reference Mo's working state
- when someone asks cARL about a project timeline, cARL can reference PaM's commitments
- this cross-read is via the briefing endpoint, not direct table access

## execution order

1. create `lib/agent/agent-router.ts` — agent detection
2. create `lib/agent/agent-prompts.ts` — system prompt builder per agent (reads posture files, calls briefing API)
3. create agent tool definitions in `lib/agent/tools/` — one file per agent's tools
4. create agent tool executor — routes tool calls to the port API
5. update `lib/agent/index.ts` — integrate routing, prompt swapping, tool swapping, namespaced threads
6. test via slack DM — send "hey mo, what's the pipeline?" and verify Mo responds with briefing context
7. build the chat page + API route + component
8. test via browser — navigate to port.windedvertigo.com/chat/mo and verify conversation works
9. deploy to vercel
10. commit to a branch, open a PR

## important notes

- the posture files are at `docs/cmo/posture.md`, `docs/pam/posture.md`, `docs/carl/posture.md` — read them before building the system prompts. they define each agent's personality, voice, and operating principles.
- the existing agent loop is well-engineered. don't refactor it — extend it. the routing layer should sit above the existing loop, not replace it.
- thread memory namespacing is critical. without it, if a user DMs the bot about Mo and then about PaM, the conversation history from the Mo turn would pollute PaM's context.
- the chat interface should work on phones. this is the primary mobile access path for team members.
- all three agents use lowercase per the w.v brand. the chat UI should reflect this.
- the existing wv-claw slack app already has DM permissions (`im:write`). verify it also has `im:read` and `im:history` — if not, add them in the slack app settings (api.slack.com).
- budget caps and audit logging apply to all agent conversations. the agent id should be included in the audit row so we can track cost per agent.
