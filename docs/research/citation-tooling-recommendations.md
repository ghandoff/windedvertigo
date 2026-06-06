# citation tooling — recommendations for the collective

> a brief on how to make the cARL + bibliography workflow more efficient,
> distilled from a scan of the established reference managers (zotero, mendeley,
> endnote, paperpile) and the free scholarly-metadata apis (crossref, semantic
> scholar, openalex). written 2026-06-05, after building the port `/bibliography`
> store + the citation-import tool.

## where we are now

the annotated bibliography lives in supabase (204 entries, growing as cARL
studies), browsable + editable at `port.windedvertigo.com/bibliography`. each
entry carries a `used_in` "assets" list, so a citation can be tagged with every
deliverable it appears in (the certificate series, the ppcs report, a proposal,
etc.). we just added two things:

- **a multi-select asset picker** — pick existing asset tags or type a new one,
  on every row and in the add/edit dialog.
- **a review-first import tool** — paste a document's reference list, choose an
  asset, and it matches each reference against the library (tagging what's
  already there, flagging what's new) before anything is written. this is the
  durable "tag citations as they come in" surface.

so we already own the two hardest parts of a reference manager: a structured
store and a way to get citations *into* it tied to where they're *used*. the
recommendations below are about closing the gap with the polished tools —
cheaply, and without rebuilding what google docs / word already do well.

## what the established tools do that we don't (yet)

| capability | zotero (free) | mendeley (free, 2gb) | endnote (~$275/yr) | paperpile ($2.99/mo) | us, today |
|---|---|---|---|---|---|
| identifier → auto-fill (doi/isbn/pmid) | ✅ | ✅ | ✅ | ✅ | ❌ (manual entry) |
| bibtex / ris import + export | ✅ | ✅ | ✅ | ✅ | ❌ |
| one-click formatted bibliography (apa/chicago) | ✅ (csl) | ✅ | ✅ | ✅ | ❌ |
| duplicate detection + merge | ✅ | ✅ | ✅ | ✅ | ~ (exact + fuzzy on import only) |
| cite-while-you-write (word/docs) | ✅ | ✅ | ✅ | ✅ (docs) | ❌ (don't rebuild) |
| pdf store + annotation | ✅ | ✅ | ✅ | ✅ | ❌ |
| "papers citing this" / discovery | ~ | ~ | ✅ | ✅ | ❌ |
| **used-in / deliverable tagging** | ~ (collections) | ~ | ~ | ~ | ✅ **(our edge)** |
| **ai that reads our own library** | partial | ❌ | partial | via gemini | ✅ **(cARL)** |

two columns are ours and theirs is weak: **tagging a citation by the deliverable
it lives in**, and **an agent (cARL) that actively studies our own library and
writes findings back**. the strategy below is to keep those edges and borrow the
table-stakes features from the free apis rather than from the paid tools.

---

## recommendations (prioritised)

### high-value & cheap — do next

1. **identifier → auto-fill via the free crossref api.** paste a doi (or isbn /
   arxiv id) and get clean title, authors, year, venue, and abstract back. this
   kills manual citation entry, which is the single biggest friction in the add
   flow today. crossref's rest api needs **no key and no auth** — just include a
   contact email in the request to land in their "polite pool". roughly: `GET
   https://api.crossref.org/works/{doi}` → map `message` into a `NewBibliographyRow`.
   *small — one fetch + a field map, reusing the existing insert path.*

2. **bibtex / ris import + export.** collaborators and students live in zotero;
   accepting a `.bib`/`.ris` export (and emitting one) makes us interoperable
   instead of a silo. import plugs straight into the `planImport` review flow we
   just built; export is a formatter over `getBibliographyRows`.
   *small — parsing is a solved problem (lightweight libs); no new storage.*

3. **one-click formatted bibliography (apa / chicago / csl-json).** for a
   proposal or report, select an asset and get a properly formatted reference
   list out. a csl library (`citeproc`/`citation-js`) turns our structured rows
   into any of ~10,000 styles. pairs naturally with the `used_in` tagging —
   "give me the bibliography for *ppcs final report 2025*" becomes one click.
   *small — formatter over existing data; no schema change.*

4. **duplicate detection + merge in the library (not just on import).** the
   import tool already fuzzy-matches; promote that to a background check across
   the whole table so the library stays clean as cARL adds entries. on a match,
   merge and **union the `used_in` lists** so no deliverable tag is lost.
   *small — reuse the `normMatch` key from the import engine.*

### high-value, medium effort

5. **"used in" as a first-class, two-way view.** we tag citations by asset; now
   surface the reverse: an asset page that lists *"this deliverable cites these N
   sources"*, with a per-asset export (feeds #3). this is the feature the paid
   tools don't really have, and it's where our model is genuinely better for a
   research collective that ships deliverables.
   *medium — a new route + an `unnest(used_in)` aggregate.*

6. **full-text + saved searches.** a postgres `tsvector` over citation + abstract
   + keywords gives instant full-text search; saved filters ("2023–25, cited in a
   proposal") make recurring lookups one click. cheap on supabase, no new service.
   *medium — one generated column + a gin index + a saved-search table.*

7. **pdf → citation + reference-list extraction.** drop a pdf and (a) extract its
   own metadata into a row, and (b) pull *its* reference list straight into the
   import tool. claude already reads pdfs; a tool like grobid does structured
   reference extraction at scale if volume grows. this makes the "as they come
   in" loop nearly hands-free for new reports.
   *medium — wraps the import engine we just built around a pdf reader.*

8. **"papers citing this" via the free semantic scholar api.** from any doi, pull
   forward/backward citations for discovery — "who's building on this work we
   already cite?". no key required (100 req / 5 min free; a form raises the
   limit). a strong, free complement to cARL's curriculum-gap research.
   *medium — a fetch + a "related work" panel; rate-limit aware.*

### later / cARL-specific

9. **embeddings + semantic search** (supabase `pgvector`) so cARL can say "from
   our *own* library, these 8 sources are most relevant to this curriculum gap" —
   turning the bibliography from a store into a recommender. this is the natural
   next step for the agent and the clearest long-term differentiator.

10. **citation graph / topic map** (research-rabbit-style) over our library +
    semantic-scholar edges, for curriculum and proposal landscape views.

11. **shared / role-based access** (supabase rls) if partners or students ever
    get read access to slices of the library.

12. **pdf annotation + highlight capture** feeding cARL findings — close the loop
    from "what we read" to "what cARL knows".

---

## build vs. buy

**build (we already have the hard parts):** the structured store, deliverable
tagging, and an agent over our own corpus are ours and worth deepening. items
1–6 are days of work against free apis and supabase primitives — cheaper and
better-fit than paying per-seat for a tool that doesn't model "used in a
deliverable" or let an agent study the library.

**buy / borrow, don't rebuild:** cite-while-you-write plugins for word and google
docs are mature and free (zotero, paperpile) — don't replicate them; instead make
us *interoperable* via bibtex/ris (#2) and formatted export (#3) so anyone can
pull our library into their editor of choice. **zotero groups** (free, unlimited
collaborators) are a fine shared front-end if we ever want one, and the
**crossref / semantic scholar / openalex** apis are free metadata backbones —
lean on them rather than on endnote's price tag.

**net:** keep our edge (used-in tagging + cARL), borrow table-stakes from the
free apis, and stay interoperable with the tools the rest of the field uses.

## token economics

the only ai cost in this stack is the import parser (claude haiku): **~$0.005–
0.02 per document**, logged under `bibliography-import` on `/ai-hub`. everything
in recommendations 1–8 is free-api or in-database — **no incremental ai spend**.
embeddings (#9) would add a one-time ~$0.02 to embed the whole 200-entry library
on a small embedding model, then pennies as it grows.

## sources

- [zotero / mendeley / endnote / paperpile comparison (effortless academic)](https://effortlessacademic.com/zotero-vs-mendeley-vs-endnote-which-reference-manager-is-better/)
- [best reference managers 2026 (papersflow)](https://papersflow.ai/blog/best-reference-managers-2026)
- [crossref rest api — metadata retrieval (no key required)](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)
- [crossref apis overview](https://www.crossref.org/categories/apis)
- [semantic scholar api / research-paper apis 2026 (intuitionlabs)](https://intuitionlabs.ai/articles/research-paper-apis-scientific-literature)
- [scholarly metadata api list (smu research guides)](https://researchguides.smu.edu.sg/api-list/scholarly-metadata-api)
- csl / citation-js (citation styles), grobid (pdf reference extraction) — open-source standards referenced above.
