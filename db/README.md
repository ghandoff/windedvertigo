# Nordic SQR-RCT — Postgres / Supabase migration

Phase N1 of the Notion → Supabase migration per the macro plan at
`~/.claude/plans/just-ran-into-an-refactored-spark.md`.

## Layout

```
db/
├── README.md            (this file)
├── schema-design.md     Phase N1 design doc — 15 tables, relationship graph,
│                        Notion-to-PG type mapping, RLS sketch, open questions
└── migrations/
    └── 001_initial_schema.sql   Initial schema — 15 tables + 2 auxiliary
                                 (notion_id_map, dual_write_log) + triggers
```

## Apply locally (against a freshly-provisioned Supabase project)

```bash
# 1. Garrett provisions a new Supabase project at https://supabase.com (direct,
#    not via Vercel Marketplace — see project_supabase_provision_direct.md memory).
# 2. Get POSTGRES_URL_NON_POOLING from project settings.
# 3. Apply:
psql "$POSTGRES_URL_NON_POOLING" < db/migrations/001_initial_schema.sql

# 4. Verify:
psql "$POSTGRES_URL_NON_POOLING" -c "\dt"
# Should show 16 tables (14 domain + 2 auxiliary).
```

## What's intentionally simple in this first migration

- **Multi-relations stored as `TEXT[]` of notion_page_ids** — denormalized.
  Phase N1.5 normalizes the highest-traffic edges into proper M:N join tables
  once dual-write is proven.
- **Single relations stored as `TEXT` (notion_page_id), not UUID FK** — same
  rationale. Backfill + dual-write can match on Notion ID; FK swap happens
  in N1.5 after we know which references are stable.
- **No RLS yet** — placeholder commented in the migration. Phase N1.5 wires
  RLS once the API integrates a session-scoped `current_user_id()` SQL
  function (since Nordic uses custom JWT, not Supabase Auth).

## What's still open

Five architectural questions in `schema-design.md`. Garrett's call before
we finalize Phase N2 (backfill) work.

## Next phase

After Garrett provisions Supabase + this migration applies cleanly:
- Phase N2: write `scripts/backfill-from-notion.js` — one-shot import of
  the existing 15 Notion DBs into these tables. Idempotent (matches on
  notion_page_id).
- Phase N3: extend nordic API write paths with dual-write hooks.

## Phase N1.5 — DDL-only slice (shipped 2026-04-30)

`db/migrations/002_normalize_relations_ddl.sql` lays the architectural
seam for normalized relations + RLS. **Additive only** — no data is read
or written, no application code touches these new structures yet.

### What this migration does

- **Creates 4 empty M:N join tables**:
  - `score_reviewers` (scores ↔ reviewers)
  - `version_claims` (pcs_versions ↔ pcs_claims)
  - `packet_evidence` (pcs_evidence_packets ↔ pcs_evidence)
  - `evidence_references` (pcs_evidence ↔ pcs_references)
  Each has a composite PK and a reverse-lookup index on the second column.
- **Adds 4 nullable UUID FK columns** alongside the existing TEXT
  notion_page_id columns — both coexist until N5 cutover:
  - `pcs_versions.pcs_document_id_fk → pcs_documents(id)`
  - `pcs_claims.pcs_version_id_fk → pcs_versions(id)`
  - `pcs_evidence_packets.pcs_claim_id_fk → pcs_claims(id)`
  - `pcs_references.pcs_version_id_fk → pcs_versions(id)`
  All use `ON DELETE SET NULL` so partial backfill cannot cascade-destroy.
- **Adds `reviewers.is_ops BOOLEAN NOT NULL DEFAULT FALSE`** — Phase N2
  backfills this from a Notion query distinguishing ops vs research
  reviewers.
- **Creates `current_user_id()`** — a `STABLE` SQL function that reads
  the `app.current_user_id` Postgres GUC and returns it as UUID, or NULL
  if unset. Future RLS policies will treat NULL as deny-all.

### Migration ordering rule

**DDL → backfill → enable RLS, never out of order.** Phase N1.5 ships
DDL only. Phase N2 backfills the new columns/tables. RLS policies are
written and enabled in a later phase, only after backfill is verified —
flipping RLS on before backfill would lock the app out of its own data.

### State after applying

- All new FK columns are NULL on every existing row.
- All new join tables are empty (0 rows).
- `current_user_id()` exists but no RLS policy references it yet.
- No existing column or constraint is altered. Old TEXT/TEXT[] columns
  remain authoritative until Phase N5 cutover.

### Apply

```bash
psql "$POSTGRES_URL_NON_POOLING" < db/migrations/002_normalize_relations_ddl.sql
```

### Verify

```bash
psql "$POSTGRES_URL_NON_POOLING" -c "\dt"
# Expect 21 tables now (15 domain + 2 aux + 4 new join tables).
psql "$POSTGRES_URL_NON_POOLING" -c "\df current_user_id"
# Expect one row, returning uuid, language sql, volatility stable.
psql "$POSTGRES_URL_NON_POOLING" -c "\d+ reviewers"
# Expect new is_ops boolean column with default false.
```
