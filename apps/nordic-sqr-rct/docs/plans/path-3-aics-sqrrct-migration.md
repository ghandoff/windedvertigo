# Path 3 — AICS and SQR-RCT Postgres-Canonical Migration Plan

*Status: planning — not yet started*
*Author: Architecture review 2026-05-14*
*Target: replicate the Path 2 PCS pattern for the AICS (3 tables) and SQR-RCT (3 tables) subsystems*

---

## 1. Scope and Background

Path 2 migrated all 13 PCS Notion databases to Postgres-canonical with dual-write, drift-sync, and strong-consistency retry queue. Path 3 extends the same architecture to the remaining two subsystems that still read from Notion exclusively:

- **AICS** (Active Ingredient Claims Substantiation): 3 Notion DBs — Documents, Versions, Claims
- **SQR-RCT** (Systematic Quality Review): 3 Notion DBs — Reviewers, Intakes (studies), Scores

Both subsystems are different from PCS in one critical respect: their Postgres tables already exist (DDL was written in advance) but no application code populates them and no feature flags gate a Postgres read path. Path 3 activates these dormant tables.

---

## 2. Table Inventory

### 2.1 AICS Tables

| Postgres table | Notion DB env var | PCS_DB key | Source lib | API routes |
|---|---|---|---|---|
| `aics_documents` | `NOTION_AICS_DOCUMENTS_DB` | `PCS_DB.aicsDocuments` | `src/lib/pcs-aics.js` | `GET/POST /api/pcs/aics`, `GET/PATCH /api/pcs/aics/[id]` |
| `aics_versions` | `NOTION_AICS_VERSIONS_DB` | `PCS_DB.aicsVersions` | `src/lib/pcs-aics.js` | `GET /api/pcs/aics/[id]/claims` (resolves via versions) |
| `aics_claims` | `NOTION_AICS_CLAIMS_DB` | `PCS_DB.aicsClaims` | `src/lib/pcs-aics.js` | `GET /api/pcs/aics/[id]/claims`, `PATCH /api/pcs/aics/claims/[id]/regulatory` |

**Current write pattern**: Notion-only. `createAicsDocument` and `updateAicsDocument` write directly to Notion via `notion.pages.create/update`. `getAicsDocument`, `listAicsDocuments`, `getAicsVersionsForDocument`, `getAicsClaimsForVersion` read directly from Notion.

**Env var provisioning status**: `NOTION_AICS_DOCUMENTS_DB`, `NOTION_AICS_VERSIONS_DB`, `NOTION_AICS_CLAIMS_DB` are populated in `.env.local` (local dev) but are NOT yet populated as CF Workers secrets in wrangler.jsonc (see the comment: `"All NOTION_AICS_* database IDs (not yet populated — AICS features inactive)"`). Must be added to CF Workers secrets before any production work can be done.

### 2.2 SQR-RCT Tables

| Postgres table | Notion DB env var | JS module location | API routes (representative) |
|---|---|---|---|
| `reviewers` | `NOTION_REVIEWER_DB` | `src/lib/notion.js` | `GET/PATCH /api/admin/reviewers/[reviewerId]`, `GET /api/admin/reviewers`, `POST /api/auth/register` |
| `intakes` | `NOTION_INTAKE_DB` | `src/lib/notion.js` | `GET/POST /api/studies`, `GET /api/studies/[id]` |
| `scores` | `NOTION_SCORES_DB` | `src/lib/notion.js` | `GET/POST /api/scores`, `GET /api/sqr/export/[scoreId]` |

**Current write pattern**: Notion-only. All CRUD is in `src/lib/notion.js` — a monolithic file that handles all three SQR-RCT tables plus the shared Notion client. There are no per-table CRUD helper files matching the `pcs-*.js` pattern.

**Critical structural difference**: Unlike PCS, the SQR-RCT helpers are not yet decomposed into per-table files. The migration must first refactor `notion.js` before adding Postgres dual-write. See Phase 1 below.

