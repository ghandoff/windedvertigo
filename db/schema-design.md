# Nordic SQR-RCT — Postgres Schema Design

> Phase N1 deliverable for the Notion → Supabase migration. High-level table layout + relationship graph + property-type mapping. Full Drizzle schema (`schema.ts`) in a follow-up commit once each domain model's properties are fully audited.

## Migration goal

Move Nordic's 15 Notion databases to a relational Postgres schema on Supabase, behind a dual-write transition phase. Notion stays as an admin-UI / audit fallback; Supabase becomes the single source of truth for app reads + writes.

## Table inventory (15 tables → roughly the 15 Notion DBs)

### SQR-RCT subsystem (3 tables)

| Table | Notion DB env var | Holds | Source files |
|---|---|---|---|
| `reviewers` | `NOTION_REVIEWER_DB` | User accounts (researchers + ops staff). Has email, password hash (bcrypt), role, profile photo URL. | `src/app/api/auth/*/route.js`, `src/lib/auth.js` |
| `intakes` | `NOTION_INTAKE_DB` | Study intake forms — one row per RCT being scored. Title, DOI, journal, year, etc. | `src/lib/intakes.js` (verify) |
| `scores` | `NOTION_SCORES_DB` | Score entries — one row per (reviewer × intake) combo. Holds the 11 rubric-question answers + computed total. | `src/lib/scores.js` (verify) |

### PCS subsystem (12 tables)

| Table | Notion DB env var | Holds | Source files |
|---|---|---|---|
| `pcs_documents` | `NOTION_PCS_DOCUMENTS_DB` | Top-level entity: Product Claim Substantiation document per finished good. PCS ID, classification, file status, SKUs. | `src/lib/pcs-documents.js` |
| `pcs_versions` | `NOTION_PCS_VERSIONS_DB` | Version history of PCS documents. FK → pcs_documents. | `src/lib/pcs-versions.js` (verify) |
| `pcs_claims` | `NOTION_PCS_CLAIMS_DB` | Individual claims (statements requiring evidence). FK → pcs_versions. | `src/lib/pcs-claims.js` |
| `pcs_evidence` | `NOTION_PCS_EVIDENCE_DB` | Evidence records (linked study results). FK → pcs_claims (via packets). | `src/lib/pcs-evidence.js` |
| `pcs_evidence_packets` | `NOTION_PCS_EVIDENCE_PACKETS_DB` | Bundles of evidence supporting a claim. FK → pcs_claims. | `src/lib/pcs-evidence-packets.js` |
| `pcs_requests` | `NOTION_PCS_REQUESTS_DB` | Requests for substantiation work. FK → pcs_documents. | `src/lib/pcs-requests.js` (verify) |
| `pcs_revision_events` | `NOTION_PCS_REVISION_EVENTS_DB` | Audit log of field-level edits across PCS entities. Polymorphic FK (entity_type + entity_id). | `src/lib/pcs-mutate.js` |
| `pcs_canonical_claims` | `NOTION_PCS_CANONICAL_CLAIMS_DB` | Canonical claim catalog (deduplicated claim statements). | `src/lib/pcs-canonical-claims.js` |
| `pcs_formula_lines` | `NOTION_PCS_FORMULA_LINES_DB` | Per-product ingredient lines. FK → pcs_documents + pcs_ingredients. | `src/lib/pcs-formula-lines.js` |
| `pcs_references` | `NOTION_PCS_REFERENCES_DB` | Cited reference materials. M:N with pcs_evidence. | `src/lib/pcs-references.js` |
| `pcs_schema_intake` | `NOTION_PCS_SCHEMA_INTAKE_DB` | Schema metadata / intake configuration. | `src/lib/pcs-schema-intake.js` (verify) |
| `pcs_wording_variants` | `NOTION_PCS_WORDING_VARIANTS_DB` | Alternative phrasings of canonical claims. FK → pcs_canonical_claims. | `src/lib/pcs-wording-variants.js` (verify) |

### Auxiliary tables (NOT in Notion — net-new)

| Table | Holds | Why net-new |
|---|---|---|
| `notion_id_map` | `(notion_page_id TEXT, supabase_id UUID, table_name TEXT)` | During dual-write phase, maps Notion page IDs to Supabase UUIDs so writes that come in with a Notion ID can target the right Supabase row. Drop after Phase N5. |
| `dual_write_log` | `(timestamp, action, notion_id, supabase_id, table_name, status, error)` | Observability during dual-write — catches divergence between Notion and Supabase. |

## Relationship graph (high-level)

```
reviewers ─┬─→ scores (M:N via reviewer_id)
           └─→ pcs_revision_events (actor)

intakes ─→ scores (1:M)

pcs_documents ─┬─→ pcs_versions (1:M)
               ├─→ pcs_requests (1:M)
               └─→ pcs_formula_lines (1:M)

pcs_versions ─┬─→ pcs_claims (1:M)
              └─→ pcs_documents (latest_version_id)  ← circular; resolve via deferred FK

pcs_claims ─┬─→ pcs_evidence_packets (1:M)
            └─→ pcs_canonical_claims (M:1, optional)

pcs_evidence_packets ─→ pcs_evidence (M:N via packet_evidence join table)

pcs_evidence ─→ pcs_references (M:N via evidence_references join table)

pcs_canonical_claims ─→ pcs_wording_variants (1:M)

pcs_revision_events ─→ (polymorphic: pcs_documents, pcs_versions, pcs_claims, pcs_evidence)
```

