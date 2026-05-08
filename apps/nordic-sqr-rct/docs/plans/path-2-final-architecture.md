# Path 2 — Final Architecture
*Status: complete as of 2026-05-07*

## What changed

Path 2 was a full-stack architectural pivot away from Notion-as-database to Postgres-canonical with Cloudflare Workers as the compute layer. It ran across four phases over ~two weeks and is now complete.

| Layer | Before (≤ 2026-05-06) | After (2026-05-07+) |
|---|---|---|
| Canonical database | Notion DBs (13 PCS tables) | Supabase Postgres (`wv-nordic`, `pcs.*` schema) |
| Secondary copy | — | Notion (team's editing UI, kept in sync) |
| Read path | Notion API paginated reads (1.5–10 s cold) | Postgres queries via Supabase JS SDK (< 50 ms) |
| Write path | `notion.pages.create/update` direct | Dual-write: Postgres (primary) + Notion mirror (async) |
| Consistency model | Notion-canonical | Phase A: eventual (Notion → Postgres watermark sync) → Phase B: strong (Postgres-canonical + retry queue) |
| Compute host | Vercel Fluid Compute (`iad1`) | Cloudflare Workers (global edge) |
| File storage | Vercel Blob (`evidence-pdfs/*`) | Cloudflare R2 (`nordic-pcs` bucket) |
| Cron scheduler | Vercel Cron | CF Workers Scheduled Triggers (`wrangler.jsonc`) |
| Custom domain | `nordic.windedvertigo.com` → Vercel alias | `nordic.windedvertigo.com` → CF Workers custom domain |

## Runtime topology (post-cutover)

```
Browser
  │
  ▼
Cloudflare Workers   ── wv-nordic (wrangler.jsonc)
  │   ├── Next.js App Router (via OpenNext adapter)
  │   ├── /api/** routes
  │   ├── Scheduled triggers (6 crons — see below)
  │   └── R2 binding: NORDIC_ASSETS → nordic-pcs bucket
  │
  ├── Supabase Postgres (wv-nordic project)
  │     └── pcs.* schema (13 mirrored tables + junctions)
  │
  └── Notion API (read for webhook-triggered syncs; write for mirror)
```

## Scheduled triggers (CF Workers)

All crons run exclusively in CF Workers. The `vercel.json` `crons` array was removed on 2026-05-07 to prevent double-execution.

| Schedule | Handler | Purpose |
|---|---|---|
| `*/2 * * * *` | `process-imports` + `drift-sync` | Pull Notion direct-edits into Postgres; process import queue |
| `*/3 * * * *` | `retry-pending-writes` | Phase B strong-consistency retry queue |
| `*/5 * * * *` | `process-label-imports` | Label import pipeline |
| `0 8 * * *` | `sweep-label-drift` | Daily label drift sweep |
| `0 7 * * *` | `nightly-reping` | Nightly Slack re-pings for open requests |
| `0 16 * * 1` | `weekly-digest` | Monday weekly digest |

## Postgres schema (`pcs.*`)

13 mirrored tables, each with `notion_page_id` for round-trip reconciliation, `notion_last_edited_at` as the sync watermark, and `created_at`/`updated_at`/`synced_at` audit columns.

| Postgres table | Notion DB env var | PCS_DB key |
|---|---|---|
| `pcs_evidence` | `NOTION_PCS_EVIDENCE_DB` | `evidenceLibrary` |
| `pcs_claims` | `NOTION_PCS_CLAIMS_DB` | `claims` |
| `pcs_documents` | `NOTION_PCS_DOCUMENTS_DB` | `documents` |
| `pcs_evidence_packets` | `NOTION_PCS_EVIDENCE_PACKETS_DB` | `evidencePackets` |
| `pcs_canonical_claims` | `NOTION_PCS_CANONICAL_CLAIMS_DB` | `canonicalClaims` |
| `pcs_ingredients` | `NOTION_PCS_INGREDIENTS_DB` | `ingredients` |
| `pcs_core_benefits` | `NOTION_PCS_CORE_BENEFITS_DB` | `coreBenefits` |
| `pcs_versions` | `NOTION_PCS_VERSIONS_DB` | `versions` |
| `pcs_revision_events` | `NOTION_PCS_REVISION_EVENTS_DB` | `revisionEvents` |
| `pcs_requests` | `NOTION_PCS_REQUESTS_DB` | `requests` |
| `pcs_references` | `NOTION_PCS_REFERENCES_DB` | `references` |
| `pcs_wording_variants` | `NOTION_PCS_WORDING_VARIANTS_DB` | `wordingVariants` |
| `pcs_formula_lines` | `NOTION_PCS_FORMULA_LINES_DB` | `formulaLines` |

Read path: `PCS_READ_FROM_POSTGRES=1` (active) — all `getAll*` / `get*` helpers query Postgres via `@supabase/supabase-js`.

Write path: `PCS_WRITE_TO_POSTGRES=1` (active) — all `create*` / `update*` helpers dual-write to Postgres first, then Notion. `PCS_STRONG_CONSISTENCY=1` (active) — failures are queued for retry via `retry-pending-writes`.

## Sync architecture

```
Team edits Notion directly
    │
    ├── Notion webhook → POST /api/webhooks/notion/page-updated
    │       └── Immediate Postgres upsert for that page
    │
    └── drift-sync cron (every 2 min, parallel Promise.allSettled)
            └── For each of 13 tables:
                  1. Read MAX(notion_last_edited_at) from Postgres
                  2. Subtract 5-min overlap window
                  3. Query Notion for pages edited since that watermark
                  4. Upsert into Postgres
                  5. Count-compare Postgres vs Notion (drift detection)
                  6. Rate-limited Slack alert if |pg - notion| > 5
```

Platform writes (from our UI):
```
User action in platform
    │
    ├── Write to Postgres (primary, returns success/failure to user)
    └── Mirror to Notion (best-effort async, queued for retry on failure)
```

## R2 file storage

All file storage moved from Vercel Blob to Cloudflare R2 on 2026-05-07.

- **Bucket**: `nordic-pcs` (binding: `NORDIC_ASSETS`)
- **Prefix layout**:
  - `evidence-pdfs/` — PDF attachments for Evidence rows
  - `pcs-imports/` — CSV/XLSX import staging files
  - `label-imports/` — Label import files
  - `profiles/` — User profile images
- **Serve route**: `GET /api/r2/[...key]`
  - `evidence-pdfs/*` requires `pcs.evidence:read` capability
  - `pcs-imports/*`, `label-imports/*`, `profiles/*` are public

Old Vercel Blob URLs (`*.public.blob.vercel-storage.com/evidence-pdfs/*`) are forwarded via the same R2 proxy route using the blob URL → R2 key mapping established during migration.

## Vercel project status

The Vercel project (`nordic-sqr-rct`) is **dormant** as of 2026-05-07:
- Custom domain redirected to CF Workers
- `vercel.json` `crons` array removed (no scheduled function execution)
- Deployments still trigger on `main` push (Turbo ignore command minimises rebuild cost)
- Safe to delete from Vercel dashboard once 48h+ monitoring window confirms stability

## Feature flags (CF Workers secrets)

| Secret | Value | Effect |
|---|---|---|
| `PCS_READ_FROM_POSTGRES` | `"1"` | All read helpers query Postgres |
| `PCS_WRITE_TO_POSTGRES` | `"1"` | All write helpers dual-write to Postgres |
| `PCS_STRONG_CONSISTENCY` | `"1"` | Failed Notion mirrors are queued for retry |

Set via `wrangler secret put --name wv-nordic`.

## Key source files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | CF Workers config: routes, triggers, R2 bindings, secrets inventory |
| `src/lib/pcs-config.js` | PCS_DB env var map + domain constants |
| `src/lib/supabase-pcs.js` | Supabase client singleton for PCS Postgres |
| `src/lib/pcs-*.js` (13 files) | Per-table CRUD helpers with dual-write logic |
| `src/app/api/cron/drift-sync/route.js` | Drift-catcher cron (parallelized, Slack alerts) |
| `src/app/api/webhooks/notion/page-updated/route.js` | Notion webhook receiver |
| `src/app/api/r2/[...key]/route.js` | R2 file serve proxy |
| `docs/runbooks/notion-webhooks.md` | Notion webhook registration + smoke test |
| `supabase/migrations/20260506_pcs_initial.sql` | Initial Postgres schema |
| `scripts/backfill-pcs-to-supabase.mjs` | Initial full-table backfill script |

## What is NOT in scope for Path 2

- **AICS schema migration** — AICS tables still read from Notion. Will follow PCS pattern once PCS is proven stable.
- **SQR-RCT helper migration** — same.
- **Notion UI decommission** — Notion remains the team's editing surface indefinitely. Only its role as the primary database changed.
- **Capability / auth model changes** — `requireCapability` pattern unchanged.