**`sqr-sync.js` dependency**: `src/lib/sqr-sync.js` calls `getAllEvidenceEntries` from `src/lib/pcs.js` (the legacy thin Notion client, not `pcs-evidence.js`). After Path 3, this should be updated to call `getAllEvidence()` from `pcs-evidence.js`, which already gates on `shouldReadFromPostgres()`. This is a separate ticket but should be done before the SQR Phase B write-canonical flip.

---

## 3. Existing Postgres Schema Audit

The DDL for all six tables exists but has gaps vs the current `parsePage()` return shapes.

### 3.1 AICS schema — already largely correct

**`aics_documents`** (migration 003 + 005): all fields from `parseAicsDocumentPage` are present. No gaps.

**`aics_versions`** (migration 003 + 005): `claim_ids TEXT[]` and `latest_version_of_id TEXT` were added by migration 005. All fields present.

**`aics_claims`** (migration 003 + 005): `claim_id TEXT`, `life_stage TEXT[]`, `lifestyle_tags TEXT[]`, `substantiating_refs TEXT`, `regulatory_monographs TEXT`, `safety_limit NUMERIC`, `safety_limit_unit TEXT`, `safety_notes TEXT`, `claim_prefix_text TEXT` were added by migration 005. All fields present.

**AICS schema verdict: ready for backfill and dual-write. No new migration required for column gaps.**

### 3.2 SQR-RCT schema — has gaps

**`reviewers`** (migration 001): missing `email_confirmed_at TIMESTAMPTZ`. Field returned by `parseReviewerPage` as `emailConfirmedAt` and stamped by `/api/auth/confirm-email`. Also note: `status TEXT` is returned by the admin route's local `parseReviewerPage` but not by the main `parseReviewerPage` in `notion.js` and not in the 001 schema. The column map should drop it (it is only a UI filter on the admin page and not a first-class field in the main helper).

**`intakes`** (migration 001): missing these fields returned by `parseIntakePage`:
- `authors_conclusion TEXT NOT NULL DEFAULT ''` (JS: `authorsConclusion`, Notion: `Authors' Conclusion`)
- `strengths TEXT NOT NULL DEFAULT ''` (JS: `strengths`, Notion: `Strengths`)
- `limitations TEXT NOT NULL DEFAULT ''` (JS: `limitations`, Notion: `Limitations`)
- `potential_biases TEXT NOT NULL DEFAULT ''` (JS: `potentialBiases`, Notion: `Potential Biases`)
- `submitted_by_alias TEXT NOT NULL DEFAULT ''` (JS: `submittedByAlias`, Notion: `Submitted by Alias`)
- `pdf_url TEXT` (JS: `pdf`, needs column map override)

**`scores`** (migration 001): missing these fields returned by `parseScorePage`:
- `rubric_version TEXT NOT NULL DEFAULT ''` (JS: `rubricVersion`, Notion: `Rubric version`)
- `notes TEXT NOT NULL DEFAULT ''` (JS: `notes`, Notion: `Notes`)
- `scored_at TIMESTAMPTZ` (JS: `timestamp`, Notion: `Timestamp` — see section 4.2 for the reserved-word risk)
- `time_to_complete NUMERIC` (JS: `timeToComplete`, Notion: `Time to Complete (minutes)`)

**SQR-RCT schema verdict: requires a new migration (008) before backfill.**

---

## 4. Column Name Override Risks

The `notionShapeToPgRow` function in `supabase-pcs.js` uses the regex `k.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())` to mechanically convert camelCase JS keys to snake_case Postgres columns. This is correct for single-capital transitions but fails for consecutive uppercase sequences (the `studyDoseAI → study_dose_a_i` bug class).

### 4.1 AICS column map risks

| JS key (parsePage output) | Mechanical regex result | Correct Postgres column | Override needed? |
|---|---|---|---|
| `fdaDsheaDisclaimerRequired` | `fda_d_s_h_e_a_disclaimer_required` | `fda_dshea_disclaimer_required` | **YES** |
| `claimPrefix` | `claim_prefix` | `claim_prefix_text` | **YES** — schema stores as `claim_prefix_text` |
| `aicsId` | `aics_id` | `aics_id` | No |
| `aiName` | `ai_name` | `ai_name` | No |
| `isLatest` | `is_latest` | `is_latest` | No |
| `latestVersionOfId` | `latest_version_of_id` | `latest_version_of_id` | No |

