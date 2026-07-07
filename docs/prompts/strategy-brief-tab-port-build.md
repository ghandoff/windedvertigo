# build spec — editable, version-tracked "strategy brief" tab on /mo

> for a **Claude Code** session in this repo. Authored by Mo (CMO agent) from a Cowork
> strategy session, 2026-06-30. Implementation + deploy is engineering's call — this is
> the spec, grounded in the current port architecture.
>
> **Why this exists:** the strategy meeting brief is currently a Cowork artifact
> (`strategy-meeting-brief`). Garrett wants it as a first-class, team-editable, version-
> tracked tab on `port.windedvertigo.com/mo` so everyone can view + edit + see history.

## scope

1. Add a **`strategy brief`** tab to the `/mo` dashboard.
2. The brief is an **editable document** any signed-in team member can change.
3. Every save is **version-tracked** (who / when / what changed; view + restore prior versions).
4. Upgrade the existing `timeline` tab into a **multi-view Gantt** — several saved chart
   variations the user can toggle between, plus per-lane show/hide (see its own section below).
   Seed from the **Mermaid timeline** in the `strategy-log-2026-06-30` artifact / `docs/cmo/decisions-log.md`.

This is the **first human write-UI in the port** — all dashboards are currently read-only
(writes happen via agent APIs or Notion). Build accordingly.

## where things live (verified)

- Dashboard page: `port/app/(dashboard)/mo/page.tsx` — server component; fetches via
  `Promise.all([... .catch(fallback)])`; renders tab content conditionally on `activeTab`.
- Tabs: `TABS` array in that page + `port/app/components/url-tabs.tsx` (client; `?tab=<key>`
  via `router.replace()`). Existing keys incl. `strategy`, `timeline`, `mo-log`.
- DB: **Supabase** (Postgres). Client: `port/lib/supabase/client.ts`
  (`SUPABASE_URL` + `SUPABASE_SERVICE_KEY`).
- CMO types + accessors: `port/lib/supabase/cmo.ts` (`cmo_memory`, `cmo_decisions`).
- CMO API routes: `port/app/api/cmo/{memory,decisions}/route.ts` — bearer `CMO_API_TOKEN`.
- Auth: **NextAuth v5 Google SSO**; `const session = await auth()` → `session.user.email`
  (team: garrett, maria, payton, jamie, lamis — see `WHO_OPTIONS` in `mo-log-tab.tsx`).
- Migrations: `port/supabase/migrations/` (date-prefixed; apply via Supabase SQL editor in prod).
- Deploy: `cd port && npm run deploy:cf` (OpenNext + `wrangler deploy`; worker `wv-port`;
  **no CI auto-deploy**). Version check: `curl -s https://port.windedvertigo.com/api/version`.

## data model (new migration)

`port/supabase/migrations/<YYYYMMDD>_cmo_strategy_brief.sql` — **enable RLS from creation**
(per the standing rls-safeguard; the force-RLS event trigger should already cover new tables,
but assert it). Keep the project in its existing EU region.

```sql
-- the live document (one row per slug; 'current' is the active brief)
create table cmo_strategy_brief (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique default 'current',
  title       text not null default 'strategy brief',
  content     jsonb not null,            -- structured brief (see contract below)
  version     int  not null default 1,
  status      text not null default 'active',
  updated_at  timestamptz not null default now(),
  updated_by  text not null
);

-- append-only version history (snapshot on every save)
create table cmo_strategy_brief_versions (
  id          uuid primary key default gen_random_uuid(),
  brief_id    uuid not null references cmo_strategy_brief(id) on delete cascade,
  version     int  not null,
  content     jsonb not null,            -- full snapshot at this version
  change_note text,
  created_at  timestamptz not null default now(),
  created_by  text not null,
  unique (brief_id, version)
);

alter table cmo_strategy_brief enable row level security;
alter table cmo_strategy_brief_versions enable row level security;
-- service-role access only (the API uses SUPABASE_SERVICE_KEY); no anon policies.
```

### content contract (jsonb)

Keep the brief's structure so it can render as the interactive agenda, and so diffs are
meaningful:

```jsonc
{
  "sections": [
    { "id": "operating-model", "heading": "operating model — TToC rubric, RACI, lean PaM",
      "owner": "all", "body": "markdown…", "covered": false }
    // …one per agenda item
  ],
  "decisions": ["…"],   // captured decisions
  "actions":  ["…"]     // captured action items
}
```

Markdown inside `body` keeps editing simple and diff-friendly. Seed `content` from the
current `strategy-meeting-brief` artifact (sections 1–7 + decisions/actions).

## API — `port/app/api/cmo/strategy-brief/route.ts`

- **GET** → current brief (`slug=current`). `?history=1` → version list (version, created_by,
  created_at, change_note). `?version=N` → that snapshot.
- **PUT/POST** (save edit): **gate on NextAuth session** (signed-in team member), not the
  bearer token — this is a human action. In one transaction: `version+1`, INSERT snapshot into
  `cmo_strategy_brief_versions`, UPDATE `cmo_strategy_brief` (content, version, updated_at,
  `updated_by = session.user.email`). Accept an optional `change_note`.
- **POST `?restore=N`** → write a NEW version whose content = snapshot N (never hard-overwrite;
  restore is just another forward version). `created_by` = session email; `change_note =
  "restored v{N}"`.
