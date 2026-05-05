# Handoff — Nordic Research Platform

> Append-only log of significant Claude / Claude Code sessions on `apps/nordic-sqr-rct`.
> Most recent first. Pair with `.brain/memory/handoff.md` (cross-environment) and `.brain/TASKS.md` (active work).
> Branch convention: `ghandoff/windedvertigo`, app deploys to `nordic.windedvertigo.com` (Vercel, kept off CF Workers for Workflow DevKit + Vercel Blob).

---

## 2026-05-05 — PCS evidence: research-team article search, manual PDF upload, dedup, Phase 1 perf

Multi-hour autonomous session on `apps/nordic-sqr-rct`. Wave 7.0.5 themes: get the research team unblocked on article import, kill duplicate evidence rows, and make `/pcs/*` pages feel instant. Session log at `~/.claude/projects/-Users-garrettjaeger-Projects-nordic-sqr-rct/`.

**What shipped (chronological, all on `origin/main`):**

- **`eb7ebf5` — auto-classify imported articles into EVIDENCE_TYPES.** PubMed MeSH publication-types now drive the taxonomy (RCT / Meta-analysis / Systematic review / Observational / Review). Imports stop defaulting everything to RCT.
- **`ff7f591` — research-team article search at `/pcs/evidence`.** Operators paste DOI / PMID / title → hits from PubMed + Semantic Scholar (deduplicated, source-tagged) → "+ Add to Evidence" chains through the same 7-tier PDF retrieval waterfall (`src/lib/pmc.js`) used by PCS imports — Unpaywall → Semantic Scholar → CORE → OpenAlex → Europe PMC → bioRxiv/medRxiv → PMC. PDFs land in Vercel Blob `evidence-pdfs/`. Endpoint: `POST /api/pcs/evidence/save-from-search`.
- **`3a8ace2` — in-library detection + optimistic refresh.** Hits cross-check existing rows by exact DOI/PMID; rows already saved show "✓ In library / Open existing row →" instead of "+ Add to Evidence". Sidebar resets after save. Saved chip is now a clickable Link to the new row's detail page.
- **`e7bf068` — Phase 1 perf.** `revalidate` + `s-maxage` cache headers on `/api/pcs/{evidence,documents,claims,ingredients,canonical-claims}` GET routes; `revalidatePath()` on POST/PATCH for cache busting; `loading.js` skeletons for the four pages. Verified: edge-cache HIT serves `/api/pcs/evidence` in 33ms (was 500–1500ms cold).
- **`bb0e8c5` — one-shot dedup.** Archived 3 test-pollution rows (1 TEST-DELETE Khalid, 2 Knapen 2013 dups). Decision rules + script: `apps/nordic-sqr-rct/scripts/archive-test-evidence-rows.mjs`.
- **`1854467` — archived-tree salvage.** 4 unique docs migrated from the standalone `~/Projects/nordic-sqr-rct/` into the active monorepo. Standalone tree renamed to `~/Projects/nordic-sqr-rct.archived-2026-05-05/` with a sentinel directory at the original path.
- **`c548317` — manual PDF upload** for paywalled / EndNote-only / scanned articles. `POST /api/pcs/evidence/[id]/pdf-upload` (multipart) → same Blob path → `updateEvidence`. Button + drag-and-drop on the evidence detail page (latter shipped by parallel agent).
- **`594f8b1` — default-sort improvements.** `PcsTable` now accepts `defaultSortKey` + `defaultSortDir`; evidence page passes `lastEditedTime DESC` so edited rows surface at the top. Newly-added rows default to top + jump-to-row on save. localStorage key bumped to `pcs-sort-v2-` to invalidate stale prefs.
- **`724338f` — lint cleanup.** Silence set-state-in-effect warning for localStorage hydration.
- **Wave 7.0.5 T8.1 — hard-merge dedup** (in flight at handoff write time, expected to land before tomorrow's session). `createEvidence` returns existing rows on DOI/PMID match instead of creating duplicates; surfaces a `merged` flag on the API response.

**Capability scope drift to know about:** `pcs.evidence:attach` now gates **three** write paths — `POST /api/pcs/evidence`, `save-from-search`, and `pdf-upload`. If you're auditing auth, check all three.

**Open follow-ups (also surfaced in `.brain/TASKS.md`):**

- Set `SEMANTIC_SCHOLAR_API_KEY` and `CORE_API_KEY` in Vercel production env. Without them, those two waterfall tiers return 429 and effective coverage is 5 of 7 tiers.
- **Phase 2 perf** — parallelize sequential Notion queries inside the API routes; in-memory caches per Fluid Compute instance. Defer until the team uses Phase 1 for a workday and we have real hit-rate data.
- **Phase 3 perf** — Notion → Supabase mirror for read paths. Multi-day, defer.
- **UX sweep findings** landing in parallel at `apps/nordic-sqr-rct/.brain/ux-sweep-2026-05-05.md`. Read after it lands and incorporate top items into TASKS.md.
- **Verify T8.1 hard-merge** after it lands — confirm `merged` flag returns and existing-row return path doesn't accidentally bypass the EVIDENCE_TYPES classifier.