**Required AICS column maps:**

```js
// AICS_DOCUMENTS_PG_COLUMN_MAP
const AICS_DOCUMENTS_PG_COLUMN_MAP = {};  // no overrides needed

// AICS_VERSIONS_PG_COLUMN_MAP
const AICS_VERSIONS_PG_COLUMN_MAP = {};   // no overrides needed

// AICS_CLAIMS_PG_COLUMN_MAP
const AICS_CLAIMS_PG_COLUMN_MAP = {
  fdaDsheaDisclaimerRequired: 'fda_dshea_disclaimer_required',
  claimPrefix: 'claim_prefix_text',
};
```

### 4.2 SQR-RCT column map risks

| JS key (parsePage output) | Mechanical regex result | Correct Postgres column | Override needed? |
|---|---|---|---|
| `timestamp` (scores) | `timestamp` | `scored_at` | **YES** — `timestamp` is a Postgres reserved word |
| `pdf` (intakes) | `pdf` | `pdf_url` | **YES** — matches `pcs_evidence` convention |

**Required SQR-RCT column maps:**

```js
const REVIEWERS_PG_COLUMN_MAP = {};              // no overrides
const INTAKES_PG_COLUMN_MAP   = { pdf: 'pdf_url' };
const SCORES_PG_COLUMN_MAP    = { timestamp: 'scored_at' };
```

---

## 5. New Source Files Required

### 5.1 AICS — one new helper file

**`src/lib/aics-documents.js`** (RENAME from `pcs-aics.js`)

Rename `pcs-aics.js` → `aics-documents.js`. Update the 4 API route files that import from it:
- `/api/pcs/aics/route.js`
- `/api/pcs/aics/[id]/route.js`
- `/api/pcs/aics/[id]/claims/route.js`
- `/api/pcs/aics/claims/[id]/regulatory/route.js`

Add to the renamed file:
- `AICS_DOCUMENTS_PG_COLUMN_MAP`, `AICS_VERSIONS_PG_COLUMN_MAP`, `AICS_CLAIMS_PG_COLUMN_MAP`
- `parsePostgresRow*` for each of the three tables
- `shouldReadFromAicsPostgres()` / `shouldWriteToAicsPostgresFirst()` flag gates (new env vars — see section 6)
- `syncRecentAicsDocumentsToPostgres(sinceIso)`, `syncRecentAicsVersionsToPostgres(sinceIso)`, `syncRecentAicsClaimsToPostgres(sinceIso)` for drift-sync
- `syncSingleAicsDocumentPageToPostgres(pageId)`, `syncSingleAicsVersionPageToPostgres(pageId)`, `syncSingleAicsClaimPageToPostgres(pageId)` for the webhook
- Postgres-path reads for `listAicsDocuments`, `getAicsDocument`, `getAicsVersionsForDocument`, `getAicsClaimsForVersion`
- Full dual-write in `createAicsDocument`, `updateAicsDocument`, `updateAicsClaimRegulatory`

Each `syncRecent*` function must guard at the top if the env var is missing:

```js
export async function syncRecentAicsDocumentsToPostgres(sinceIso) {
  if (!PCS_DB.aicsDocuments) return { count: 0, fetched: 0, maxSeen: sinceIso };
  // ...
}
```

### 5.2 SQR-RCT — four new helper files (extracted from notion.js)

**`src/lib/sqr-config.js`** (NEW)

```js
export const SQR_DB = {
  reviewers: process.env.NOTION_REVIEWER_DB,
  intakes:   process.env.NOTION_INTAKE_DB,
  scores:    process.env.NOTION_SCORES_DB,
};
export function shouldReadFromSqrPostgres() { ... }
export function shouldWriteToSqrPostgresFirst() { ... }
export function shouldUseSqrStrongConsistency() {
  return shouldUseStrongConsistency(); // reuse PCS_STRONG_CONSISTENCY
}
```

**`src/lib/sqr-reviewers.js`** (NEW — extract from `notion.js`)