- Also expose **agent read** (bearer `CMO_API_TOKEN`) so Mo can read/seed the brief from Cowork,
  mirroring the existing `/api/cmo/*` pattern.

## UI — `port/app/(dashboard)/mo/components/strategy-brief-tab.tsx` (client)

1. Add `{ key: "strategy-brief", label: "strategy brief" }` to `TABS`; fetch the brief
   server-side in `page.tsx` (`getStrategyBrief().catch(() => null)`) and pass as prop.
2. **View mode:** render sections (heading, owner chip, body markdown, covered ✓) + the
   decisions/actions lists. Reuse the look of the Cowork brief.
3. **Edit mode:** inline-editable section bodies + add/remove decision/action rows; a
   `change note` field; Save → PUT. Disable Save unless signed in.
4. **History panel:** list versions (who · when · note); click to view a past version; a
   simple text diff (current vs selected) is enough for v1; **Restore** button → POST `?restore`.
5. Show `updated_by` + `updated_at` in the header (last editor).

## timeline tab — multiple toggle-able Gantt views

The `timeline` tab already exists on `/mo`. Upgrade it to render the same set of timeline
items under **several named views the user can switch between**, with **per-lane show/hide**.
Build it data-backed (one item set, many groupings) so the views stay in sync and editable —
not as separate hard-coded charts. Do this **after** the brief tab works.

### data (new migration, same file or a sibling)

```sql
create table cmo_timeline_items (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  lane        text not null,              -- workstream, e.g. 'Consortium / IDB'
  owner       text,                       -- 'garrett' | 'lamis' | 'maria' | 'jamie' | 'payton' | agent
  horizon     text,                       -- 'now' | 'q3-2026' | '2027'
  track       text,                       -- 'mission' | 'survival' | 'neutral'
  kind        text not null default 'task', -- 'task' | 'milestone' | 'critical' | 'active'
  start_date  date not null,
  end_date    date,                       -- null for milestones
  sort        int  not null default 0,
  updated_at  timestamptz not null default now(),
  updated_by  text not null
);
alter table cmo_timeline_items enable row level security;
```

Seed from the `strategy-log-2026-06-30` Gantt (Creaseworks, AMNA, consortium/IDB, conference,
enablers). Reuse the same session-gated write pattern as the brief if items become editable in-UI
(otherwise agent-seeded via bearer is fine for v1).

### the views (a "view" = a grouping dimension over the same items)

Ship these four to start, selectable via a segmented control / dropdown:

1. **By workstream** (group on `lane`) — the default; what the current Gantt shows.
2. **By owner** (group on `owner`) — who's carrying what, when. Surfaces the
   Garrett-as-bottleneck picture at a glance.
3. **By horizon** (group on `horizon`) — now / 3-week focus vs Q3-2026 vs the 2027 conference.
4. **Mission vs survival** (group on `track`) — the survival-vs-mission filter made visible
   (e.g. Nordic under 'survival').

Each view renders as a Gantt whose **sections = the grouping dimension**, items coloured by
`kind` (critical / active / planned / milestone).

### toggles

- **View switcher:** segmented control or dropdown; persist last choice in `localStorage`.
- **Per-lane show/hide:** legend chips for the current grouping; clicking one hides/shows that
  lane (also persisted). This is the "toggle on and off" Garrett asked for — both switching
  whole views and hiding individual series within a view.

### rendering

Mermaid client-side is fine (the strategy-log artifact already proves the Gantt renders); build
the Mermaid `gantt` string from the filtered/grouped items at runtime. If Mermaid string-building
gets unwieldy with toggles, fall back to the dashboard's existing chart lib with a horizontal-bar
timeline. Keep `securityLevel: "strict"`.

### acceptance (timeline)

- [ ] Four named views selectable; switching regroups the same items without a reload.
- [ ] Per-lane chips hide/show lanes; selection + active view persist across reloads.
- [ ] Items seeded from the 30-June strategy-log Gantt; milestones (whirlpool, Oct-2027 event) render.

## acceptance criteria

- [ ] `strategy brief` tab visible on `/mo`; deep-links via `?tab=strategy-brief`.
- [ ] Signed-in team member can edit a section, add a decision/action, Save with a change-note.
- [ ] Each save bumps `version` and writes a snapshot row; `updated_by` = editor's email.
- [ ] History panel lists versions and can view + restore a prior version (restore = new forward version, no data loss).
- [ ] Not-signed-in users see read-only.
- [ ] RLS on both tables verified (`get_advisors(type:security)` clean).
- [ ] Migration applied via Supabase SQL editor; `npm run deploy:cf` run; `/api/version` `built` newer than merge.

## deploy checklist (per CLAUDE.md — merged ≠ deployed)

1. Merge PR to `main`.
2. Apply the migration in the Supabase SQL editor (it adds tables — do this before/with deploy).
3. `cd port && npm run deploy:cf`.
4. Verify `/api/version` `built` timestamp + smoke-test the tab signed in and signed out.
5. If Mo's read access (bearer) was added, no Cowork reconnect needed unless MCP tool surface changed.

## notes for the builder

- First human write-path in the port — be deliberate about the session gate and the
  transaction around versioning.
- Keep it **lean** (the team explicitly wants lean PM tooling, not heavyweight). One document,
  one history table, a simple diff. No live multi-cursor collab for v1.
- The strategy **log** (the document/decisions narrative) stays in Notion + `docs/cmo/decisions-log.md`
  (git already versions it) — this tab is the **brief** (the working agenda), not the log.
