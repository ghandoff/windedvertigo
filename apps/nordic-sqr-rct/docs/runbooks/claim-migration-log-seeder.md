# claim_migration_log Seeder — Operator Runbook

> **Status as of 2026-05-03:** the `claim_migration_log` table exists in Supabase (created by migration 004), but it is **empty**. Bundle B (Backfill Review queue) live-derives proposals from Notion at request time instead of reading from this table. The seeder script below is the bridge for Bundle C (LLM-assisted classifier) when it ships.

---

## Why this table exists

The 4-tier claim vocabulary backfill emits ~376 proposals (124 high-confidence to apply, 252 low-confidence + unmatchable for human review). Each proposal is a row of:

- which PCS Claim is being classified
- what the regex heuristic proposed for canonical / prefix / benefit / variants
- a confidence score (0.0–1.0)
- the classifier method (`regex-heuristic-v1`, `llm-claude-v1`, `lauren-manual`, `feedback-correction`)
- whether the proposal was applied to Notion + audit fields

This is the labeled-training-data foundation for Bundle C: once Lauren approves ~50 proposals through the Review queue UI, the LLM strategy in `src/lib/llm-adapter.js` can use them as few-shot examples to classify the remaining unmatchables.

---

## Pre-requisites

This seeder needs Supabase credentials that aren't currently in production env. To unblock:

1. Add to Vercel env (production + preview + development):
   ```
   SUPABASE_NORDIC_URL              = https://nzdfpfrnilreqzmthpui.supabase.co
   SUPABASE_NORDIC_SERVICE_KEY      = (from Supabase project settings → API → service_role secret)
   ```
   ⚠️ The `service_role` key bypasses RLS. Per the Data Security T&C v2 §5.2, this key is bound only to server-side handlers and seeder scripts — never copied into client bundles or LLM tools.

2. Re-pull env to local:
   ```bash
   cd apps/nordic-sqr-rct
   vercel env pull .env.local --environment=production --yes
   ```

3. Confirm migration 004 was applied to the wv-nordic Supabase. Verify with:
   ```bash
   supabase db query --linked "SELECT count(*) FROM claim_migration_log;"
   ```
   Expected: `0` rows (table exists, currently empty).

---

## Running the seeder

```bash
cd apps/nordic-sqr-rct

# Dry-run — shows the proposal count + confidence breakdown without writing
node scripts/seed-claim-migration-log.mjs

# Write rows
node scripts/seed-claim-migration-log.mjs --apply

# Truncate + re-seed (e.g., after corpus changes substantially)
node scripts/seed-claim-migration-log.mjs --apply --reset
```

Idempotent: re-running with `--apply` won't duplicate rows, but does NOT update existing rows whose `notion_page_id + classification_method` already match. Use `--reset` to start fresh.

---

## What each row looks like after seeding

| Column | Example |
|---|---|
| `id` | `b1234567-89ab-cdef-…` (UUID) |
| `notion_page_id` | `319e4ee7-4ba4-815f-aa40-c3737fc72dea` (the PCS Claim) |
| `source_database` | `pcs_claims` |
| `before_text` | `"Required for/Plays a critical role in/Supports cellular energy production*"` |
| `after_category` | `f8aaa39f-…` (Core Benefit row ID) |
| `after_strength` | `7ed1891c-…` (Claim Prefix row ID) |
| `after_family_key` | `f6e58750-…` (Canonical Claim row ID) |
| `after_variants` | `[{"wording":"Required for cellular energy production","isPrimary":true}, …]` |
| `classification_method` | `regex-heuristic-v1` |
| `classifier_confidence` | `0.91` |
| `applied` | `true` (if confidence ≥ 0.99 and approved) or `false` |
| `applied_at` | `2026-05-03T18:00:00Z` |
| `applied_by_email` | `lauren@nordicnaturals.com` (or `system:phase-4.6-backfill`) |

---

## How Bundle C uses it

When Bundle C ships, the LLM strategy (`extract('canonical-claim-mapping', 'claude', …)`) reads:

- the 50 most-recent rows where `applied=true AND classification_method='regex-heuristic-v1'`
- as few-shot training examples
- to classify the remaining `applied=false AND after_family_key IS NULL` rows (the 252 unmatchables)

The output is a *new* `claim_migration_log` row with `classification_method='llm-claude-v1'` and a fresh confidence score. Lauren reviews the LLM's proposals through the same Review queue UI and approves or flags via the feedback button.

The table is therefore both the audit log AND the training data store. Don't delete rows; archive them via a `status='archived'` column add (future migration) if needed.

---

## Failure modes

### `service_role` key rejected

You're using the `anon` key. The seeder needs `service_role` to bypass RLS. Verify the env var name is `SUPABASE_NORDIC_SERVICE_KEY` (not `SUPABASE_NORDIC_ANON_KEY`).

### Insert fails with `null value in column "before_text"`

The PCS Claim has an empty title. The seeder skips rows where `title` is empty by design (line ~205 of the script). If you see this error, the script wasn't updated; check `git log scripts/seed-claim-migration-log.mjs`.

### Notion fetches return empty arrays

The `windedvertigo.com` integration may not be shared with the Canonical Claims / Claim Prefixes / Core Benefits databases. Share via Notion: `… → Connections → Add connections → windedvertigo.com`.

---

## Related

- `scripts/seed-claim-migration-log.mjs` — the seeder
- `scripts/backfill-claim-vocab-tiers.mjs` — the underlying matcher (also live-derived in Bundle B's API)
- `src/lib/canonical-claim-matcher.js` — runtime version of the matcher
- `db/migrations/004_claim_vocab_tiers.sql` — schema
- `docs/reviews/claim-vocab-redundancy-2026-05-03.md` — analysis that motivated Phase 4.6
- `docs/runbooks/phase-4.6-claim-mapping-review.md` — operator guide for Lauren's review queue
