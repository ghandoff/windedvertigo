# Opsy implementation prompt — for Claude Code

> copy this entire file into a Claude Code session with the windedvertigo
> monorepo mounted. it gives claude everything it needs to build Opsy
> end-to-end, following the same architecture as Mo, PaM, and cARL.

---

## context

winded.vertigo has three AI agents that serve the collective:

- **Mo** (CMO) — strategy, brand, pipeline. brain: `docs/cmo/`, plugin:
  `docs/plugins/dist/mo-cmo.plugin`, port API: `/api/cmo/*`
- **PaM** (PM) — commitments, dependencies, follow-ups. brain: `docs/pam/`,
  plugin: `docs/plugins/dist/pam-pm.plugin`, port API: `/api/pam/*`
- **cARL** (research) — evidence base, threshold concepts. brain: `docs/carl/`,
  plugin: `docs/plugins/dist/carl-research.plugin`, port API: `/api/carl/*`

all three share a common architecture:
1. **brain folder** (`docs/{agent}/`) — posture.md + working state files
2. **port API endpoints** (`port/app/api/{agent}/*`) — briefing, decisions,
   memory CRUD, plus agent-specific endpoints
3. **MCP server route** (`port/app/api/mcp/agents/[agent]/route.ts`) — JSON-RPC
   2.0 shim that proxies tool calls to the port API. a single `[agent]` dynamic
   route handles all agents with agent-specific tool catalogs.
4. **plugin** (`docs/plugins/dist/{name}.plugin`) — cowork plugin that bundles
   the MCP config + posture for Claude Desktop / Cowork sessions.

the MCP route at `port/app/api/mcp/agents/[agent]/route.ts` currently handles
`mo`, `pam`, `carl`, and `all` (combined). auth is via OAuth (Cowork) or
Bearer token (`WV_AGENT_TOKEN` / `CMO_API_TOKEN`).

## what to build

a fourth agent: **Opsy** — operations and systems intelligence. read the full
posture at `docs/opsy/posture.md` before starting.

### deliverables (in order)

#### 1. port API endpoints (`port/app/api/opsy/*`)

create the following routes:

**`/api/opsy/briefing` (GET)**
returns Opsy's full working state: current health status of all platforms,
recent incidents, active alerts, auto-fix history, learned patterns.
same pattern as `/api/cmo/briefing` — load from supabase + memory files.

**`/api/opsy/incidents` (GET + POST)**
- GET: list incidents with optional filters (`?status=open&severity=critical&since=2026-06-01`)
- POST: log a new incident `{ service, severity, symptoms, cause?, remediation?, auto_fixed? }`

**`/api/opsy/health` (GET)**
returns current health check results for all monitored services, structured as:
```json
{
  "platforms": {
    "nordic": { "status": "green", "uptime": 99.9, "p95_ms": 450, "incidents_7d": 0 },
    "harbour": { "status": "amber", "uptime": 99.2, "p95_ms": 1800, "incidents_7d": 2 },
    "website": { "status": "green", "uptime": 100, "p95_ms": 320, "incidents_7d": 0 }
  },
  "services": { ... },
  "last_check": "2026-06-11T14:00:00Z"
}
```

**`/api/opsy/memory` (GET + POST)**
same pattern as the other agents. key-value working state.

**`/api/opsy/decisions` (POST)**
log operational decisions (same schema as cmo/pam decisions).

**`/api/opsy/check` (POST)**
trigger an on-demand health check for a specific service or all services.
this is the endpoint that cron jobs call. body: `{ scope: "all" | "tier1" | "tier2" | service_name }`.

the health check logic should:
- hit CF Workers via fetch and measure response time / status code
- check Supabase health via the management API or a simple query
- check Vercel deployment status via Vercel API
- check GitHub Actions recent run status via GitHub API
- check DNS records via DNS-over-HTTPS (Cloudflare 1.1.1.1)
- check SSL certificate expiry via TLS handshake
- store results in supabase (`opsy_health_checks` table)
- compare against thresholds (from posture.md) and create incidents if exceeded

**`/api/opsy/email-scan` (POST)**
scan gmail (both accounts) for infrastructure notification emails.
use the Gmail MCP tools or Gmail API. classify emails by service and severity.
create incidents for anything actionable. mark emails as processed (label).

#### 2. supabase tables (wv-port-pilot)

create the following tables (with RLS enabled from the start):

