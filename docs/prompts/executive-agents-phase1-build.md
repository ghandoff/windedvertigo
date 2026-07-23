# build spec — executive agents, phase 1 + pilots (Mo, PaM)
_for a Claude Code session at ~/Projects/windedvertigo · 2026-07-16 · companion: docs/agents/executive-charters.md (charters are Garrett-only edits — treat as read-only input)_

## 0. how to run this session (process contract)

1. **Review & critique first.** Read this whole spec, the charters, and the relevant existing code (port worker, wv-claw Slack bot, Supabase schema, agent MCP endpoints at port.windedvertigo.com/api/mcp/agents). Then give Garrett a critique: what's wrong, risky, or better done differently on this stack. Propose tweaks.
2. **Make Garrett aware of every tweak** you adopt — a short "changes from the spec" list, not buried in prose.
3. **Then enter plan mode** and present the implementation plan for approval before writing code.
4. **Minimal human gates during the build**: after plan approval, proceed autonomously through implementation, migrations (present SQL for the Supabase editor when RLS/tables change), tests, and preview deploys. Only stop for: (a) anything touching production Slack channels before the sandbox test passes, (b) secrets/scopes Garrett must create, (c) irreversible schema changes. Everything else: build, verify, report.

## 1. what we're building (summary)

An **ambient-agent spine** on the existing port stack, plus two pilot executive agents (Mo, PaM) that listen to event streams and proactively intervene with preview-for-approval cards, per the charters. This replaces "agents respond when summoned" with "agents perceive → evaluate → act/preview/stay silent."

## 2. architecture (target)

```
Slack Events API ─┐
GitHub webhooks ──┤                       ┌─ agent run (charter prompt + event context
Calendar events ──┼→ event router ────────┤   + recent memory + notification-budget state)
Supabase changes ─┤  (Cloudflare Worker)  │       │
cron heartbeat ───┘        │              │       ▼
                           ▼              │  decision: SILENT | ACT(low) | ACT+NOTIFY(med)
                    event_log (Supabase)  │              | PREVIEW(high)
                                          │       │
                                          └───────▼
                              agent_actions (Supabase)  ←— the inbox + metrics source
                                          │
                          ┌───────────────┴───────────────┐
                          ▼                               ▼
              Slack preview card (Block Kit,      port /agents/inbox tab
              approve|edit|redirect|ignore)       (batch review, same cards)
```

### 2.1 event router (Cloudflare Worker)
- Subscribes: Slack Events API (message.channels for the watched channels, app_mention, reaction_added), GitHub webhooks (PR opened/merged, deploy), a calendar poll (Google Calendar API, meeting-ended detection), Supabase webhooks (commitment table changes, pipeline changes), and the existing crons demoted to heartbeat.
- Writes every event to `event_log` (id, source, type, channel/repo, payload jsonb, ts) — replayable, auditable.
- **Debounce/batch:** buffer Slack messages per channel; invoke agents on conversation lulls (e.g., 10 min quiet) or high-signal events (keywords per charter: "submitted", "signed", "I'll … by …", deadlines), NOT per message. Cost + noise control.
- Routes each batch to the agents whose charter watch-list matches (Mo: content/win/brand events; PaM: meetings, promises, deadlines). One event may fan to both.

### 2.2 agent invocation
- Each run = Claude API call (or Claude Agent SDK session) with: the agent's charter (from docs/agents/executive-charters.md, loaded verbatim), the event batch, relevant memory (existing agent memory endpoints), current notification-budget balance, and its recent `agent_actions` history (so it doesn't repeat itself).
- Required structured output: `{decision: silent|act_low|act_notify|preview, trigger: string, artifact: {…}, risk_tier, rationale}`. **Silent must be a first-class, common outcome.**
- Budget check BEFORE surfacing: if the agent or the target human is over budget, the action queues to the inbox as low-priority instead of pinging.

