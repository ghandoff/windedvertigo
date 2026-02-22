# creaseworks — technical design document

version 0.3 · 2026-02-16 · all questions resolved, ready to build

---

## 1. architecture overview and request flow

creaseworks is a Next.js App Router application deployed on Vercel at `creaseworks.windedvertigo.com`. Notion is the editorial CMS; Vercel Postgres is the system of record for users, organisations, entitlements, and access control. Content flows one direction: Notion → Postgres cache → app. Entitlement and identity data lives exclusively in Postgres.

### high-level component map

```
┌───────────────────────────────────────────────────────┐
│  Notion (editorial CMS)                               │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │
│  │ patterns │ │materials │ │ packs  │ │   runs    │  │
│  └──────────┘ └──────────┘ └────────┘ └───────────┘  │
└──────────────┬────────────────────────────────────────┘
               │  Vercel Cron (hourly)
               ▼
┌───────────────────────────────────────────────────────┐
│  Vercel Postgres                                      │
│  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │ content cache    │  │ app data                   │ │
│  │ patterns_cache   │  │ users                      │ │
│  │ materials_cache  │  │ organisations              │ │
│  │ packs_cache      │  │ verified_domains           │ │
│  │ runs_cache       │  │ domain_blocklist           │ │
│  │ pack_patterns    │  │ admin_allowlist            │ │
│  │ pattern_materials│  │ packs_catalogue            │ │
│  └──────────────────┘  │ purchases                  │ │
│                        │ entitlements               │ │
│                        │ access_audit_logs          │ │
│                        └────────────────────────────┘ │
└──────────────┬────────────────────────────────────────┘
               │
               ▼
┌───────────────────────────────────────────────────────┐
│  Next.js App Router (Vercel)                          │
│  creaseworks.windedvertigo.com                        │
│                                                       │
│  server components & route handlers                   │
│  ┌────────────┐ ┌──────────┐ ┌──────────────────────┐│
│  │ public     │ │ authed   │ │ admin                ││
│  │ /sampler   │ │ /matcher │ │ /admin/domains       ││
│  │ /packs     │ │ /runs    │ │ /admin/admins        ││
│  └────────────┘ └──────────┘ └──────────────────────┘│
│                                                       │
│  API route handlers (server-only)                     │
│  ┌────────────────────────────────────────────────┐   │
│  │ /api/patterns  /api/matcher  /api/packs        │   │
│  │ /api/runs      /api/admin/*  /api/auth/*       │   │
│  │ /api/cron/sync-notion                          │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

### request flow for a public sampler page load

1. Browser requests `/sampler`.
2. Next.js Server Component queries `patterns_cache` for rows where `release_channel = 'sampler'` AND `status = 'ready'`.
3. For each pattern, only teaser-tier columns are selected (headline, primary function, arc emphasis, context tags, friction dial, start in 120 seconds, required forms, has find again flag). Full script fields (find, fold, unfold, find again prompt, rails sentence, slots notes, substitutions notes) are **never selected** in this query.
4. HTML is rendered server-side and streamed to the client.
5. No JSON payload containing restricted fields ever reaches the client.

### request flow for an entitled user viewing pack-only content

1. Browser requests `/packs/[packSlug]/patterns/[patternSlug]`.
2. Server Component reads session cookie → resolves user → resolves organisation → checks `entitlements` table for an active entitlement linking that org to the requested pack.
3. If entitled: query `patterns_cache` including IP-tier-appropriate fields. Log the access in `access_audit_logs`.
4. If not entitled: return teaser-tier content only (same as sampler), plus a purchase CTA. Find again mode is shown as a teaser label that links to the pack purchase page.

---

## 2. security model and anti-leak strategy

### principle: data never leaves the server unless authorised

The core invariant is that pack-only and internal-only content fields must never appear in any response to an unauthorised client. This is enforced at three layers:

**layer 1 — query-level column selection.** Every database query uses explicit column lists, never `SELECT *`. Two reusable query builders exist:

- `selectTeaserColumns()` — returns only: title, headline, primary_function, arc_emphasis, context_tags, friction_dial, start_in_120s, required_forms, release_channel, slots_optional, has_find_again (boolean derived from find_again_mode being non-null).
- `selectEntitledColumns(ipTier)` — returns teaser columns plus tier-appropriate additional fields. For `standard`: adds find, fold, unfold, find again mode, find again prompt, rails sentence. For `full script` / `full + variations`: adds all of the above plus slots notes, substitutions notes.

**layer 2 — server-only route handlers.** All pattern content routes are React Server Components or Route Handlers. There are no client-side fetches to Notion or to any endpoint that could return full content. The matcher API endpoint returns pattern IDs and teaser metadata only; the client navigates to entitled pattern pages for full content.

**layer 3 — response auditing.** A middleware function `assertNoLeakedFields(responseBody)` runs in development and staging. It scans serialised JSON for field names that should never appear in public responses (find, fold, unfold, find_again_prompt, rails_sentence, slots_notes, substitutions_notes) and throws if found.

### additional security measures

- **rate limiting**: Vercel Edge Middleware with a token-bucket algorithm on `/api/*` routes. 60 requests/min for authenticated users, 20/min for anonymous.
- **audit logging**: every access to pack-only content writes to `access_audit_logs` with user_id, org_id, pattern_id, pack_id, ip_address, timestamp, and fields_accessed.
- **watermarking**: any downloadable PDF or card is generated server-side with an overlay containing: organisation name, user email, pack name, and generation date (formatted dd/mm/yyyy per brand guidelines). Uses `pdf-lib`.
- **internal-only content**: patterns with `release_channel = 'internal-only'` are never served through any public or entitled route. They are only visible through an internal admin interface behind admin authentication.

### content tier matrix

| release channel | ip tier | anonymous | entitled org user | internal admin |
|---|---|---|---|---|
| sampler | teaser | teaser fields | teaser fields | all fields |
| sampler | standard+ | teaser fields | standard+ fields | all fields |
| pack-only | any | not visible at all | tier-appropriate fields | all fields |
| internal-only | any | not visible | not visible | all fields |

### find again teaser strategy

Find again mode is entitled-tier content — the specific transfer mechanism (e.g., "same material new function", "transfer to life/work") is IP that reveals how patterns are designed. However, the *existence* of a find again step is teased in the sampler and matcher. The teaser shows a flag like "includes find again" and, when clicked, navigates to the pack purchase page with an explanation of what find again unlocks. This serves as a conversion hook without leaking the pedagogical structure.

---

## 3. database schema

### 3a. Notion content cache tables

These are populated by the cron ingestion job and are read-only from the app's perspective. All string values are normalised to lowercase on ingest as a safety net against accidental capitalisation in Notion.

```sql
-- cached patterns from Notion
CREATE TABLE patterns_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,                 -- "pattern" title field
  headline        TEXT,
  release_channel TEXT NOT NULL,                 -- 'sampler' | 'pack-only' | 'internal-only'
  ip_tier         TEXT NOT NULL,                 -- 'teaser' | 'standard' | 'full script' | 'full + variations'
  status          TEXT NOT NULL,                 -- 'idea' | 'draft' | 'ready'
  primary_function TEXT,                         -- e.g. 'express', 'connect / stitch'
  arc_emphasis    JSONB DEFAULT '[]',            -- e.g. ["connect", "explore"]
  context_tags    JSONB DEFAULT '[]',            -- e.g. ["remote", "low-resource"]
  friction_dial   SMALLINT,                      -- 1-5 (parsed from Notion select string)
  start_in_120s   BOOLEAN DEFAULT FALSE,
  required_forms  JSONB DEFAULT '[]',            -- e.g. ["mark-making media", "sheet goods / surfaces"]
  slots_optional  JSONB DEFAULT '[]',            -- e.g. ["connector", "surface", "mark-maker"]
  slots_notes     TEXT,                          -- ENTITLED FIELD
  rails_sentence  TEXT,                          -- ENTITLED FIELD
  find            TEXT,                          -- ENTITLED FIELD
  fold            TEXT,                          -- ENTITLED FIELD
  unfold          TEXT,                          -- ENTITLED FIELD
  find_again_mode TEXT,                          -- ENTITLED FIELD ('new material same function' | 'same material new function' | 'same build new constraint' | 'transfer to life/work')
  find_again_prompt TEXT,                        -- ENTITLED FIELD
  substitutions_notes TEXT,                      -- ENTITLED FIELD
  notion_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  slug            TEXT UNIQUE                    -- generated from title on first insert
);

-- cached materials from Notion
CREATE TABLE materials_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,                 -- "material" title
  form_primary    TEXT,                          -- e.g. 'sheet goods / surfaces'
  functions       JSONB DEFAULT '[]',            -- e.g. ["express", "build structure"]
  connector_modes JSONB DEFAULT '[]',            -- e.g. ["trigger", "share"]
  context_tags    JSONB DEFAULT '[]',            -- e.g. ["classroom", "remote"]
  do_not_use      BOOLEAN DEFAULT FALSE,
  do_not_use_reason TEXT,                        -- e.g. 'dangerous', 'too messy'
  shareability    TEXT,
  min_qty_size    TEXT,
  examples_notes  TEXT,
  generation_notes TEXT,
  generation_prompts JSONB DEFAULT '[]',
  source          TEXT,                          -- e.g. 'druin/yip 2020', 'internal'
  notion_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

-- junction: which patterns use which materials (from Notion relation)
CREATE TABLE pattern_materials (
  pattern_id UUID REFERENCES patterns_cache(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials_cache(id) ON DELETE CASCADE,
  PRIMARY KEY (pattern_id, material_id)
);

-- cached packs from Notion
CREATE TABLE packs_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,                 -- "pack" title
  description     TEXT,
  status          TEXT NOT NULL,                 -- 'draft' | 'ready' | 'retired'
  notion_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  slug            TEXT UNIQUE
);

-- junction: which patterns belong to which packs (from Notion relation)
CREATE TABLE pack_patterns (
  pack_id    UUID REFERENCES packs_cache(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES patterns_cache(id) ON DELETE CASCADE,
  PRIMARY KEY (pack_id, pattern_id)
);

-- cached runs from Notion (internal use)
-- BD touchpoint is NOT synced — it stays in Notion only
CREATE TABLE runs_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_id       TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  pattern_notion_id TEXT,                        -- resolved to patterns_cache at query time
  run_type        TEXT,                          -- 'internal practice' | 'webinar' | 'delivery' | 'BD/prospect' | 'R&D'
  run_date        DATE,
  context_tags    JSONB DEFAULT '[]',
  trace_evidence  JSONB DEFAULT '[]',            -- e.g. ["photo", "video", "quote"]
  what_changed    TEXT,                          -- INTERNAL-ONLY FIELD
  next_iteration  TEXT,                          -- INTERNAL-ONLY FIELD
  notion_last_edited TIMESTAMPTZ,
  synced_at       TIMESTAMPTZ DEFAULT NOW()
);

-- junction: materials actually used in a run
CREATE TABLE run_materials (
  run_id      UUID REFERENCES runs_cache(id) ON DELETE CASCADE,
  material_id UUID REFERENCES materials_cache(id) ON DELETE CASCADE,
  PRIMARY KEY (run_id, material_id)
);
```

### 3b. application data tables

```sql
-- users (authenticated via Auth.js magic link or future SSO)
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT UNIQUE NOT NULL,
  email_verified  BOOLEAN DEFAULT FALSE,
  name            TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- organisations
CREATE TABLE organisations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- verified domains linked to organisations
CREATE TABLE verified_domains (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  domain          TEXT UNIQUE NOT NULL,          -- e.g. 'stanford.edu'
  verified        BOOLEAN DEFAULT FALSE,
  verification_token TEXT,
  verification_email TEXT,                       -- address we sent to (org creator specifies)
  verified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- blocked consumer domains (gmail.com, yahoo.com, etc.)
CREATE TABLE domain_blocklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain          TEXT UNIQUE NOT NULL,
  enabled         BOOLEAN DEFAULT TRUE,
  reason          TEXT,                          -- e.g. 'consumer email provider'
  added_by        UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- admin allowlist — who can access admin pages
CREATE TABLE admin_allowlist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by      UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- organisation membership (derived from verified email domain)
CREATE TABLE org_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role            TEXT DEFAULT 'member',         -- 'member' | 'admin'
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

-- app-side pack catalogue (pricing, visibility)
CREATE TABLE packs_catalogue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_cache_id   UUID UNIQUE NOT NULL REFERENCES packs_cache(id),
  price_cents     INTEGER,                       -- null = not yet priced
  currency        TEXT DEFAULT 'USD',
  visible         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- purchases (stub — will connect to Stripe later)
CREATE TABLE purchases (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id),
  pack_catalogue_id UUID NOT NULL REFERENCES packs_catalogue(id),
  purchaser_id    UUID NOT NULL REFERENCES users(id),
  amount_cents    INTEGER,
  currency        TEXT DEFAULT 'USD',
  payment_provider TEXT DEFAULT 'stub',          -- 'stub' | 'stripe'
  payment_ref     TEXT,
  status          TEXT DEFAULT 'completed',      -- 'pending' | 'completed' | 'refunded'
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- entitlements — the real access control table
CREATE TABLE entitlements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organisations(id),
  pack_cache_id   UUID NOT NULL REFERENCES packs_cache(id),
  purchase_id     UUID REFERENCES purchases(id),
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,                   -- null = perpetual (default; one-time purchase model)
  revoked_at      TIMESTAMPTZ,                   -- soft revoke (admin override only)
  UNIQUE (org_id, pack_cache_id)
);

-- access audit log
CREATE TABLE access_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  org_id          UUID REFERENCES organisations(id),
  pattern_id      UUID REFERENCES patterns_cache(id),
  pack_id         UUID REFERENCES packs_cache(id),
  action          TEXT NOT NULL,                  -- 'view_entitled' | 'download_pdf' | 'view_sampler' | 'admin_*'
  ip_address      INET,
  fields_accessed TEXT[],
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- indexes
CREATE INDEX idx_patterns_release ON patterns_cache(release_channel);
CREATE INDEX idx_patterns_status ON patterns_cache(status);
CREATE INDEX idx_materials_form ON materials_cache(form_primary);
CREATE INDEX idx_materials_do_not_use ON materials_cache(do_not_use);
CREATE INDEX idx_entitlements_org ON entitlements(org_id);
CREATE INDEX idx_entitlements_pack ON entitlements(pack_cache_id);
CREATE INDEX idx_verified_domains_domain ON verified_domains(domain);
CREATE INDEX idx_blocklist_domain ON domain_blocklist(domain);
CREATE INDEX idx_audit_user ON access_audit_logs(user_id);
CREATE INDEX idx_audit_created ON access_audit_logs(created_at);
CREATE INDEX idx_org_memberships_user ON org_memberships(user_id);
```

---

## 4. Notion ingestion and caching plan

### strategy

The app never reads from Notion at request time. A Vercel Cron job runs `GET /api/cron/sync-notion` on a schedule. This endpoint is protected by the `CRON_SECRET` environment variable.

### normalise-on-ingest

All string values from Notion are lowercased during sync using `.toLowerCase()` before writing to Postgres. This is the default behaviour. Title fields (pattern names, material names, pack names) are stored as-is from Notion since they're already lowercase per editorial convention, but the normalisation acts as a safety net. Enum values (release channel, ip tier, status, context tags, forms, slots, functions, etc.) are always lowercased to ensure consistent matching in queries and the matcher algorithm.

Exception: the `friction dial` select field stores string values "1" through "5" in Notion. The sync parses these to `SMALLINT` via `parseInt()`.

Exception: the `start in 120 seconds` and `do not use` checkbox fields return `true`/`false` from the Notion API. These are stored as `BOOLEAN`.

### sync algorithm

1. For each source (patterns, materials, packs, runs):
   a. Call Notion API `databases.query()` with the appropriate database ID, paginating through all results.
   b. For each page, extract properties into a flat row, applying lowercase normalisation.
   c. Upsert into the corresponding `*_cache` table using `ON CONFLICT (notion_id) DO UPDATE`.
   d. After upserting all rows, delete any `*_cache` rows whose `notion_id` is not in the current Notion result set (handles deletions in Notion).
2. Resolve relations:
   a. For `pattern_materials`: read the materials relation from each pattern, look up the corresponding `materials_cache.id` by `notion_id`, upsert into the junction table.
   b. For `pack_patterns`: same approach with the patterns included relation on packs.
   c. For `run_materials`: same approach with materials used (actual) on runs.
3. Auto-generate slugs from titles using `slugify()` for patterns and packs (only on first insert, never updated, to keep URLs stable).
4. Record `synced_at` timestamp on every touched row.

### cron schedule

Hourly, plus a manual "sync now" button in the admin UI. Content changes are editorial, not real-time; hourly is plenty for MVP. We can tighten the schedule later if needed.

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-notion",
      "schedule": "0 * * * *"
    }
  ]
}
```

### revalidation

- Next.js pages use `revalidate = 3600` (1 hour) for ISR on public pages, aligned with the cron schedule.
- After a successful sync, the cron job calls `revalidateTag('notion-content')` to bust the cache immediately.
- Admin can trigger a manual sync via the admin UI, which calls the same endpoint and revalidates.

### Notion API specifics

- Use `@notionhq/client` v2.
- The four database IDs are environment variables: `NOTION_DB_PATTERNS`, `NOTION_DB_MATERIALS`, `NOTION_DB_PACKS`, `NOTION_DB_RUNS`.
- Relations in Notion return arrays of page IDs. We map these to internal UUIDs via the `notion_id` column.
- Rate limiting: Notion API allows 3 requests/second. The sync job uses serial pagination with a 350ms delay between requests.
- BD touchpoint relation on runs is **not synced**. It stays in Notion only.

### Notion database IDs (confirmed 2026-02-16)

| database | Notion ID | collection ID |
|---|---|---|
| creaseworks — patterns | `b446ffd5-d166-4a31-b4f5-f6a93aadaab8` | `0a90f5dc-a264-48ff-a49f-fabb07667116` |
| co-design materials | `a6b32bc6-e021-41a4-b6f4-3d528e814d71` | `2bb1cd66-b20d-4b21-8816-1feba57f187a` |
| creaseworks — packs | `beb34e7b-86cd-4f20-b9be-641431b99e5f` | `7b9e565b-29ad-4e6f-91f9-b12772cc2d37` |
| creaseworks — runs | `67215537-b307-49f6-b0db-d6ca7a514c78` | `8702904a-3802-4bda-a31b-29050c238f92` |

---

## 5. API route plan

All routes are Next.js Route Handlers (server-only) or Server Components. None expose a client-fetchable JSON endpoint that includes entitled fields without auth.

### public routes (no auth required)

| route | method | purpose |
|---|---|---|
| `/` | GET | landing page (server component) |
| `/sampler` | GET | public sampler grid — teaser-tier patterns only (server component) |
| `/sampler/[slug]` | GET | single pattern teaser view (server component) |
| `/packs` | GET | pack catalogue — visible packs with descriptions (server component) |
| `/api/matcher` | POST | matcher endpoint — accepts materials, forms, slots, context; returns ranked pattern IDs + teaser metadata |

### authenticated routes (login required)

| route | method | purpose |
|---|---|---|
| `/packs/[slug]` | GET | pack detail — if entitled, shows full pattern list with tier-appropriate content; if not, shows purchase CTA |
| `/packs/[slug]/patterns/[patternSlug]` | GET | entitled pattern view — full content per ip tier |
| `/runs` | GET | user's org runs (if internal user); personal notes only (if external org user) |
| `/runs/new` | GET | create a new run |
| `/api/runs` | POST | create run |
| `/api/runs/[id]` | PATCH | update run |
| `/api/auth/login` | POST | send magic link email |
| `/api/auth/callback` | GET | verify magic link token |
| `/api/auth/logout` | POST | clear session |

### admin routes (admin allowlist required)

| route | method | purpose |
|---|---|---|
| `/admin/domains` | GET | view and manage domain blocklist |
| `/api/admin/domains` | GET/POST/PATCH/DELETE | CRUD for domain blocklist |
| `/admin/admins` | GET | view and manage admin allowlist |
| `/api/admin/admins` | GET/POST/DELETE | CRUD for admin allowlist |
| `/admin/entitlements` | GET | view and grant entitlements (stub purchase) |
| `/api/admin/entitlements` | POST | grant entitlement to org for a pack |
| `/admin/sync` | POST | trigger manual Notion sync |
| `/api/cron/sync-notion` | GET | cron-triggered Notion sync (protected by CRON_SECRET) |

### server-only enforcement

- All `/api/*` routes use Route Handlers, which execute exclusively on the server.
- All page routes use Server Components by default (no `"use client"` at the page level).
- Client components receive only pre-filtered props passed down from server components.
- No `fetch()` calls from client components to any endpoint that could return entitled fields.

---

## 6. matcher algorithm and ranking logic

### inputs

The user provides (all optional, but at least one required):

```typescript
interface MatcherInput {
  materials: string[];       // material IDs the user has on hand
  forms: string[];           // required forms they can provide, e.g. ["sheet goods / surfaces"]
  slots: string[];           // optional slot tags, e.g. ["connector", "surface"]
  contexts: string[];        // e.g. ["remote", "low-resource"]
}
```

### candidate pool

Start with all patterns where `status = 'ready'` and `release_channel IN ('sampler', 'pack-only')`. Internal-only patterns are excluded entirely.

**hard filter: context constraints.** If the user specifies context tags (e.g., "remote", "low-resource"), only patterns whose `context_tags` include ALL of the user's specified contexts survive into the scoring pool. A pattern that doesn't work in the user's context is useless regardless of material coverage. If the user specifies no context constraints, all ready patterns are eligible.

**hard filter: do-not-use materials.** Materials with `do_not_use = true` are excluded from the matcher's material pool entirely. They are never shown in the material picker, never matched, and never suggested as substitutions.

### scoring (per surviving pattern)

Each pattern receives a composite score from 0 to 100:

**1. materials coverage (0–45 points)**

For each pattern, resolve its `pattern_materials` list (excluding do-not-use materials). Calculate:
- `coverage = |user_materials ∩ pattern_materials| / |pattern_materials|`
- score = `coverage × 45`

If a pattern has zero required materials, award 45 (no barrier).

**2. forms coverage (0–30 points)**

Compare user's available forms to the pattern's `required_forms`:
- `forms_coverage = |user_forms ∩ pattern_required_forms| / |pattern_required_forms|`
- score = `forms_coverage × 30`

If the pattern has no required forms, award 30.

**3. slots match bonus (0–10 points)**

If the user specified slot preferences, award points for overlap:
- `slots_score = |user_slots ∩ pattern_slots| / max(|pattern_slots|, 1) × 10`

If the user specified no slots, award 10 (slots are always opt-in, never penalised).

**4. quick-start bonus (0–10 points)**

If `start_in_120s = true` → +10 points. This rewards patterns that get participants moving immediately, which matters more than the previous design acknowledged.

**5. friction penalty (0–5 point deduction)**

Subtract `(friction_dial - 1)` points. Friction of 1 costs 0; friction of 5 costs 4.

### response structure

```typescript
interface MatcherResult {
  ranked: {
    patternId: string;
    slug: string;
    title: string;
    headline: string;
    score: number;
    primaryFunction: string;
    arcEmphasis: string[];
    frictionDial: number;
    startIn120s: boolean;
    coverage: {
      materialsCovered: string[];    // names of matched materials
      materialsMissing: string[];    // names of missing materials
      formsCovered: string[];
      formsMissing: string[];
      suggestedSubstitutions: {      // auto-generated from form matching
        missingMaterial: string;
        availableAlternatives: string[];  // user's materials with same form
      }[];
    };
    substitutionsNotes: string | null;  // from Notion, only if user is entitled
    hasFindAgain: boolean;              // teaser: true if find_again_mode is set
    findAgainMode: string | null;       // ONLY if user is entitled, else null
    isEntitled: boolean;
    packSlugs: string[];
  }[];
  meta: {
    contextFiltersApplied: string[];
    totalCandidates: number;          // before context filter
    totalAfterFilter: number;         // after context filter
  };
}
```

Patterns are sorted by score descending. Ties are broken by friction_dial ascending (lower friction first), then alphabetically by title.

### substitution suggestions

When a pattern has `materialsMissing.length > 0`, the matcher checks each missing material's `form_primary` and finds other materials the user *does* have with the same form. These are returned as `suggestedSubstitutions` alongside the pattern's `substitutions_notes` (only if the user is entitled). This auto-generation works independently of the authored notes — both are surfaced when available.

---

## 7. admin page plan

### domain blocklist management (`/admin/domains`)

**purpose**: maintain a list of consumer/freemail domains that cannot be used for organisation creation.

**UI**: a simple table view with columns: domain, enabled (toggle), reason, added by, date added. Above the table: an "add domain" form with fields for domain and reason. Each row has a toggle for enabled/disabled and an edit button for the reason field.

**seed data**: the initial migration seeds common consumer domains: gmail.com, yahoo.com, hotmail.com, outlook.com, aol.com, icloud.com, mail.com, protonmail.com, zoho.com, yandex.com, gmx.com, live.com, msn.com, me.com, qq.com, 163.com, and others.

**authorisation**: the admin pages use a middleware that checks the `admin_allowlist` table:

1. User must be authenticated (session cookie).
2. Middleware queries `SELECT 1 FROM admin_allowlist WHERE user_id = $1`.
3. If not found, return 403.
4. All admin actions are logged in `access_audit_logs` with `action = 'admin_*'`.

### admin allowlist management (`/admin/admins`)

**purpose**: control who has admin access. Bootstrapped with the first admin via a database seed or environment variable `INITIAL_ADMIN_EMAIL`.

**UI**: a table of current admins (email, granted by, date). An "add admin" form that takes an email address, looks up the user, and adds them to the allowlist. A "remove" button on each row (with confirmation), except the last admin (cannot remove yourself if you're the only admin).

**bootstrap flow**: on first deploy, if `admin_allowlist` is empty and `INITIAL_ADMIN_EMAIL` is set, the system auto-creates the admin entry for that user (creating the user record if needed).

---

## 8. authentication strategy

### method: Auth.js with email magic link

Use Auth.js (NextAuth.js v5) with the Email provider for MVP. This gives us magic link auth today and a clear migration path to institutional SSO (SAML, Microsoft Entra, Google Workspace) later, which organisations will inevitably request.

1. User enters email at `/login`.
2. Auth.js generates a short-lived verification token, stores it, and sends an email via Resend.
3. User clicks link → Auth.js verifies token → creates session → sets HttpOnly secure cookie.
4. Session uses Auth.js's built-in JWT strategy containing `{ userId, email }`. Sessions expire after 7 days.

### organisation auto-join

After authentication, the user's email domain is extracted. If `verified_domains` has a verified entry for that domain, the user is auto-added to `org_memberships` for that org (if not already a member). This gives them access to any entitlements that org holds.

### domain verification flow

1. Admin or org creator initiates domain verification. The org creator specifies the verification email address (any address at the domain).
2. System checks `domain_blocklist` — if the domain is blocked and enabled, reject immediately.
3. System generates a `verification_token` and sends an email to the specified address.
4. Recipient clicks the verification link → server validates the token → sets `verified = true` on the `verified_domains` row.
5. All existing users with that email domain are auto-joined to the org.

### email provider

Resend, configured via `RESEND_API_KEY`. For local development, email sending is stubbed to console output.

---

## 9. brand and design system

### brand guidelines (from w.v brand document)

- **typography**: Inter (regular, bold, light). All UI text is lowercase except acronyms (e.g., BD, R&D, PDF) and proper nouns where legally required.
- **colour palette**:
  - cadet blue: `#273248` (primary / text / headers)
  - redwood: `#b15043` (accent / CTAs / alerts)
  - burnt sienna: `#cb7858` (secondary accent / hover states)
  - champagne: `#ffebd2` (backgrounds / cards)
  - white: `#ffffff` (page backgrounds / contrast)
- **spelling**: British English throughout all user-facing copy (colour, organisation, licence, etc.). Internal code uses American English for consistency with the TypeScript/React ecosystem.
- **date format**: dd/mm/yyyy (e.g., 16/02/2026) per brand guidelines. 12-hour time.
- **punctuation**: Oxford comma. Full stops in body copy, not in headers.
- **voice**: playful, human, dynamic. Avoid corporate jargon.

### component library

Use shadcn/ui as the component foundation (built on Radix primitives), themed to the w.v colour palette. Tailwind CSS for utility classes, configured with the brand colours as design tokens.

---

## 10. runs visibility model

### field-level visibility

| field | internal admin | internal org user | external org user |
|---|---|---|---|
| run (title) | visible | visible | own runs only |
| pattern | visible | visible | own runs only |
| run type | visible | visible | own runs only |
| date | visible | visible | own runs only |
| context tags | visible | visible | own runs only |
| materials used (actual) | visible | visible | own runs only |
| trace evidence captured | visible | visible | own runs only |
| what changed | visible | visible | own runs only (optional) |
| next iteration | visible | visible | own runs only (optional) |

External org users can create and view their own runs, including optional `what changed` and `next iteration` fields as reflective-practice tools. However, external users only ever see their own runs — never internal runs or other organisations' data. The fields are optional on the external form to keep the experience lightweight. Internal users see all runs across the organisation.

---

## 11. MVP milestones

### MVP 0: repo scaffold, database, and sampler (week 1)

**the smallest shippable slice**: a deployed Next.js app with the database schema created, the Notion sync cron working, and a public sampler page rendering teaser content.

deliverables:
- Next.js App Router project with TypeScript, Tailwind CSS, ESLint
- Vercel Postgres schema migration (all tables from section 3)
- Notion sync cron job (`/api/cron/sync-notion`) with normalise-on-ingest
- `/sampler` page showing teaser-tier patterns from Postgres cache
- `vercel.json` with hourly cron configuration
- Brand theming: Inter font, w.v colour palette, lowercase UI convention
- Environment variables documented
- Seed for domain blocklist
- Deploy to `creaseworks.windedvertigo.com`

### MVP 1: authentication and org model (week 2)

deliverables:
- Auth.js with Email provider (magic link)
- User creation on first login
- Organisation and verified domain tables populated
- Domain blocklist check on org creation
- Auto-join org membership based on verified email domain
- Domain verification email flow (stubbed in dev)

### MVP 2: entitlements, pack-only content, and watermarking (week 3)

deliverables:
- `/packs` catalogue page
- `/packs/[slug]` with entitlement check
- `/packs/[slug]/patterns/[patternSlug]` with ip-tier-gated content
- Find again teaser: "includes find again" flag on sampler/matcher cards, clicking links to pack purchase page
- `entitlements` table wired up
- Stub purchase flow (admin grants entitlement via admin UI)
- Access audit logging
- `assertNoLeakedFields` test utility
- Server-side PDF card generation with watermark (organisation name, user email, pack name, dd/mm/yyyy date)
- Download button on entitled pattern pages
- Audit log entry for every download

### MVP 3: matcher (week 4)

deliverables:
- `/matcher` page with input form (materials picker excluding do-not-use, forms checklist, optional slots, context toggles)
- `POST /api/matcher` with hard context filter + scoring algorithm
- Results page with ranked patterns, coverage details, missing items, auto-generated substitution suggestions
- Find again teaser always shown on results (links to pack page for non-entitled users)

### MVP 4: admin pages and rate limiting (week 5)

deliverables:
- `/admin/domains` — domain blocklist CRUD
- `/admin/admins` — admin allowlist CRUD
- `/admin/entitlements` — grant/revoke entitlements
- `/admin/sync` — manual Notion sync trigger
- Admin middleware with allowlist check
- Rate limiting on API routes (60/min authed, 20/min anon)

### MVP 5: runs and evidence (week 6)

deliverables:
- `/runs` page (list runs for user's org)
- `/runs/new` — create a run linked to a pattern
- Run type, date, context tags, materials used, trace evidence
- Internal users see what changed and next iteration; external users do not
- Lightweight UX (must not feel like a tax)

### future (post-MVP)

- Stripe integration for real purchases
- SSO providers (SAML, Microsoft Entra, Google Workspace) via Auth.js
- Team management UI within orgs
- Run analytics and dashboards
- Notion webhook listener (replace polling with push)
- Mobile-optimised matcher
- Multi-zone gateway at `treefort.windedvertigo.com` if additional apps are built

---

## 12. resolved decisions

All open questions from v0.1 and v0.2 have been resolved:

1. **runs visibility**: external org users see `what changed` and `next iteration` as optional fields on their own runs (reflective-practice use). They never see internal runs or other organisations' data.

2. **entitlement duration**: one-time purchase, perpetual access. The `expires_at` column is retained in the schema for future flexibility but defaults to null. No renewal UI, no expiry warnings.

3. **multi-pack overlap**: unlock silently. If a pattern appears in multiple packs and the org owns any one of them, the content is simply available. No "unlocked via Pack A" badge.

4. **sampler pattern selection**: `status = 'ready'` is the only gate. Patterns with `release_channel = 'sampler'` and `status = 'ready'` appear on the public sampler. To hide a sampler pattern, set it to draft. No separate visibility toggle.

5. **email provider**: Resend free tier (100 emails/day, 3,000/month). Sending domain: `windedvertigo.com` via DNS verification in Resend. Sending address: `noreply@windedvertigo.com`. No additional subscription cost.

6. **find again teaser copy** (first pass, to be edited):

> **on sampler and matcher cards** (short label):
> "includes find again"
>
> **on click / purchase CTA page**:
>
> ### you've built something. now find it again.
>
> every creaseworks pattern ends with a step we call *find again* — a prompt that helps you and your participants spot the same move in a completely different context.
>
> maybe it's the same material doing a new job. maybe it's the same structure under a tighter constraint. maybe it's the leap from the workshop table to Tuesday morning.
>
> find again is where a single activity becomes a transferable skill.
>
> it's included with every pattern in **[pack name]**.
>
> [get the pack →]

### note on find again copy

The copy above deliberately protects the IP by never naming the specific find again modes (new material same function, transfer to life/work, etc.). It describes the *feeling* of transfer without revealing the taxonomy. The entitled view then shows the specific mode and prompt — the "how" behind the "what."

---

## appendix A: environment variables

```
# Notion
NOTION_API_KEY=secret_...
NOTION_DB_PATTERNS=b446ffd5-d166-4a31-b4f5-f6a93aadaab8
NOTION_DB_MATERIALS=a6b32bc6-e021-41a4-b6f4-3d528e814d71
NOTION_DB_PACKS=beb34e7b-86cd-4f20-b9be-641431b99e5f
NOTION_DB_RUNS=67215537-b307-49f6-b0db-d6ca7a514c78

# database
POSTGRES_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...

# auth
AUTH_SECRET=...
INITIAL_ADMIN_EMAIL=garrett@windedvertigo.com

# email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@windedvertigo.com

# cron
CRON_SECRET=...

# app
NEXT_PUBLIC_APP_URL=https://creaseworks.windedvertigo.com
```

## appendix B: Notion field → cache column mapping (patterns)

all Notion field names are lowercase as of 2026-02-16.

| Notion field | cache column | type in Notion | tier |
|---|---|---|---|
| pattern (title) | `title` | title | teaser |
| headline | `headline` | text | teaser |
| release channel | `release_channel` | select | system |
| ip tier | `ip_tier` | select | system |
| status | `status` | status | system |
| primary function | `primary_function` | select | teaser |
| arc emphasis | `arc_emphasis` | multi_select | teaser |
| context tags | `context_tags` | multi_select | teaser |
| friction dial | `friction_dial` | select → SMALLINT | teaser |
| start in 120 seconds | `start_in_120s` | checkbox → BOOLEAN | teaser |
| required forms | `required_forms` | multi_select | teaser |
| slots (optional) | `slots_optional` | multi_select | teaser |
| slots notes (optional) | `slots_notes` | text | entitled |
| rails sentence | `rails_sentence` | text | entitled |
| find | `find` | text | entitled |
| fold | `fold` | text | entitled |
| unfold | `unfold` | text | entitled |
| find again mode | `find_again_mode` | select | entitled (teased as boolean) |
| find again prompt | `find_again_prompt` | text | entitled |
| substitutions notes | `substitutions_notes` | text | entitled |
| materials | `pattern_materials` junction | relation | teaser (names only) |

## appendix C: Notion field → cache column mapping (materials)

| Notion field | cache column | type in Notion |
|---|---|---|
| material (title) | `title` | title |
| form (primary) | `form_primary` | select |
| functions | `functions` | multi_select |
| connector modes | `connector_modes` | multi_select |
| context tags | `context_tags` | multi_select |
| do not use | `do_not_use` | checkbox → BOOLEAN |
| do not use reason | `do_not_use_reason` | select |
| shareability | `shareability` | text |
| min qty / size | `min_qty_size` | text |
| examples / notes | `examples_notes` | text |
| generation notes | `generation_notes` | text |
| generation prompts | `generation_prompts` | multi_select |
| source | `source` | select |

## appendix D: Notion field → cache column mapping (packs)

| Notion field | cache column | type in Notion |
|---|---|---|
| pack (title) | `title` | title |
| description | `description` | text |
| status | `status` | status |
| patterns included | `pack_patterns` junction | relation |

## appendix E: Notion field → cache column mapping (runs)

| Notion field | cache column | type in Notion | visibility |
|---|---|---|---|
| run (title) | `title` | title | all |
| pattern | `pattern_notion_id` | relation | all |
| run type | `run_type` | select | all |
| date | `run_date` | date | all |
| context tags | `context_tags` | multi_select | all |
| materials used (actual) | `run_materials` junction | relation | all |
| trace evidence captured | `trace_evidence` | multi_select | all |
| what changed | `what_changed` | text | internal only |
| next iteration | `next_iteration` | text | internal only |
| BD touchpoint | **not synced** | relation | Notion only |

## appendix F: enum values reference (all lowercase)

### patterns

- **release channel**: sampler, pack-only, internal-only
- **ip tier**: teaser, standard, full script, full + variations
- **status**: idea, draft, ready
- **primary function**: express, inspire, elaborate, specify content, build structure, create space / stage, enable movement, connect / stitch, divide / revise, organize / sort, coordinate / share, capture / remember
- **arc emphasis**: connect, explore, transform
- **context tags**: classroom, home, remote, low-resource, travel-kit, mess-sensitive
- **friction dial**: 1, 2, 3, 4, 5
- **required forms**: mark-making media, sheet goods / surfaces, linear / filament, discrete small parts, modules / construction units, containers / vessels, volumes / substrates, found objects / evocative artifacts, wearables / embodied props, overlay / translucency media, cutting / dividing, joining / fastening
- **slots (optional)**: connector, surface, mark-maker, small parts, modules, container, wearable, found object, cutting tool, joining tool
- **find again mode**: new material same function, same material new function, same build new constraint, transfer to life/work

### materials

- **form (primary)**: mark-making media, sheet goods / surfaces, linear / filament, discrete small parts, modules / construction units, containers / vessels, volumes / substrates, found objects / evocative artifacts, wearables / embodied props, overlay / translucency media, cutting / dividing, joining / fastening
- **functions**: express, inspire, elaborate, specify content, build structure, create space / stage, enable movement, connect / stitch, divide / revise, organize / sort, coordinate / share, capture / remember
- **connector modes**: trigger, share, stitching, revision
- **do not use reason**: dangerous, too messy, too distracting, other
- **source**: druin/yip 2020, internal, other

### packs

- **status**: draft, ready, retired

### runs

- **run type**: internal practice, webinar, delivery, BD/prospect, R&D
- **trace evidence captured**: photo, video, quote, artifact, notes
- **context tags**: classroom, home, remote, low-resource, travel-kit, mess-sensitive