```sql
-- incidents log
CREATE TABLE public.opsy_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  symptoms TEXT NOT NULL,
  cause TEXT,
  remediation TEXT,
  auto_fixed BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'monitoring')),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  related_incidents UUID[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- health check results
CREATE TABLE public.opsy_health_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('green', 'amber', 'red')),
  response_time_ms INT,
  error_rate NUMERIC(5,2),
  details JSONB DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- auto-fix history
CREATE TABLE public.opsy_auto_fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID REFERENCES opsy_incidents(id),
  action TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('success', 'failure', 'partial')),
  details JSONB DEFAULT '{}',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- learned patterns
CREATE TABLE public.opsy_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL,
  description TEXT NOT NULL,
  services TEXT[] NOT NULL,
  occurrence_count INT DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT now(),
  recommendation TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- email notifications captured
CREATE TABLE public.opsy_email_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_account TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL UNIQUE,
  from_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  service TEXT,
  severity TEXT CHECK (severity IN ('critical', 'warning', 'info')),
  summary TEXT,
  action_taken TEXT,
  incident_id UUID REFERENCES opsy_incidents(id),
  received_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.opsy_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_auto_fixes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opsy_email_captures ENABLE ROW LEVEL SECURITY;
```

#### 3. MCP tools (extend existing route)

add Opsy's tools to `port/app/api/mcp/agents/[agent]/route.ts`. follow the
exact pattern used for Mo/PaM/cARL tool definitions.

tools to register:

| tool name | description | maps to |
|-----------|-------------|---------|
| `opsy_briefing` | load Opsy's full working state — current health, recent incidents, patterns. call silently at session start. | GET `/api/opsy/briefing` |
| `opsy_log_incident` | log a new infrastructure incident | POST `/api/opsy/incidents` |
| `opsy_health_check` | run an on-demand health check for all services or a specific one | POST `/api/opsy/check` |
| `opsy_update_memory` | update a key in Opsy's working state memory | POST `/api/opsy/memory` |
| `opsy_log_decision` | log an operational decision from the current conversation | POST `/api/opsy/decisions` |
| `opsy_search_incidents` | search incident history by service, severity, or date range | GET `/api/opsy/incidents` |
| `opsy_scan_emails` | scan gmail for new infrastructure notifications | POST `/api/opsy/email-scan` |

the `all` agent should include Opsy's tools alongside Mo/PaM/cARL's.

#### 4. cron jobs (`port/app/api/cron/opsy-*`)

**`opsy-health-check-t1`** — runs every 5 minutes
calls POST `/api/opsy/check` with `{ scope: "tier1" }`. checks core platform
services (wv-site, harbour, nordic, port, creaseworks).

**`opsy-health-check-t2`** — runs every 15 minutes
calls POST `/api/opsy/check` with `{ scope: "tier2" }`. checks data layer
(Supabase, Neon, R2).

**`opsy-health-check-t3`** — runs every 30 minutes
calls POST `/api/opsy/check` with `{ scope: "tier3" }`. checks external
services (Notion, Resend, Stripe, GitHub, Google Cloud).

**`opsy-health-check-t4`** — runs daily at 06:00 UTC
calls POST `/api/opsy/check` with `{ scope: "tier4" }`. security and
compliance checks (SSL, DNS, RLS, dependencies, spending).

**`opsy-email-scan`** — runs every 15 minutes
calls POST `/api/opsy/email-scan`. scans both inboxes.

**`opsy-digest`** — runs weekly (monday 07:00 UTC)
generates a weekly operations digest and posts to #ops-alerts. includes:
health trends, incidents resolved, auto-fixes performed, cost changes,
patterns detected, recommendations.

#### 5. slack integration

Opsy sends messages via the Slack API (same bot token the other agents use).
message routing by severity:

- **critical:** DM to garrett (U06Q4UN4PKR) AND post to #ops-alerts
- **warning:** post to #ops-alerts only
- **info:** include in weekly digest only

create a `#ops-alerts` channel if it doesn't exist. Opsy should use clear
formatting:

```
:red_circle: *critical* — harbour hub returning 503s

*service:* wv-harbour-harbour (CF Worker)
*started:* 14:32 UTC (3 minutes ago)
*symptoms:* 503 on `/harbour/api/auth/session`, 12% error rate
*likely cause:* R2 tile-sync cron timed out, blocking auth endpoint
*action:* re-running cron now (auto-fix)
*ETA:* should recover within 2 minutes

_I'll update when it's resolved._
```

#### 6. dashboard page (`port/app/(dashboard)/ops/page.tsx`)

build the ops dashboard at `/ops` in the port app. follow port's existing
layout and component patterns. the page should:

- show three platform cards (nordic, harbour, website) with traffic-light
  status, key metrics (uptime, p95, error rate), and 7-day sparklines