## Notion property-type → Postgres column-type mapping

Audit derived from `src/lib/pcs-documents.js` (fully read) + sampled patterns:

| Notion type | Postgres type | Notes |
|---|---|---|
| `title` (rich_text array) | `TEXT NOT NULL` | Always non-null per Notion semantics |
| `rich_text` | `TEXT NOT NULL DEFAULT ''` | Concatenate `.plain_text` from the array |
| `select` | `TEXT` (or enum if values are stable) | NULL if unset |
| `multi_select` | `TEXT[]` | Array of `.name` values |
| `date` (single) | `DATE` or `TIMESTAMPTZ` | Use TIMESTAMPTZ if time-of-day matters; DATE otherwise |
| `relation` (single) | `UUID REFERENCES other_table(id)` | FK with `ON DELETE SET NULL` typically |
| `relation` (multi) | M:N join table | Don't store as array — proper relational design |
| `checkbox` | `BOOLEAN NOT NULL DEFAULT FALSE` | |
| `number` | `NUMERIC` (or `INTEGER` if scale clear) | Notion is loose; PG should be tight |
| `created_time`, `last_edited_time` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | App also tracks these in audit |
| `formula` | (omit, recompute in PG view) | Don't store derived values |
| `rollup` | (omit, recompute in PG view) | Same |
| `files` | `TEXT[]` of URLs OR FK to a separate `files` table | Depends on whether file metadata matters |

## ID strategy

**Primary keys:** UUIDs (Postgres default `gen_random_uuid()`). Reasoning: distributed-system-friendly, no hot-spot on sequence, matches Supabase conventions.

**Notion ID preservation:** every table gets a `notion_page_id TEXT UNIQUE` column. Allows backfill matching + dual-write referencing. After Phase N5, this column can stay (audit) or be dropped (clean).

## RLS (Row-Level Security) sketch

Per `reference_supabase_allowances_pilot.md` security-first pattern:

- **`reviewers`**: SELECT for self only (`auth.uid() = id` once Supabase Auth is wired) OR ops-role bypass. INSERT only by ops-role (admin invite flow).
- **`intakes`, `scores`**: SELECT for any authenticated reviewer; INSERT/UPDATE only by the score's owning reviewer or ops-role.
- **`pcs_*`**: SELECT for ops-role only (PCS is internal Nordic-team-only data).
- **`notion_id_map`, `dual_write_log`**: ops-role only.

**Note:** Supabase Auth integration is OUT of scope for the migration's first pass — Nordic uses custom JWT (jose). RLS will use a custom `current_user_id()` SQL function that reads from a session-scoped setting set by the API on each request. This is a 1-day RLS bootstrap task in Phase N1.

## Open questions for Garrett

1. **Notion ID preservation post-N5:** keep `notion_page_id` columns forever (small cost, audit trail) OR drop them (cleaner schema)? Recommendation: keep for ~6 months post-cutover, drop in a later cleanup migration.

2. **Auth integration:** stick with custom JWT (jose) post-migration, OR move to Supabase Auth (uses Postgres `auth.users` schema)? Custom JWT is less work; Supabase Auth gets you native RLS + magic links + OAuth providers. Recommendation: stick with custom JWT for now — auth migration is a separate decision.

3. **PCS revision events polymorphic FK:** Postgres can't natively enforce polymorphic foreign keys. Options:
   - (a) Single `(entity_type TEXT, entity_id UUID)` columns with no FK — application enforces
   - (b) Separate revision-event tables per entity type (e.g. `pcs_document_revisions`, `pcs_claim_revisions`) — more tables, more constraints
   - (c) Single events table with NULLABLE FK columns per type — sparse rows, but enforced
   Recommendation: (a) — matches current Notion behavior; the audit trail doesn't need DB-level integrity.

4. **Backfill volume estimate:** how many rows per table? Affects Phase N2 effort + import script chunking. Need a one-shot count from Notion to know.

5. **Dual-write performance impact:** every API write becomes 2 round trips (Notion + Supabase). For routes that fire on every request (e.g. score updates during a review session), this could double latency. Recommendation: dual-write is BACKGROUND for non-blocking writes (audit, analytics), SYNCHRONOUS only for critical paths (sign-up, score submission).

## Next steps (after this design doc lands)

1. **Audit the remaining 12 PCS domain models** — read each `src/lib/pcs-*.js` to enumerate properties, types, relations. Updates this doc with concrete column lists per table.
2. **Draft Drizzle schema (`db/schema.ts`)** — full TypeScript schema definitions matching this doc.
3. **Generate initial SQL migration** via `drizzle-kit generate`. Commit.
4. **Provision Supabase project** (Garrett's vendor work — direct provisioning per `project_supabase_provision_direct.md` memory).
5. **Apply migration to Supabase** — verify schema lands cleanly.
6. Move to Phase N2 (backfill).

## Estimated remaining N1 effort

- Audit 12 PCS domain models + flesh out columns: ~6h (1 day)
- Draft Drizzle schema + migrations: ~6h (1 day)
- RLS policies + custom-JWT integration: ~4h
- Provision + apply: ~1h once Garrett provisions Supabase

**Total: ~2 days of focused work** to complete Phase N1 from this point.