Extract: `parseReviewerPage`, `getReviewerByAlias`, `getReviewerById`, `getAllReviewers`, `getAllReviewersAdmin`, `createReviewer`, `updateReviewerPassword`, `updateReviewerPasswordAndClearResetFlag`, `setReviewerPasswordResetRequired`, `updateReviewerProperties`, `updateReviewerProfile`, `getReviewerByEmail`, `updateReviewerEmail`.

Add: `REVIEWERS_PG_COLUMN_MAP`, `parsePostgresReviewerRow`, Postgres-path variants of all reads, dual-write in create/update functions, direct Supabase writes for auth functions (passwords never mirror to Notion).

**`src/lib/sqr-intakes.js`** (NEW — extract from `notion.js`)

Extract: `parseIntakePage`, `getAllStudies`, `getStudyById`, `createStudy`, `getStudyByDoi`, `getIntakesByReviewerAlias`, `getIntakeByReviewerAndDoi`, `updateStudyPdf`.

Add: `INTAKES_PG_COLUMN_MAP = { pdf: 'pdf_url' }`, `parsePostgresIntakeRow`, Postgres-path reads, dual-write in create/update.

**`src/lib/sqr-scores.js`** (NEW — extract from `notion.js`)

Extract: `parseScorePage`, `createScore`, `getScoreById`, `getScoresByReviewer`, `getAllScores`, `getScoresForStudy`.

Add: `SCORES_PG_COLUMN_MAP = { timestamp: 'scored_at' }`, `parsePostgresScoreRow`, Postgres-path reads, dual-write in `createScore`.

### 5.3 Files to modify

| File | Change |
|---|---|
| `src/lib/notion.js` | Remove extracted per-table functions. Retain: `notion` client, `withRetry`, `resolveDataSourceId`, `Client` re-export. |
| `src/lib/pcs-aics.js` | Rename → `aics-documents.js` |
| `src/app/api/cron/drift-sync/route.js` | Add 6 new table entries (see section 7) |
| `src/app/api/webhooks/notion/page-updated/route.js` | Add 6 new DB-to-sync mappings (see section 7.2) |
| `src/lib/sqr-sync.js` | Update `getAllEvidenceEntries` import from `pcs.js` → `getAllEvidence` from `pcs-evidence.js` (before Phase 5) |
| All API routes importing SQR functions from `notion.js` | Update imports to `sqr-reviewers.js`, `sqr-intakes.js`, `sqr-scores.js` |

---

## 6. Feature Flags

Four new CF Workers secrets, following the PCS pattern:

| Secret | Effect |
|---|---|
| `AICS_READ_FROM_POSTGRES` | `"1"` = AICS read helpers query Postgres |
| `AICS_WRITE_TO_POSTGRES` | `"1"` = AICS write helpers dual-write Postgres first |
| `SQR_READ_FROM_POSTGRES` | `"1"` = SQR helpers read from Postgres |
| `SQR_WRITE_TO_POSTGRES` | `"1"` = SQR write helpers dual-write Postgres first |

**Strong-consistency retry queue**: reuse `PCS_STRONG_CONSISTENCY` and `pcs_pending_writes` for both AICS and SQR. The table is table-agnostic (`pg_table TEXT NOT NULL`). No new flag or table needed.

Set via `wrangler secret put --name wv-nordic`.

---

## 7. Drift-Sync Cron Changes

### 7.1 `src/app/api/cron/drift-sync/route.js`

Add 6 imports and extend `tables` array from 13 to 19:

```js
import { syncRecentAicsDocumentsToPostgres } from '@/lib/aics-documents';
import { syncRecentAicsVersionsToPostgres }  from '@/lib/aics-documents';
import { syncRecentAicsClaimsToPostgres }    from '@/lib/aics-documents';
import { syncRecentReviewersToPostgres }     from '@/lib/sqr-reviewers';
import { syncRecentIntakesToPostgres }       from '@/lib/sqr-intakes';
import { syncRecentScoresToPostgres }        from '@/lib/sqr-scores';

const tables = [
  // ... existing 13 PCS entries ...
  { name: 'aics_documents', sync: syncRecentAicsDocumentsToPostgres },
  { name: 'aics_versions',  sync: syncRecentAicsVersionsToPostgres },
  { name: 'aics_claims',    sync: syncRecentAicsClaimsToPostgres },
  { name: 'reviewers',      sync: syncRecentReviewersToPostgres },
  { name: 'intakes',        sync: syncRecentIntakesToPostgres },
  { name: 'scores',         sync: syncRecentScoresToPostgres },
];
```