- show a recent incidents timeline (last 7 days) with severity badges
- show auto-fix history with success/failure indicators
- show a cron health grid (which crons ran, which failed)
- show cost tracking by service (monthly, with month-over-month delta)
- be responsive and match port's existing dark theme

data comes from the `/api/opsy/health` and `/api/opsy/incidents` endpoints.

#### 7. cowork plugin (`docs/plugins/dist/opsy-ops.plugin`)

follow the same structure as `mo-cmo.plugin`, `pam-pm.plugin`, and
`carl-research.plugin`. the plugin should:

- define the MCP server URL (`https://port.windedvertigo.com/api/mcp/agents/opsy`)
- include the posture from `docs/opsy/posture.md`
- define Opsy's persona and startup instructions

#### 8. update CLAUDE.md

add Opsy to the AI agents section of `/CLAUDE.md` (the root monorepo CLAUDE.md),
following the same format as Mo, PaM, and cARL:

```markdown
### Opsy (ops)

operations + systems intelligence. monitors infrastructure health, captures
stack notifications, auto-fixes safe issues, and produces health dashboards.
brain: `docs/opsy/` . dashboard: port.windedvertigo.com/ops
plugin: `docs/plugins/dist/opsy-ops.plugin`

**to talk to Opsy:**
- in claude code: `cd docs/opsy` and start talking, or say "I want to talk to Opsy"
- in cowork: install the opsy-ops plugin, ask "what's the health of our stack?"
  or "any incidents this week?"
```

## environment variables needed

Opsy will need these env vars in the port app's `.env` / CF worker config:

- `CLOUDFLARE_API_TOKEN` — already exists, used for CF API calls
- `VERCEL_API_TOKEN` — may need to create; for Vercel deployment status checks
- `GITHUB_TOKEN` — for Actions API (CI run status, Dependabot alerts)
- `SUPABASE_URL` / `SUPABASE_SECRET_KEY` — already exist for wv-port-pilot
- `SUPABASE_NORDIC_URL` / `SUPABASE_NORDIC_SECRET_KEY` — already exist for wv-nordic
- `NEON_API_KEY` — may need to create; for Neon connection pool stats
- `RESEND_API_KEY` — already exists
- `SLACK_BOT_TOKEN` — already exists
- Gmail access — via existing Gmail MCP connector or Google API credentials

## implementation notes

- **start with the API endpoints and supabase tables** — the cron jobs and
  dashboard are downstream of these.
- **the MCP route is a single file** — study the existing `[agent]/route.ts`
  carefully. it has agent-specific tool catalogs and call functions. add Opsy
  as a fourth agent following the exact same pattern.
- **use supabase client from `port/lib/supabase/client.ts`** — it uses
  `SUPABASE_SECRET_KEY` (service_role). this bypasses RLS, which is correct
  for server-side API routes.
- **the port app is a Next.js app on Vercel** — cron jobs are Vercel cron
  functions triggered by `vercel.json`.
- **don't create a separate worker for Opsy** — everything lives in the
  port app. this follows the established pattern.
- **slack messaging:** use the existing slack integration pattern in the port
  app. check `port/lib/slack/` or similar for the bot token setup.
- **health check implementation:** for CF Workers, a simple fetch to the
  worker's URL measuring response time and checking status code is sufficient
  to start. more sophisticated checks (analytics API, error logs) can come
  later.
- **email scanning:** prefer the Gmail MCP tools (already connected in Cowork)
  over building a raw Gmail API integration. search for emails from known
  infrastructure senders (e.g. `from:noreply@supabase.io OR from:*@cloudflare.com
  OR from:CloudPlatform-noreply@google.com`) that are unread or unlabelled.

## phased rollout

don't try to build everything at once. suggested order:

**phase 1 (foundation):**
- supabase tables
- `/api/opsy/health` endpoint (tier 1 checks only — fetch CF Workers)
- `/api/opsy/incidents` endpoint
- `/api/opsy/briefing` endpoint
- MCP tools added to the agent route
- basic cron for tier 1 health checks

**phase 2 (alerting):**
- slack integration (severity-based routing)
- auto-fix for known safe actions (cron re-runs, cache clears)
- email scanning for both inboxes
- expand health checks to tiers 2-4

**phase 3 (dashboard + learning):**
- port.windedvertigo.com/ops dashboard page
- pattern detection and incident correlation
- cowork plugin
- weekly digest cron
- cowork artifact

## testing

- run health checks manually via `curl POST /api/opsy/check` and verify
  supabase rows are created
- simulate a failure (temporarily change a health check URL to a bad one)
  and verify an incident is logged + slack alert sent
- verify the MCP tools work by calling them from a Cowork session
- check that the `all` agent endpoint returns Opsy tools alongside
  Mo/PaM/cARL tools
