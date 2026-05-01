# three-intelligence-workbook Tile Audit — 2026-04-26

## TL;DR

No tile in the harbour-games Notion database points at the slug
`three-intelligence-workbook`. The Stage B1 site Worker redeploy will fix
the 404 at `/harbour/three-intelligence-workbook` (the static asset
exists), but the harbour grid will not link to it from anywhere.
**Verdict: VESTIGIAL rewrite.**

## Findings

### Notion harbour-games DB

- Database id: `8e3f3364b2654640a91ed0f38b091a07`
- Data source id: `df2c8149-323e-4499-a4a2-5068bba8c089`
- Schema (relevant): `Slug` (text), `Name` (title), `Status` (select: `live`
  | `coming-soon`), `Order` (number), `Tile Image` (file), `Href` (url).
- Total rows enumerated via three semantic searches against the data source
  (`three intelligence workbook`, `workbook`, `harbour`): 19 unique pages.
- Rows matching `three-intelligence-workbook`: **0**.
- Full slug roster (kebab inferred from page titles): `pattern.weave`,
  `bias.lens`, `liminal.pass`, `raft.house`, `crease.works`, `market.mind`,
  `depth.chart`, `tidal.pool`, `proof.garden`, `vertigo.vault`,
  `paper.trail`, `deep.deck`, `code.weave`, `mirror.log`, `orbit.lab`,
  `rhythm.lab`, `emerge.box`, `time.prism`, `scale.shift`.
- No archived or "coming-soon" candidate with similar title surfaced.
- Note: enumeration used `notion-search` over the data source (semantic),
  not a full unbounded query, but three different queries returned the same
  closed set of 19 rows, so coverage is effectively complete.

### Static asset state

- File path: `~/Projects/windedvertigo/site/public/tools/three-intelligence-workbook/index.html`
- Size: 84,156 bytes
- Last modified: 2026-04-24 15:34:23
- Bundled in the most recent OpenNext build artifact for the site Worker.

### Site router state

- Rewrite source: `/harbour/three-intelligence-workbook` (and trailing
  slash variant)
- Rewrite destination (post-fix, commit `1cc20fa`):
  `/tools/three-intelligence-workbook/`
- Current deployed Worker: pre-fix (destination still
  `/tools/three-intelligence-workbook/index.html` — incompatible with how
  Workers static assets resolve directories).
- Awaiting deploy: yes (Stage B1).

### Local Postgres tile cache

- None. `apps/harbour/lib/notion.ts` queries Notion directly each request
  (server components + ISR). No `harbour_tiles` mirror to diverge from.

## Recommendation

**[VESTIGIAL]** No Notion tile points at this slug. After Stage B1 deploys,
the URL will resolve to the static workbook, but no harbour landing-page
tile will link to it. Two paths forward, pick one in a follow-up:

- (a) Add a row to the harbour-games DB with `Slug = three-intelligence-workbook`,
  `Status = live` (or `coming-soon`), `Href = /harbour/three-intelligence-workbook`,
  plus name/description/colours, if the workbook is meant to be a public
  harbour app.
- (b) Remove the rewrite from
  `~/Projects/windedvertigo/site/next.config.ts` in a follow-up commit and
  delete `~/Projects/windedvertigo/site/public/tools/three-intelligence-workbook/`
  if the workbook is dead content.

Stage B1 itself is unaffected — it should still ship to fix the rewrite
behaviour, since the static asset is real and the URL responding 200 is
better than 404 even if no tile links to it yet.

## Notes

- The three semantic searches each returned the same closed set of 19
  rows, with no near-miss candidates (no rows containing "intelligence",
  "workbook", or "three" in title/description beyond the existing tiles
  whose descriptions begin with the word "three").
- `apps/harbour` is the only consumer of this DB; no other app caches it.
- The static asset's mtime (2026-04-24) predates this audit by ~2 days,
  suggesting it was added during the recent Stage B push and the matching
  Notion entry simply was never created.