Update `TABLE_TO_NOTION_DB` to use resolver functions (avoids mixing `PCS_DB` and `SQR_DB` lookup):

```js
const TABLE_TO_NOTION_DB = {
  // existing 13 PCS entries as resolver fns ...
  pcs_evidence:   () => PCS_DB.evidenceLibrary,
  // ...
  aics_documents: () => PCS_DB.aicsDocuments,
  aics_versions:  () => PCS_DB.aicsVersions,
  aics_claims:    () => PCS_DB.aicsClaims,
  reviewers:      () => SQR_DB.reviewers,
  intakes:        () => SQR_DB.intakes,
  scores:         () => SQR_DB.scores,
};
// in processTable: const notionDbId = TABLE_TO_NOTION_DB[name]?.();
```

`Promise.allSettled` already handles 19 tables correctly. No structural change needed.

### 7.2 Webhook handler changes

Add 6 imports and extend `buildDbSyncMap()`:

```js
import { syncSingleAicsDocumentPageToPostgres } from '@/lib/aics-documents';
import { syncSingleAicsVersionPageToPostgres }  from '@/lib/aics-documents';
import { syncSingleAicsClaimPageToPostgres }    from '@/lib/aics-documents';
import { syncSingleReviewerPageToPostgres }     from '@/lib/sqr-reviewers';
import { syncSingleIntakePageToPostgres }       from '@/lib/sqr-intakes';
import { syncSingleScorePageToPostgres }        from '@/lib/sqr-scores';
import { SQR_DB }                               from '@/lib/sqr-config';

function buildDbSyncMap() {
  const raw = {
    // ... existing 13 PCS entries ...
    [PCS_DB.aicsDocuments]: syncSingleAicsDocumentPageToPostgres,
    [PCS_DB.aicsVersions]:  syncSingleAicsVersionPageToPostgres,
    [PCS_DB.aicsClaims]:    syncSingleAicsClaimPageToPostgres,
    [SQR_DB.reviewers]:     syncSingleReviewerPageToPostgres,
    [SQR_DB.intakes]:       syncSingleIntakePageToPostgres,
    [SQR_DB.scores]:        syncSingleScorePageToPostgres,
  };
  // Filter undefined keys (AICS env vars not yet provisioned in CF Workers)
  return Object.fromEntries(Object.entries(raw).filter(([k]) => k && k !== 'undefined'));
}
```

---

## 8. Supabase Migration Plan

Migration 008 is the only new migration required. Migrations 003 and 005 already cover all AICS column gaps.

### `supabase/migrations/20260514000001_008_sqr_schema_gaps.sql`

```sql
-- 008_sqr_schema_gaps.sql
-- 2026-05-14 — Path 3 pre-requisite.
-- Fills gaps between the 001 SQR-RCT schema and the current parsePage()
-- return shapes. ADDITIVE ONLY. All ADD COLUMN IF NOT EXISTS.

BEGIN;

-- reviewers: email confirmation marker
ALTER TABLE reviewers
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
COMMENT ON COLUMN reviewers.email_confirmed_at IS
  'Path 3 2026-05-14 — stamped by /api/auth/confirm-email.';

-- intakes: fields present in parseIntakePage() but missing from 001
ALTER TABLE intakes
  ADD COLUMN IF NOT EXISTS authors_conclusion  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS strengths           TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS limitations         TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS potential_biases    TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS submitted_by_alias  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pdf_url             TEXT;
CREATE INDEX IF NOT EXISTS intakes_submitted_by_alias_idx ON intakes (submitted_by_alias);

-- scores: fields present in parseScorePage() but missing from 001
ALTER TABLE scores
  ADD COLUMN IF NOT EXISTS rubric_version   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes            TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS scored_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS time_to_complete NUMERIC;
COMMENT ON COLUMN scores.scored_at IS
  'Path 3 2026-05-14 — Notion "Timestamp" date. "timestamp" is a Postgres reserved word; column map: { timestamp: "scored_at" }.';
CREATE INDEX IF NOT EXISTS scores_scored_at_idx ON scores (scored_at DESC);
CREATE INDEX IF NOT EXISTS scores_rater_alias_idx ON scores (rater_alias);

COMMIT;
```

