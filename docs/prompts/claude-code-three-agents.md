# claude code prompt: build the full agent trio — Mo plugin, PaM, cARL

> paste this into a Claude Code conversation in ~/Projects/windedvertigo

---

## context

we're building three AI agents for the winded.vertigo collective. each agent has:
- a posture document (already written, in `docs/{agent}/posture.md`)
- a supabase memory layer (tables in the existing wv-port-pilot project — no new project)
- API routes on the port for read/write
- a cowork plugin with an MCP server so the agent can read/write memory from any cowork session

the three agents:
- **Mo** (CMO) — already has API routes and supabase tables. needs the cowork plugin built.
- **PaM** (project + momentum manager) — needs supabase tables, API routes, and plugin.
- **cARL** (cyber agent of research + learning) — needs supabase tables, API routes, and plugin.

the architecture is identical for all three. each agent has:
- `{agent}_decisions` table — append-only log of conversations
- `{agent}_memory` table — key-value working state
- GET/POST `/api/{agent}/decisions` — read/write decisions
- GET/POST `/api/{agent}/memory` — read/write memory
- GET `/api/{agent}/briefing` — formatted briefing (decisions + memory combined)
- a cowork plugin with MCP server that wraps these endpoints

## step 1: supabase migrations

Mo's tables already exist (`cmo_decisions`, `cmo_memory`). create tables for PaM and cARL.

create a new migration file:

```sql
-- PaM: project + momentum manager
CREATE TABLE IF NOT EXISTS pam_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL,
  session_type text DEFAULT 'cowork',
  summary text NOT NULL,
  decisions jsonb DEFAULT '[]',
  tags text[] DEFAULT '{}',
  raw_context text
);
CREATE INDEX pam_decisions_who_idx ON pam_decisions (who);
CREATE INDEX pam_decisions_created_idx ON pam_decisions (created_at DESC);
CREATE INDEX pam_decisions_tags_idx ON pam_decisions USING gin (tags);

CREATE TABLE IF NOT EXISTS pam_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL
);

-- PaM also needs a commitments table
CREATE TABLE IF NOT EXISTS pam_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL,
  what text NOT NULL,
  due_date date,
  source text,
  depends_on uuid[],
  status text DEFAULT 'not-started' CHECK (status IN ('not-started', 'in-progress', 'blocked', 'done', 'parked')),
  blocker text,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pam_commitments_who_idx ON pam_commitments (who);
CREATE INDEX pam_commitments_status_idx ON pam_commitments (status);
CREATE INDEX pam_commitments_due_idx ON pam_commitments (due_date);

-- cARL: cyber agent of research + learning
CREATE TABLE IF NOT EXISTS carl_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  who text NOT NULL,
  session_type text DEFAULT 'cowork',
  summary text NOT NULL,
  decisions jsonb DEFAULT '[]',
  tags text[] DEFAULT '{}',
  raw_context text
);
CREATE INDEX carl_decisions_who_idx ON carl_decisions (who);
CREATE INDEX carl_decisions_created_idx ON carl_decisions (created_at DESC);
CREATE INDEX carl_decisions_tags_idx ON carl_decisions USING gin (tags);

CREATE TABLE IF NOT EXISTS carl_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL
);

-- cARL also needs a findings table for the living library
CREATE TABLE IF NOT EXISTS carl_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  domain text NOT NULL,
  title text NOT NULL,
  source text,
  citation text,
  summary text NOT NULL,
  relevance text,
  tags text[] DEFAULT '{}',
  connected_to text[]
);
CREATE INDEX carl_findings_domain_idx ON carl_findings (domain);
CREATE INDEX carl_findings_tags_idx ON carl_findings USING gin (tags);
CREATE INDEX carl_findings_created_idx ON carl_findings (created_at DESC);
```

run this migration against the existing wv-port-pilot supabase project. do NOT create a new project.

## step 2: API routes