### 2.3 agent_actions table (the spine's heart)
`agent_actions(id, agent, trigger_event_id, decision, risk_tier, artifact jsonb, preview_message_ts, status: proposed|approved|edited|redirected|ignored|expired|executed, human, resolved_at, outcome_notes)` + RLS consistent with existing port tables.
- HIGH tier: `expires_at` with **default-deny** — unresolved past deadline = expired, never executed.
- MEDIUM: executed immediately, `status=executed`, reversible; the notify message links a "reverse" action where feasible.
- This table drives the inbox tab AND the metrics (acted-upon rate, dismissal rate, false-escalation rate per agent/action-type — Opsy's graduation data later).

### 2.4 preview cards
- Slack Block Kit message in the triggering channel (or DM when the trigger was a DM-context): **what I want to do · because [trigger] · the artifact (attached/linked, already made) · tier · veto/approval deadline**, buttons approve / edit / redirect / ignore.
- Button handlers hit the Worker → update `agent_actions` → on approve, execute (post the content to the queue, send the DM, etc.). "Edit" opens the artifact location (Notion/queue row/doc) and marks edited-then-approved. "Ignore" is logged as signal.
- Port `/agents/inbox`: list view over `agent_actions` where status=proposed, same actions, session-gated like /mo strategy-brief tab.

### 2.5 pilot behaviors to implement (from charters — implement THESE, not everything)
**Mo v1:** (1) win-event reaction (keyword/manual event "submitted|signed|launched" → case-study + launch-post previews); (2) content-queue runway watch (<2 weeks → drafts fill it, medium tier); (3) claim-boundary/citation flag on drafts posted in #studio-comms (in-thread, low tier); (4) Friday pipeline scorecard (low).
**PaM v1:** (1) meeting-ended → commitment harvest → owner DMs for confirmation (medium; the human's confirmation is the gate); (2) promise detection in Slack ("I'll X by Y") → log + day-before nudge (medium); (3) Monday per-person commitment DM + exceptions-only note to Garrett (low/medium); (4) absence-horizon check (time-off table vs deadlines → redistribution proposal, preview tier).

## 3. constraints
- **Sandbox first:** a private test channel (#agent-sandbox) with synthetic events; nothing posts to real channels until Garrett has approved sandbox transcripts. Staged rollout: sandbox → #studio-comms only → full watch-list.
- Budgets hard-coded in the Worker (3/agent/day, 5/human/day), not in the prompt.
- Charters load from the file at run time; the build must NOT inline/duplicate charter text (Garrett edits the file, behavior follows).
- No new pricing/discount/external-send capabilities anywhere.
- Reuse existing stack: wv-claw bot credentials (add Events scopes as needed — list required scopes for Garrett), port Worker patterns, existing Supabase project + RLS conventions, existing agent memory MCP endpoints.
- Cost guard: use a cheaper model for the router-side "is this batch charter-relevant?" pre-filter; full model only for actual agent runs. Log token spend per run to `agent_actions`.
- Every intervention message ends with its trigger reference (auditable initiative).

## 4. acceptance (phase 1 done when)
1. Synthetic "PPCS submitted" event in sandbox → Mo produces a preview card with a real drafted case-study stub within minutes; approve executes, ignore logs.
2. Synthetic meeting-ended event → PaM DMs harvested commitments to the named owners (sandbox users) and posts exceptions summary.
3. A HIGH-tier card left unresolved past its deadline auto-expires (default-deny verified).
4. Budget test: 4th intervention in a day queues silently instead of pinging.
5. /agents/inbox shows the same actions with working buttons; metrics query returns acted-upon/dismissed rates per agent.
6. Opsy-facing: `agent_actions` has the fields needed for graduation analysis (no dashboard needed yet).

## 5. after the plan is approved
Build in this order: event_log + router skeleton → agent_actions + card renderer → Mo pilot behaviors → PaM pilot behaviors → inbox tab → sandbox acceptance run → written rollout note for the whirlpool (what the team will see, how to respond to cards). Deploy via the repo's standard Cloudflare flow; present any SQL migrations for the Supabase editor as they're ready.