---

## 9. Retry Queue

**No new table or schema changes needed.** `pcs_pending_writes` is fully reusable — `pg_table TEXT NOT NULL` accepts any table name. The retry cron already calls `mirrorToPostgres(row.pg_table, parsedRow, columnMap)` generically. The correct column map must be included in `payload.columnMap` at enqueue time — this happens automatically via `enqueuePendingWrite` called from `mirrorToPostgres` with `enqueueOnFailure: true`.

---

## 10. Backfill Strategy

### 10.1 `scripts/backfill-aics-to-supabase.mjs`

Modeled on `scripts/backfill-pcs-to-supabase.mjs`. Run order: `aics_documents` → `aics_versions` → `aics_claims` (parent before child). Upsert on `notion_page_id` conflict — fully idempotent.

### 10.2 `scripts/backfill-sqr-to-supabase.mjs`

Run order: `reviewers` → `intakes` → `scores`.

**Critical safety note for `reviewers`**: `parseReviewerPage` never returns a `password` or `passwordHash` key, so `notionShapeToPgRow` will never include `password_hash` in the upsert payload. The `ON CONFLICT DO UPDATE` will not touch the bcrypt hash column. This is safe by construction — verify during code review.

**`scores` column map**: ensure `SCORES_PG_COLUMN_MAP = { timestamp: 'scored_at' }` is applied in the backfill script (call `notionShapeToPgRow(parsed, SCORES_PG_COLUMN_MAP)`).

---

## 11. Phasing and Rollout Order

### Phase 1 — Schema, Env Vars, and Code Refactor (no behavior change)

- [ ] Run migration 008 against the `wv-nordic` Supabase project
- [ ] Add `NOTION_AICS_DOCUMENTS_DB`, `NOTION_AICS_VERSIONS_DB`, `NOTION_AICS_CLAIMS_DB` as CF Workers secrets
- [ ] Rename `src/lib/pcs-aics.js` → `src/lib/aics-documents.js`; update 4 API route imports
- [ ] Create `src/lib/sqr-config.js` with `SQR_DB` and flag functions
- [ ] Create `src/lib/sqr-reviewers.js` (extract + stub Postgres read path, flags OFF)
- [ ] Create `src/lib/sqr-intakes.js` (extract + stub Postgres read path, flags OFF)
- [ ] Create `src/lib/sqr-scores.js` (extract + stub Postgres read path, flags OFF)
- [ ] Slim `src/lib/notion.js` (remove extracted functions)
- [ ] Update all API route imports from `notion.js` → new `sqr-*.js` modules
- [ ] Update drift-sync (19 tables, resolver function, env-var guards)
- [ ] Update webhook handler (19 mappings, nullish-key filter)
- [ ] Deploy — **no feature flags changed, behavior identical to before**
- [ ] Regression-test all existing API routes

### Phase 2 — AICS Backfill and Read-Path Activation

- [ ] Add `parsePostgresRow*` and Postgres-path reads to `aics-documents.js`
- [ ] Run `scripts/backfill-aics-to-supabase.mjs`
- [ ] Verify row counts match Notion
- [ ] Set `AICS_READ_FROM_POSTGRES=1`
- [ ] Smoke test all AICS API routes

### Phase 3 — SQR-RCT Backfill and Read-Path Activation

- [ ] Add `parsePostgresRow` and Postgres-path reads to all three `sqr-*.js` files
- [ ] Run `scripts/backfill-sqr-to-supabase.mjs`
- [ ] Verify row counts: reviewers, intakes, scores
- [ ] Set `SQR_READ_FROM_POSTGRES=1`
- [ ] Smoke test: `/api/studies`, `/api/scores`, `/api/admin/reviewers`, login flow, score submission, `/api/sqr/export/[scoreId]`

