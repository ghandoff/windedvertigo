# claude code prompt: give Mo a persistent memory API

> paste this into a Claude Code conversation with the windedvertigo monorepo mounted.

---

## the problem

Mo's coherence protocol depends on people running `git add && git commit && git push` after every marketing conversation. nobody does it. the decisions-log.md has been manually backfilled twice, but organically it stays empty. payton had "multiple conversations" with Mo that are completely lost because nothing was committed.

the protocol is sound — the implementation is wrong. git is the wrong persistence layer for conversational state. we need Mo to be able to write to memory from ANY conversation (cowork, claude code, scheduled task) without a git workflow.

## the fix: a lightweight memory API using the existing supabase project

we already pay for one supabase project (port). adding tables is free — no new project, no new bill. we add two tables and one API route.

### 1. create a supabase migration: `cmo_decisions`

```sql
CREATE TABLE IF NOT EXISTS cmo_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL, -- 'garrett', 'maria', 'payton', 'jamie', 'lamis', 'scheduled'
  session_type text DEFAULT 'cowork', -- 'cowork', 'claude-code', 'scheduled-task', 'slack'
  summary text NOT NULL, -- what was discussed / decided
  decisions jsonb DEFAULT '[]', -- array of { decision: string, status: 'active' | 'superseded' }
  tags text[] DEFAULT '{}', -- e.g. ['pipeline', 'harbour', 'brand', 'wtg']
  raw_context text -- optional longer context / quotes
);

CREATE INDEX cmo_decisions_who_idx ON cmo_decisions (who);
CREATE INDEX cmo_decisions_created_idx ON cmo_decisions (created_at DESC);
CREATE INDEX cmo_decisions_tags_idx ON cmo_decisions USING gin (tags);
```

this replaces the markdown decisions-log.md as the primary store. the markdown file becomes a human-readable snapshot that gets regenerated weekly (or on demand).

### 2. create a supabase migration: `cmo_memory`

```sql
CREATE TABLE IF NOT EXISTS cmo_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL, -- e.g. 'pipeline-status', 'payton-capacity', 'wtg-status'
  value text NOT NULL, -- current state
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL -- who last changed it
);
```

this is Mo's working memory — key-value pairs that represent the current state of things Mo needs to remember. examples:
- `pipeline-total` → `$457,500`
- `wtg-status` → `not yet submitted. garrett acknowledged as top priority june 4.`
- `payton-current-focus` → `harbour campaign, social media strategy`
- `ppcs-report-status` → `in progress. garrett: data analysis. maria: interactive experience. due before prme global forum late june.`

### 3. create API routes

**POST /api/cmo/decisions** — append a decision entry
```typescript
// port/app/api/cmo/decisions/route.ts
// body: { who, summary, decisions?, tags?, session_type?, raw_context? }
// returns: { id, created_at }
```

**GET /api/cmo/decisions** — read recent decisions
```typescript
// query params: ?days=7&who=payton&tag=pipeline
// returns: array of decision entries, most recent first
```

**POST /api/cmo/memory** — upsert a memory key
```typescript
// body: { key, value, updated_by }
// upserts on key
```

**GET /api/cmo/memory** — read all memory keys
```typescript
// returns: array of { key, value, updated_at, updated_by }
```

**GET /api/cmo/briefing** — generate a formatted briefing
```typescript
// reads last 7 days of decisions + all memory keys
// returns a markdown-formatted briefing string
// this is what the weekly scheduled task calls
```

### 4. update the Mo prompts

the CLAUDE.md in docs/cmo/ and the seed prompts for team members need to change from "append to decisions-log.md and commit" to:

```
after every conversation where a marketing decision is made or insight surfaces:
1. call POST /api/cmo/decisions with a summary of what was discussed
2. if any ongoing state changed, call POST /api/cmo/memory to update the relevant key
3. no git commit needed — the memory is live immediately for the next conversation
```

for cowork sessions that can't call APIs directly, the prompt should instruct claude to use the web_fetch tool or bash curl:
```bash
curl -X POST https://port.windedvertigo.com/api/cmo/decisions \
  -H "Content-Type: application/json" \
  -d '{"who":"payton","summary":"discussed harbour social campaign. decided to focus on linkedin over instagram for launch week.","tags":["harbour","social","campaign"]}'
```

for claude code sessions, use the supabase client directly (it's already initialised in the port codebase).

### 5. update the weekly scheduled task

the monday 1pm briefing should:
1. call GET /api/cmo/decisions?days=7 to get the week's conversations
2. call GET /api/cmo/memory to get current state
3. format the briefing
4. optionally regenerate decisions-log.md as a human-readable snapshot and commit it (so the git file stays useful as a backup/archive)

### 6. add authentication

the API routes should require a simple bearer token (store as `CMO_API_TOKEN` in the worker's env/secrets). this prevents random internet traffic from writing to Mo's memory. the token goes into each team member's Mo prompt.

alternatively, since these routes are on the port (which already has auth), gate them behind the existing port auth — any logged-in team member can write.

### 7. build a transparency view on the port dashboard

add a simple page or tab at `port.windedvertigo.com/strategy` (or a standalone `/mo` route) that renders the `cmo_decisions` table as a chronological feed. each entry shows:

- date
- who Mo was talking to
- summary of what was discussed
- any decisions made (from the `decisions` jsonb array)
- tags as coloured pills

this is how the team sees what everyone else is discussing with Mo. it's not surveillance — it's shared context. the same transparency a human CMO provides when they say "I talked to payton yesterday and she thinks..."

filter by person, by tag, by date range. keep it simple — a feed, not a dashboard.

### 8. update all Mo seed prompts

every Mo prompt (garrett's, maria's, payton's, the scheduled briefing) needs two changes:

**at the start:** instead of "read docs/cmo/decisions-log.md", Mo should:
```
call GET https://port.windedvertigo.com/api/cmo/decisions?days=14 to see what i've discussed with everyone recently.
call GET https://port.windedvertigo.com/api/cmo/memory to see my current working state.
```

**at the end:** instead of "tell the person to commit and push", Mo should:
```
call POST https://port.windedvertigo.com/api/cmo/decisions with a summary of this conversation.
update any cmo/memory keys that changed.
```

include the `CMO_API_TOKEN` in each prompt so the calls authenticate.

## what NOT to do

- do NOT create a new supabase project — use the existing port project
- do NOT delete decisions-log.md — keep it as a git-tracked archive/backup
- do NOT over-engineer this — two tables, three routes. that's it.
- do NOT add real-time subscriptions or websockets — Mo reads at the start of each conversation, not live

## execution order

1. create the two supabase migrations
2. build the API routes (decisions + memory + briefing)
3. add a simple auth check
4. update docs/cmo/CLAUDE.md with the new protocol
5. update the seed prompts for garrett, maria, payton
6. update the weekly scheduled task to use the API
7. seed the memory table with current state (pipeline total, proposal statuses, team focus areas)
8. test: from a cowork session, post a decision via curl, then from another session, read it back
9. commit to a branch, open a draft PR

## cost impact

zero. this uses the existing supabase project. two small tables. minimal row volume (maybe 20-50 decision entries per week, ~20 memory keys). well within the free tier's 500MB database limit.
