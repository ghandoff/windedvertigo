# nordic-sqr-rct — claude code conventions

> auto-loaded by Claude Code when working in `apps/nordic-sqr-rct/`.
> companion handoff log: `.brain/handoff.md` at the monorepo root.
> active tasks: `.brain/TASKS.md` at the monorepo root.

## what this app is

Nordic Research Platform — Next.js 15 (App Router, JS) frontend to a Notion + Supabase Postgres backed evidence + claims system used by the Nordic / PRME research team (Sharon, Gina, Adin, Lauren + 2 RA TBD). Lives at `nordic.windedvertigo.com`. Runs on **Cloudflare Workers via OpenNext** (`wv-nordic` worker) — migrated from Vercel in the F.5 cutover, 2026-05-11.

Deploy: **auto via GitHub Action** on push to main (`.github/workflows/deploy-nordic.yml`). Manual trigger also available via GitHub Actions UI. Storage: PDFs go to R2 bucket `nordic-pcs`, not Vercel Blob. Crons (6 triggers) and routes are defined in `wrangler.jsonc`.

## directory shape

```
src/
  app/
    pcs/                  ← PCS team-facing pages (evidence, claims, ingredients, documents, canonical-claims)
    api/pcs/              ← Notion-backed REST routes; one folder per resource
    api/pcs/evidence/
      save-from-search/   ← POST: chains article-search → 7-tier PDF waterfall → Vercel Blob → createEvidence
      [id]/pdf-upload/    ← POST multipart: manual PDF upload for paywalled / EndNote-only / scanned rows
  lib/
    pmc.js                ← 7-tier PDF retrieval waterfall (see "article import chain" below)
    article-search/       ← PubMed + Semantic Scholar search adapters
    notion.js             ← Notion client + page CRUD helpers
    pcs-*.js              ← per-resource Notion query helpers
  components/pcs/         ← PcsTable, evidence detail page parts, search panel
scripts/                  ← one-shot ops scripts (e.g. archive-test-evidence-rows.mjs)
```

## article import chain (discovery → retrieval → save)

Single most important flow on the app. Lives end-to-end now after Wave 7.0.5.

1. **Discovery** — `/pcs/evidence` search panel → `src/lib/article-search/*` queries PubMed + Semantic Scholar, deduplicates, source-tags hits, cross-checks existing rows by exact DOI/PMID. Already-saved rows render "✓ In library / Open existing row →" instead of "+ Add to Evidence".
2. **Retrieval** — clicking "+ Add to Evidence" calls `POST /api/pcs/evidence/save-from-search`, which runs the 7-tier waterfall in `src/lib/pmc.js`: Unpaywall → Semantic Scholar → CORE → OpenAlex → Europe PMC → bioRxiv/medRxiv → PMC. First successful PDF wins; lands in R2 bucket `nordic-pcs` under `evidence-pdfs/`.
3. **Classification** — PubMed MeSH publication-types map into `EVIDENCE_TYPES` (RCT / Meta-analysis / Systematic review / Observational / Review). No more default-to-RCT.
4. **Dedup** — `createEvidence` returns the existing row on DOI/PMID match instead of creating duplicates and surfaces a `merged` flag (Wave 7.0.5 T8.1).
5. **Manual override** — when the waterfall misses (paywall, EndNote-only, scanned), `POST /api/pcs/evidence/[id]/pdf-upload` accepts multipart form data, uploads to the same R2 path, and updates the row's pdf URL via `updateEvidence`. UI: button + drag-and-drop on the evidence detail page.

**Without `SEMANTIC_SCHOLAR_API_KEY` + `CORE_API_KEY` set as `wv-nordic` Worker secrets, those two tiers return 429 and effective coverage is 5/7.** Set them when convenient via `wrangler secret put` or the CF dashboard.

## auth — capability scopes

PCS auth lives in `src/lib/pcs-auth.js`. Capability scopes gate routes via the `pcs.<resource>:<action>` pattern.