### Phase 4 — AICS Dual-Write

- [ ] Add `shouldWriteToAicsPostgresFirst()` gates and `writePostgresFirst` calls to `createAicsDocument`, `updateAicsDocument`, `updateAicsClaimRegulatory`
- [ ] Set `AICS_WRITE_TO_POSTGRES=1`
- [ ] Smoke test create/edit AICS document
- [ ] Verify `pcs_pending_writes` for any enqueued AICS rows

### Phase 5 — SQR-RCT Dual-Write

- [ ] Add `shouldWriteToSqrPostgresFirst()` gates to `createScore`, `createStudy`, `createReviewer`, `updateReviewerProfile`, `updateReviewerEmail`, `updateReviewerProperties`
- [ ] Auth write functions (`updateReviewerPassword`, etc.) write Postgres directly — no Notion mirror (passwords are not stored in Notion)
- [ ] Update `sqr-sync.js`: `getAllEvidenceEntries` from `pcs.js` → `getAllEvidence` from `pcs-evidence.js`
- [ ] Set `SQR_WRITE_TO_POSTGRES=1`
- [ ] Smoke test: submit score, create study, update reviewer profile

---

## 12. Critical Implementation Notes

### 12.1 Shared Supabase client

`getPcsSupabase()` from `supabase-pcs.js` reads `SUPABASE_NORDIC_URL` + `SUPABASE_NORDIC_SECRET_KEY`. AICS and SQR tables live in the same `wv-nordic` project. All new helpers import from `supabase-pcs.js` — no new client file needed.

### 12.2 `notion.js` must retain the Notion client exports

After extracting per-table functions, `notion.js` must keep: `notion` (wrapped client), `withRetry`, `resolveDataSourceId`, `Client` re-export. These are imported by `aics-documents.js`, `pcs.js`, `sqr-sync.js`, and others.

### 12.3 AICS env vars must be in CF Workers before going live

```bash
wrangler secret put NOTION_AICS_DOCUMENTS_DB --name wv-nordic
wrangler secret put NOTION_AICS_VERSIONS_DB  --name wv-nordic
wrangler secret put NOTION_AICS_CLAIMS_DB    --name wv-nordic
```

Add to the secrets inventory comment in `wrangler.jsonc`.

### 12.4 `pcs_aics_references` junction table (deferred)

Migration 003 created `pcs_aics_references (pcs_document_id, aics_document_id)`. Not currently written by application code. The `pcs_documents.linked_aics_ids TEXT[]` column mirrors this relation as an array. Populating the junction table as a proper FK relation is deferred to Phase N1.5 normalization — out of scope for Path 3.

### 12.5 Admin reviewer route's local `parseReviewerPage`

`src/app/api/admin/reviewers/route.js` has an inline `parseReviewerPage` that returns a `status` field not in the main version. When switching the read path, include `status` logic in `sqr-reviewers.js` or keep the admin route's inline version until Phase 3 is stable.

### 12.6 `sqr/export/[scoreId]` cross-subsystem dependency

Calls `getScoreById` (→ `sqr-scores.js`), `getStudyById` (→ `sqr-intakes.js`), and `getAllEvidence` (→ `pcs-evidence.js`, already Postgres-gated). After Phase 3, fully Postgres-backed. No changes to the route file itself beyond updating imports.

### 12.7 `sqr-sync.js` reads from `pcs.js` (legacy — latent risk)

`src/lib/sqr-sync.js` imports `getAllEvidenceEntries` and `updateEvidenceEntry` from `./pcs.js` — the legacy Notion client. Under Phase B (PCS write-to-Postgres active), `updateEvidenceEntry` in `pcs.js` writes directly to Notion without dual-write, so Postgres may be stale for up to 2 minutes after a score submission triggers auto-sync.

Fix **before Phase 5**: update `sqr-sync.js` to import `getAllEvidence` and `updateEvidence` from `./pcs-evidence.js`. Function signatures are compatible.

---

## 13. Data Flow After Path 3

