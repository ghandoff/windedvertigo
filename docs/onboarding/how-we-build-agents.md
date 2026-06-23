# how we build agents for winded.vertigo

_a plain-english retrospective for the team — no developer background needed._

---

## the big picture

An agent here is a Claude conversation that has **persistent memory**. Without memory, every conversation with Claude starts blank — it doesn't know what you talked about yesterday, what decisions were made, or what the team is working on. Our agents solve this by giving each one a small private database that stores what they know, what was decided, and what's currently true. When you open a conversation with an agent, it silently reads that database first, then shows up already briefed.

The agents don't run on a schedule or do things autonomously (with a few exceptions). They're more like colleagues who are always available, always up to date, and never forget what you told them — as long as you log things with them.

---

## the shared skeleton (every agent gets this)

Every agent is built from the same five-part recipe. This is what we copy when creating a new one.

### 1. two core database tables

Every agent gets exactly two tables:

- **`{agent}_decisions`** — an append-only log. Every significant conversation gets summarised here. Think of it as the agent's diary. You can never edit or delete entries, only add new ones. This is what gives the agent context on "what happened before."
- **`{agent}_memory`** — a live scratchpad. Key-value pairs the agent updates as things change ("current priority: X", "Maria's leave dates: Y"). Unlike decisions, this IS editable — it's meant to hold the current state of the world, not history.

### 2. a briefing endpoint

A URL on port (`/api/{agent}/briefing`) that assembles everything the agent needs to know at the start of a session — its memory pairs, the last 14 days of logged decisions, and any agent-specific summary data. This is what gets loaded silently when you open a chat.

### 3. standard api routes

Every agent has the same four base endpoints:

| route | what it does |
|-------|-------------|
| `briefing` | load the agent's context |
| `decisions` | log or retrieve past conversations |
| `memory` | read or update the scratchpad |
| _(agent-specific)_ | PaM has `commitments`, Fin has `items`, etc. |

All routes are protected — only authenticated requests can reach them.

### 4. an mcp tool registration

Every agent registers its tools into a central registry at `/api/mcp/agents/all`. This single URL is what you paste into Cowork to connect all six agents at once. The registry uses the tool name prefix (`cmo_`, `pam_`, `biz_`, etc.) to figure out which agent should handle each request.

### 5. a persona doc (skill.md)

A markdown file that tells Claude _how to be_ this agent. It covers: how to activate, what to read at session start, what voice and style to use, when to log decisions, and what the agent's job actually is. This is what makes each agent feel different even though they share the same technical skeleton.

---

## the unique parts (what makes each agent different)

Once the skeleton is in place, each agent gets shaped by three things.

### domain-specific database tables

Beyond the two shared tables, each agent gets extra tables that reflect what it actually tracks:

| agent | what they track beyond decisions + memory |
|-------|------------------------------------------|
| **Mo** | nothing extra — strategy lives in docs, not a database |
| **PaM** | commitments — who promised what, by when, and whether it's done |
| **cARL** | findings (the research library) and curriculum (what we want to learn) |
| **Opsy** | incidents, health checks, and patterns (infrastructure-specific) |
| **Fin** | financial items (bills, invoices, deadlines), recurring patterns, and QBO/Gusto snapshots |
| **Biz** | a roadmap of BD feature ideas — but importantly, Biz doesn't own its own opportunity data; it reads the existing RFP pipeline tables instead of duplicating them |

### domain-specific api routes and tools

Each agent exposes actions that make sense for its job:

- **Biz** can run a QC review on a proposal, record a go/no-go verdict, or notify reviewers
- **PaM** can create and update commitments
- **Opsy** can run health checks and log incidents
- **Fin** can store financial snapshots and log action items

These routes become the "tools" the agent can call from within a conversation.

### the skill.md persona

This is the most important unique part. It defines:

- **what triggers the agent** — what phrases or contexts should make Claude activate it ("talk to Mo", "run a QC check")
- **what it reads on startup** — which docs or routes to load to become fully briefed
- **its voice and style** — Mo is strategic and forward-thinking; PaM is precise and deadline-focused; cARL is academic and citation-forward; Biz always runs a QC check before calling a draft "ready"
- **its decision-logging habit** — agents are instructed to log decisions _during_ a conversation, not at the end, so nothing gets lost if the session is cut short

---

## how they connect

All six agents share one Cowork connector URL:

```
https://port.windedvertigo.com/api/mcp/agents/all
```

When you connect this in Cowork, you get all six agents' tools available in a single session. The system figures out from the tool name prefix (e.g. `biz_qc_review` → Biz, `pam_create_commitment` → PaM) which agent should handle each request.

Authentication is via Google sign-in through OAuth — no token management needed.

---

## the recipe for a new agent

If the team ever wanted to add a seventh agent (say, a "Grant" agent focused specifically on grant writing), the process would be:

1. **write a one-page brief** — who is this agent, what's their job, what do they track that no other agent does?
2. **design the extra tables** — beyond the shared decisions + memory tables, what unique things does this agent need to store?
3. **copy Fin or Biz as the template** — create the migration file (database tables), the api routes, and the MCP tool registration
4. **write the skill.md** — the persona doc. this is the most important step and deserves the most care
5. **register in the MCP router** — add the agent to the central `/agents/all` registry with its tool prefix
6. **add a dashboard page** — a simple page on port so humans can see what the agent knows
7. **connect in cowork** — reconnect the shared MCP connector to pick up the new tools

Steps 2–6 are developer work. Steps 1 and 4 (the brief and the persona) are collaborative — they're where your input on what the agent should actually _do_ and _sound like_ matters most.

---

## what makes this setup strong

- **no cold starts** — agents always arrive briefed because the briefing is loaded automatically
- **decisions are permanent** — the append-only log means nothing gets overwritten; you can always trace back to what was known when a decision was made
- **memory is explicit** — agents don't infer the current state from past conversations; they read the scratchpad, which makes them predictable
- **one connector, six agents** — you don't need to manage six separate connections in Cowork; one URL gives you the full team
- **domain ownership is clean** — each agent tracks its own domain and calls other agents' tools when it needs cross-domain data (e.g. Biz calling Fin for budget rates, or Biz calling PaM to create a milestone)