`pcs.evidence:attach` now gates **three** write paths:
- `POST /api/pcs/evidence`
- `POST /api/pcs/evidence/save-from-search`
- `POST /api/pcs/evidence/[id]/pdf-upload`

If you audit auth, check all three. Don't add a fourth attach path without re-confirming the scope.

## caching layer (Phase 1 perf, 2026-05-05)

GET routes for `/api/pcs/{evidence,documents,claims,ingredients,canonical-claims}` carry `revalidate` + `s-maxage` cache headers. POST/PATCH handlers call `revalidatePath()` to bust the cache for the matching page. Edge-cache HIT on `/api/pcs/evidence` clocks ~33ms (vs 500–1500ms cold).

The four page routes have `loading.js` skeletons (`src/components/Skeletons.js`).

**Phase 2 (parallelize Notion queries inside the route + in-memory cache per Fluid Compute instance) is deferred** until the team has used Phase 1 for a workday and we have real hit-rate data. Don't preemptively jump to Phase 2.

## PcsTable conventions

`PcsTable` is the shared list component for `/pcs/*` index pages. As of 2026-05-05 it accepts `defaultSortKey` + `defaultSortDir` props so each page can pick its own sort semantics. Evidence page passes `lastEditedTime DESC` so newly-edited rows surface on top.

User sort prefs persist in localStorage under the `pcs-sort-v2-<resource>` key. The `v2` was bumped to invalidate stale prefs after the default-sort change — bump again (`v3`...) if you change the schema.

## things to know before editing

- **Notion + Supabase Postgres are the database.** Every PCS resource has a Notion DB (canonical for evidence/claims/ingredients UI) and a Postgres mirror (Path 2 strong-consistency dual-write, rolled out in Phase B 2026-05-08). `src/lib/pcs-*.js` helpers wrap Notion query/CRUD; `writePostgresFirst` in `src/lib/pcs-write.js` handles the dual-write. `PCS_READ_FROM_POSTGRES=1` and `PCS_WRITE_TO_POSTGRES=1` are set on `wv-nordic`.
- **PDFs go to R2, never to git.** Bucket `nordic-pcs`, path convention: `evidence-pdfs/<id>.pdf`. The waterfall and the manual upload route both write here via `src/lib/storage.js` (S3 API).
- **Research team uses EndNote.** Some rows will never have a public PDF; that's why manual upload exists. Don't gate workflows on PDF presence.
- **Deploys are manual.** Run `./scripts/deploy-nordic.sh` from the monorepo root. CF Builds is not wired up to this app — merges to `main` will sit there silently until somebody runs the script. The standing-authorization "ship" workflow in the root `CLAUDE.md` does NOT apply here; the user has to deploy.
- **`@vercel/blob` is gone — don't reintroduce it.** R2 (binding `NORDIC_ASSETS`) is the canonical PDF/asset store. The dynamic `import('@vercel/blob')` fallbacks were removed 2026-05-13 because they broke Turbopack builds after the package was dropped post-R2 migration. If you need a local-dev path, wire up Miniflare's R2 emulator instead.
- **AICS Notion DBs are intentionally unset.** All three `NOTION_AICS_*_DB` secrets were deleted 2026-05-13 after they were discovered to be corrupted with literal quote chars in the value (`"7d743889-..."` instead of `7d743889-...`). `src/lib/pcs-aics.js#listAicsDocuments` guards on the unset case and returns `{ items: [], nextCursor: null }` so the `/pcs/aics` UI degrades cleanly. When the DBs are wired up for real, set with `printf "<uuid>" | npx wrangler secret put` — never `echo` (newlines) or pipe through anything that JSON-encodes the value.
- **Cron triggers use `env.SELF.fetch()`, not custom-domain fetch.** Self-loops via `nordic.windedvertigo.com` 522 out at the CF edge. The service binding `SELF` in `wrangler.jsonc` lets `src/lib/scheduled.js` invoke `fetch()` directly on the worker. Don't refactor to fetch the custom domain.
