# /brain — the unified knowledge graph

`/brain` renders one graph of winded.vertigo's whole intellectual + operational
capacity: the **humans** (from the canonical CV system in Notion) and the
**agents** (from their live work logs), joined wherever they describe the same
capability.

## Architecture

- **Source of truth:** Supabase tables `knowledge_nodes` + `knowledge_edges`
  (`port/supabase/migrations/20260627_knowledge_graph.sql`).
- **Fallback:** `port/lib/knowledge/graph-data.ts` — a committed snapshot. If the
  DB is unreachable the page renders this (the subtitle shows "snapshot (db
  unreachable)").
- **Populated by** the daily `knowledge-sync` cron from **three sources**, each
  tagged on every node/edge:

  | `source` | what | code |
  |---|---|---|
  | `notion-cv` | the 7 Notion CV databases (members, skills, methods, frameworks, populations, services, entries) | `lib/knowledge/ingest-notion.ts` |
  | `agent-log` | the six agents' Supabase logs — structured columns + a Haiku pass over prose | `lib/knowledge/ingest-agents.ts` + `lib/ai/knowledge-extract.ts` |
  | `curated` | the original hand-authored 131-node scaffold | `lib/knowledge/ingest-curated.ts` |

## Provenance — reading the colours

Every node has a `kind` (the actor axis), which drives colour via `getNodeColor`:

- **human (teal)** — a person, skill, framework, method, or CV entry from the CV system.
- **agent (per-agent colour)** — an actor or a concept observed in agent logs;
  coloured by the owning agent (Mo blue, cARL green, PaM amber, Opsy red, Biz
  violet, Fin pink).
- **shared (gold)** — a capability a human *holds* and an agent *references* — the
  merge points. Drawn with a **gold dashed `same-as` bridge** between the two
  rows. Created by `lib/knowledge/reconcile.ts` by matching `canonical_key`.

A **dashed amber ring** marks a node the gap engine flags as stale /
under-evidenced.

## Gap analysis — the 11 detectors

Five operate on the concept scaffold (isolated, shallow-research,
ungrounded-product, thin-bridge, no-methodology). Six are cross-graph — they
compare what humans **claim** against what agents **observe**:

| gap | meaning |
|---|---|
| capability gap | agents work on a concept no human lists as a Skill → candidate new Skill |
| claimed · unevidenced | a Skill with no demonstrating CV entry in the last 24 months |
| evidence asymmetry | a member holds a Skill but no CV entry shows them doing it |
| framework adoption | a Framework no agent has ever referenced |
| population coverage | an audience served by no CV entry |
| service coverage | a Service with < 3 strong exemplar projects in 5 years |

## Operating it

- **Add a Skill / Method / Framework the agents surfaced:** add the row in the
  relevant Notion CV database, then re-run the sync — the new node + its
  relations appear, and reconciliation links it to any matching agent concept.
- **Trigger a re-ingestion (idempotent):**
  ```
  curl -H "Authorization: Bearer $CRON_SECRET" \
    https://port.windedvertigo.com/api/cron/knowledge-sync
  ```
  Returns a report of added/updated nodes, edges, merge bridges, and any source
  that was skipped. Runs daily at 11:20 UTC via `CRON_TABLE`.
- **Refresh the committed snapshot** after a full sync:
  `node scripts/regen-knowledge-snapshot.mjs` (reads the live tables → rewrites
  `lib/knowledge/graph-data.ts`), then commit.

## Precondition — Notion sharing

The human side only ingests if the port's `NOTION_TOKEN` integration
(**windedvertigo.com**) is shared with the **cv system** Notion page (and its
child databases). `members` is already shared (it's a PORT_DB table); the other
six need a one-time **Connections → add windedvertigo.com** on the cv-system
page. Until then the sync logs `notion: skipped` and populates curated + agents
only.