### AICS write path (Phase 4 active):

```
User action → PATCH /api/pcs/aics/[id]
    │
    ├── aics-documents.js: shouldWriteToAicsPostgresFirst() → true
    ├── writePostgresFirst('aics_documents', row, AICS_DOCUMENTS_PG_COLUMN_MAP, notionFn)
    │     ├── mirrorToPostgres → upsert to aics_documents (canonical)
    │     └── notionFn() async → notion.pages.update (mirror, best-effort)
    │           └── on failure → enqueuePendingWrite → pcs_pending_writes
    └── return row to caller
```

### SQR-RCT score submission (Phase 5 active):

```
POST /api/scores
    │
    ├── sqr-scores.js createScore(): shouldWriteToSqrPostgresFirst() → true
    ├── writePostgresFirst('scores', stub, SCORES_PG_COLUMN_MAP, notionFn)
    │     ├── INSERT into scores (canonical)
    │     └── notion.pages.create async (mirror)
    │           └── back-patch notion_page_id on success
    └── if PCS_AUTO_SYNC: sqr-sync.js → pcs-evidence.js (Postgres-backed)
```

### Drift-sync (19 tables):

```
Cron trigger (*/2 * * * *)
    │
    └── Promise.allSettled([
          ...13 PCS tables...,
          aics_documents, aics_versions, aics_claims,  ← guarded on env var
          reviewers, intakes, scores
        ])
        each: watermark → Notion query → mirrorToPostgres upsert → drift count
```

---

## 14. Notion Webhook Registration

After Phase 1 (env vars provisioned), register 6 new webhook subscriptions using the runbook at `docs/runbooks/notion-webhooks.md`.

Priority order:
1. `NOTION_AICS_DOCUMENTS_DB` (Phase 2)
2. `NOTION_AICS_CLAIMS_DB` (Phase 2)
3. `NOTION_SCORES_DB` (Phase 3 — highest edit frequency)
4. `NOTION_INTAKE_DB` (Phase 3)
5. `NOTION_REVIEWER_DB` (Phase 3 — lowest edit frequency)
6. `NOTION_AICS_VERSIONS_DB` (Phase 2 — rarely edited directly)

---

## 15. Summary Checklist

| Task | Phase | Risk |
|---|---|---|
| Run migration 008 (SQR schema gaps) | 1 | Low — additive only |
| Add `NOTION_AICS_*` to CF Workers secrets | 1 | None |
| Rename `pcs-aics.js` → `aics-documents.js` + update 4 route imports | 1 | Low |
| Create `sqr-config.js`, `sqr-reviewers.js`, `sqr-intakes.js`, `sqr-scores.js` | 1 | Medium — touches core auth path |
| Slim `notion.js` | 1 | Medium — broad import surface |
| Update drift-sync (19 tables, resolver fn, env-var guards) | 1 | Low |
| Update webhook handler (19 mappings, nullish-key filter) | 1 | Low |
| AICS backfill script | 2 | Low — idempotent upsert |
| Set `AICS_READ_FROM_POSTGRES=1` | 2 | Low — Notion fallback on error |
| SQR backfill script (reviewers `password_hash` safety) | 3 | Medium — auth table |
| Set `SQR_READ_FROM_POSTGRES=1` | 3 | Medium — auth + score submission on hot path |
| Fix `sqr-sync.js` `pcs.js` → `pcs-evidence.js` | before Phase 5 | Low |
| Set `AICS_WRITE_TO_POSTGRES=1` | 4 | Low — small table, low write freq |
| Set `SQR_WRITE_TO_POSTGRES=1` | 5 | High — login and score submission critical path |
| Register 6 new Notion webhooks | after each phase | None |

---

*Key reference files: `src/lib/pcs-aics.js`, `src/lib/notion.js`, `src/lib/pcs-config.js`, `src/lib/supabase-pcs.js`, `src/app/api/cron/drift-sync/route.js`, `supabase/migrations/20260503104000_003_aics_entity_ddl.sql`, `supabase/migrations/20260506000001_005_post_may3_field_additions.sql`, `supabase/migrations/20260501221100_001_initial_schema.sql`.*
