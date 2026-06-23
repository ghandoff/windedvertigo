# cARL dashboard — ui critique + prioritised upgrades

_cARL research brief · 2026-06-23 · requested by garrett_
_based on a live review of port.windedvertigo.com/carl + a benchmark of comparable knowledge/research platforms_

---

## the core problem (it isn't just visual)

the current `/carl` view renders the library as one long, undifferentiated grid of equal-weight tiles — one tile per "research line." with 35 research lines and growing, it's an endless scroll where a 5-finding domain looks identical to a 1-finding domain, marketing sits next to pedagogy with no grouping, and the actual knowledge (85 findings) is hidden behind a tab. that's the "largely useless" feeling.

but the live review surfaced a **deeper, structural root cause** the tiles only symptomise:

### the taxonomy has fragmented because `domain` is an uncontrolled free-text field

every finding is filed under a free-text `domain` string, and **every slightly different string spawns a brand-new tile.** the result is a sprawl of near-duplicate research lines for what should be single domains:

- **ai in education** (2 findings) · **AI in education** (1) · **ai in education / embodied cognition** (1) — three tiles, one domain.
- **play-based & experiential pedagogy** (3) · **play-based learning** (4) · **play-based pedagogy** (1) — three tiles.
- **learning design & UDL** (3) · **learning design** (1) · **learning design & memory** (1) · **UDL** (1) · **universal design** (1) — five tiles, one domain.
- **cognitive psychology** (1) · **cognitive psychology / threshold concepts** (1) — and the embodied-cognition / experiential-learning / kolb findings are scattered across four more singletons.

so the "35 research lines" are really ~12–15 genuine domains shattered into 50+ tiles. **honest note: i caused some of this** — my own `carl_add_finding` calls invented new domain strings ("learning design & memory", "ai in education / embodied cognition") instead of matching canonical ones. the fix is as much about *write-time discipline* as about the view.

a second issue the review confirmed: the header shows **"0 study runs this month"** — the daily research routine had genuinely stopped (now re-wired as the `carl-daily-research` scheduled task).

---

## what comparable platforms do (benchmark)

| pattern | who does it well | what it solves |
|---|---|---|
| **knowledge graph / backlinks view** | obsidian (graph view), research rabbit (citation graph) | shows findings as a connected network — we already capture `connected_to` but never visualise it |
| **controlled vocabulary + faceted filtering** | zotero, notion databases, serious KBs | one approved domain list with synonyms; filter by multiple facets at once instead of scrolling tiles |
| **spaced resurfacing / "on this day"** | readwise, reflect, remnote | resurfaces older findings so the library is *re-read*, not just *written* — directly serves "go deeper" |
| **depth/recency signalling** | most analytics dashboards (NN/g F-pattern: KPIs top, detail bottom) | makes a 5-finding domain visibly heavier than a 1-finding one |
| **search-first entry** | elicit, consensus, semantic scholar | the primary action is query, not browse — findings (the unit of value) lead, domains are a facet |

sources: NN/g taxonomy + F/Z-pattern guidance; faceted-search & controlled-vocabulary best practice (claravine, hedden, matrixflows); obsidian graph view; readwise/reflect resurfacing; the personal-knowledge-graph survey (arxiv 2304.09572).

---

## recommended upgrades, by priority

### P0 — fix the data model (do this first; it's why the UI feels broken)

1. **introduce a controlled domain vocabulary.** define ~12–15 canonical domains (e.g. `threshold concepts`, `play-based & experiential pedagogy`, `learning design & UDL`, `ai in education`, `cognitive psychology`, `motivation & remote teams`, plus the `mo ·` / `pam ·` agent branches). `carl_add_finding` should accept only these (dropdown / fuzzy-match-and-confirm), not raw free text.
2. **merge the existing duplicates** into those canonicals with a one-off migration, and add a `subtopic` field for the finer grain ("embodied cognition", "SLIMM / memory") so nuance lives *inside* a domain instead of spawning a new tile.
3. **separate "domain" from "tag."** domains are the controlled spine (few, governed); tags stay free-form and many. faceted filtering then works.

> impact: this alone collapses ~50 tiles to ~15 coherent ones and stops the sprawl regenerating. highest leverage, lowest design effort.

### P1 — restructure the primary view

4. **group domains into sections** with headers — _learning & pedagogy_, _marketing & growth (mo)_, _delivery & ops (pam)_, _mhpss / mission research_ — so the mission work isn't buried among marketing tiles.
5. **signal depth and recency on each tile:** finding count as visual weight (size or a small bar), a "last updated" date, and a coverage ring for `topics covered`. a thin domain should *look* thin — that's the prompt to deepen it.
6. **lead with search + facets.** promote the existing AI search to the primary action; let users filter findings by domain, tag, recency, and "needs depth" (1-finding domains) in one place.
7. **surface blind spots and thin spots as a worklist,** not just the single banner — "domains with only 1 finding" becomes cARL's (and the daily routine's) to-do queue.

### P2 — make it a *living* library, not a filing cabinet

8. **a connections / graph view** built from `connected_to`, so the schema→threshold-concepts→memory web (and others) is navigable visually. this is the single most differentiating feature versus a plain list.
9. **spaced resurfacing** — a small "revisit" rail that resurfaces an older finding each visit, turning the library into something re-read over time (the mechanism behind "more depth per topic").
10. **a findings-first feed option** — toggle the home view between "by domain" (current) and "recent findings" (a reverse-chronological stream), so new depth is immediately visible.

### P3 — polish

11. per-domain **depth target** ("aim: 3–5 findings") with progress, so depth is an explicit, trackable goal rather than a vibe.
12. **reading-queue / inbox** of sources cARL has found but not yet synthesised, feeding the daily run.

---

## suggested sequence

`P0` (data model + merge) → `P1.4–5` (grouping + depth signalling) → `P1.6–7` (search/facets + thin-spot worklist) → `P2.8` (graph) → everything else. the P0 work is mostly backend/schema and unblocks every visual improvement; without it, any redesign just renders the same fragmentation more prettily.

_implementation note: `/carl` is served from `port` (manual `npm run deploy:cf`, per repo conventions). the controlled-vocabulary change touches `carl_add_finding` in the MCP agent tools — so after deploy, the agents connector needs reconnecting in cowork._