Mo's routes already exist at `/api/cmo/*`. create the same pattern for PaM and cARL.

### PaM routes

create `port/app/api/pam/decisions/route.ts`, `port/app/api/pam/memory/route.ts`, and `port/app/api/pam/briefing/route.ts` following the exact same pattern as the cmo routes. same auth check (CMO_API_TOKEN — use the same token for all agents to keep it simple).

additionally, create `port/app/api/pam/commitments/route.ts`:
- GET: query commitments by who, status, due_date range
- POST: create a new commitment
- PATCH (by id): update status, blocker, completed_at

PaM's briefing endpoint should include: all active commitments (not done/parked), any overdue items, dependencies that are blocking someone, plus the standard decisions + memory.

### cARL routes

create `port/app/api/carl/decisions/route.ts`, `port/app/api/carl/memory/route.ts`, and `port/app/api/carl/briefing/route.ts`. same pattern as cmo.

additionally, create `port/app/api/carl/findings/route.ts`:
- GET: query findings by domain, tags, or search text
- POST: add a new finding

cARL's briefing should include: recent findings relevant to current team work, plus the standard decisions + memory.

### middleware

update the middleware exemption to include `/api/pam/` and `/api/carl/` alongside `/api/cmo/`. route handlers own the auth check.

## step 3: cowork plugins

build three plugins, one per agent. each plugin has:

```
{agent}-plugin/
├── plugin.json
├── skills/
│   └── {agent}/
│       └── SKILL.md
└── mcp-servers/
    └── {agent}-memory/
        ├── package.json
        └── index.js
```

### plugin.json (example for Mo)

```json
{
  "name": "mo-cmo",
  "version": "1.0.0",
  "description": "Mo — winded.vertigo's chief marketing officer. persistent memory across conversations.",
  "author": "winded.vertigo"
}
```

### MCP server (index.js)

each MCP server exposes 3-4 tools using the @modelcontextprotocol/sdk:

**Mo:**
- `cmo_briefing` — GET /api/cmo/briefing (returns full working state + 14 days of conversations)
- `cmo_log_decision` — POST /api/cmo/decisions (logs a decision/insight)
- `cmo_update_memory` — POST /api/cmo/memory (updates a working state key)

**PaM:**
- `pam_briefing` — GET /api/pam/briefing
- `pam_log_decision` — POST /api/pam/decisions
- `pam_update_memory` — POST /api/pam/memory
- `pam_create_commitment` — POST /api/pam/commitments
- `pam_update_commitment` — PATCH /api/pam/commitments/:id

**cARL:**
- `carl_briefing` — GET /api/carl/briefing
- `carl_log_decision` — POST /api/carl/decisions
- `carl_update_memory` — POST /api/carl/memory
- `carl_add_finding` — POST /api/carl/findings
- `carl_search_findings` — GET /api/carl/findings?domain=X&tags=Y

each MCP server holds the API base URL and bearer token internally. the user never sees auth details.

### SKILL.md

each skill references the posture document from `docs/{agent}/posture.md` and includes instructions to:
1. call the briefing tool silently at conversation start
2. log decisions via the MCP tool during conversation (not at end)
3. behave according to the posture

for Mo, the SKILL.md should also reference the strategy files in `docs/cmo/` for deep context.
for cARL, the SKILL.md should reference any research domains defined in `docs/carl/`.
for PaM, the SKILL.md should reference team working preferences if they exist.

### packaging

zip each plugin directory with a `.plugin` extension:
```bash
cd mo-cmo && zip -r ../mo-cmo.plugin . && cd ..
cd pam-pm && zip -r ../pam-pm.plugin . && cd ..
cd carl-research && zip -r ../carl-research.plugin . && cd ..
```

place the `.plugin` files in a shared location (e.g., `docs/plugins/` in the monorepo, or a google drive folder) so the team can install them.

## step 4: seed PaM and cARL memory

### PaM memory keys

