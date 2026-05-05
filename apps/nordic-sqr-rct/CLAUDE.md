# nordic-sqr-rct — claude code conventions

> auto-loaded by Claude Code when working in `apps/nordic-sqr-rct/`.
> companion handoff log: `.brain/handoff.md` at the monorepo root.
> active tasks: `.brain/TASKS.md` at the monorepo root.

## what this app is

Nordic Research Platform — Next.js 15 (App Router, JS) frontend to a Notion-backed evidence + claims system used by the Nordic / PRME research team (Sharon, Gina, Adin, Lauren + 2 RA TBD). Lives at `nordic.windedvertigo.com`. **Stays on Vercel** (not CF Workers) for Workflow DevKit + Vercel Blob support.

Deploy: `cd apps/nordic-sqr-rct && vercel --prod`. App-level deploy still works because it doesn't import workspace packages.

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
2. **Retrieval** — clicking "+ Add to Evidence" calls `POST /api/pcs/evidence/save-from-search`, which runs the 7-tier waterfall in `src/lib/pmc.js`: Unpaywall → Semantic Scholar → CORE → OpenAlex → Europe PMC → bioRxiv/medRxiv → PMC. First successful PDF wins; lands in Vercel Blob `evidence-pdfs/`.
3. **Classification** — PubMed MeSH publication-types map into `EVIDENCE_TYPES` (RCT / Meta-analysis / Systematic review / Observational / Review). No more default-to-RCT.
4. **Dedup** — `createEvidence` returns the existing row on DOI/PMID match instead of creating duplicates and surfaces a `merged` flag (Wave 7.0.5 T8.1).
5. **Manual override** — when the waterfall misses (paywall, EndNote-only, scanned), `POST /api/pcs/evidence/[id]/pdf-upload` accepts multipart form data, uploads to the same Blob path, and updates the row's pdf URL via `updateEvidence`. UI: button + drag-and-drop on the evidence detail page.

**Without `SEMANTIC_SCHOLAR_API_KEY` + `CORE_API_KEY` set on Vercel prod, those two tiers return 429 and effective coverage is 5/7.** Set them when convenient.

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

- **Notion is the database.** Every PCS resource is a Notion DB; `src/lib/pcs-*.js` helpers wrap query/CRUD. Don't introduce Supabase or Postgres without an explicit migration plan — that's Phase 3 perf and it's deferred.
- **PDFs go to Vercel Blob, never to git.** Path convention: `evidence-pdfs/<id>.pdf`. The waterfall and the manual upload route both write here.
- **Research team uses EndNote.** Some rows will never have a public PDF; that's why manual upload exists. Don't gate workflows on PDF presence.
- **Don't reconnect to Vercel Git auto-deploy.** App is intentionally manual-deploy (see monorepo `apps/harbour/CLAUDE.md` infrastructure rules — same cost-control reasons).