| key | value | updated_by |
|---|---|---|
| garrett-commitments | WTG proposal draft, PPCS report architecture, strategy dashboard wiring | garrett |
| maria-commitments | harbour QA framework, PPCS interactive experience, threshold concepts facilitation | garrett |
| payton-commitments | harbour social campaign, linkedin content series | garrett |
| jamie-commitments | PPCS narrative arc review, substack posts | garrett |
| lamis-commitments | storytelling/comms for PPCS report | garrett |
| overdue-items | WTG proposal (identified as priority june 4, not started) | garrett |
| next-whirlpool | wednesday june 4 — threshold concepts, upaya, harbour co-design, PPCS report | garrett |

### cARL memory keys

| key | value | updated_by |
|---|---|---|
| active-research-domains | threshold concepts, play-based pedagogy, AI in education, embodied cognition, UDL | garrett |
| current-harbour-focus | rhythm.lab (music threshold), bias.lens (psychology), creaseworks (creative writing) | garrett |
| key-frameworks | meyer & land threshold concepts, kolb experiential learning, freire critical pedagogy, mcluhan medium-is-message | garrett |
| recent-reading | upaya (skillful means) — buddhist pedagogy principle applied to toy-threshold sequencing | garrett |

## step 5: update the monorepo CLAUDE.md

add PaM and cARL references alongside Mo:

```markdown
## AI agents

winded.vertigo has three AI agents that serve the collective:

### Mo (CMO)
chief marketing officer. strategy, brand, pipeline, campaigns.
brain: `docs/cmo/` · dashboard: port.windedvertigo.com/strategy
to talk to Mo: install the mo-cmo plugin, or in claude code `cd docs/cmo`

### PaM (PM)
project + momentum manager. tracks commitments, dependencies, follow-ups.
brain: `docs/pam/`
to talk to PaM: install the pam-pm plugin, or in claude code `cd docs/pam`

### cARL (research)
cyber agent of research + learning. literature, evidence base, threshold concepts.
brain: `docs/carl/`
to talk to cARL: install the carl-research plugin, or in claude code `cd docs/carl`

all three agents share a memory API on port.windedvertigo.com and can read each other's state. decisions are transparent — see the mo-log tab on the strategy page.
```

## step 6: PaM migration plan for future PM tools

PaM's posture.md already notes that PaM is tool-agnostic. when august presents his clickup/linear recommendation (june 15-17), the migration path is:

1. keep PaM's persona, voice, and operating posture unchanged
2. swap the supabase `pam_commitments` table for clickup/linear as the data store
3. update the MCP server to call clickup/linear APIs instead of supabase
4. if clickup: use their MCP integration (already confirmed working with claude)
5. if linear: use their MCP or API

the PaM plugin's SKILL.md stays the same. the MCP server's index.js changes its backend. the user experience is identical.

document this migration path in `docs/pam/migration-plan.md` so august can read it before his presentation.

## execution order

1. run the supabase migration (PaM + cARL tables)
2. build PaM and cARL API routes (copy Mo's pattern)
3. update middleware for the new routes
4. seed memory tables for PaM and cARL
5. build the three MCP servers (mo, pam, carl)
6. write the SKILL.md for each plugin
7. package the three .plugin files
8. update the monorepo CLAUDE.md
9. write docs/pam/migration-plan.md
10. deploy the port (API routes)
11. test: install a plugin in cowork, start a conversation, verify briefing loads and decisions log
12. commit everything to a branch, open a draft PR

## important notes

- all three agents use the SAME supabase project (wv-port-pilot) and the SAME auth token
- no new CF workers — all routes are on the existing wv-port worker
- the plugins need to work in cowork specifically — that's where most team conversations happen
- PaM's supabase layer is explicitly temporary (june 4 – june 17 trial). the usage patterns during this period inform august's tool recommendation
- read each agent's posture.md before writing the SKILL.md — the posture defines the personality
