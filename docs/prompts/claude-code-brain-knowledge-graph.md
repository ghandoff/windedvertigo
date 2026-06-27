# claude code prompt: commit, verify, and deploy the /brain knowledge graph page

> garrett: paste this into a claude code conversation in the windedvertigo repo.
> context: cowork built the files for a new `/brain` page in port — an interactive
> knowledge graph of the collective's agent brains + gap analysis that feeds cARL's
> curriculum. all files are on disk but uncommitted. this prompt gets them committed,
> building, and deployed.

---

## what was built (already on disk, uncommitted)

a new `/brain` page in port under the knowledge section (after bibliography).
two tabs: an interactive force-directed knowledge graph, and a gap analysis
panel that computes curriculum suggestions for cARL.

### new files

- `port/lib/knowledge/graph-data.ts` — typed data module. 131 nodes, 165 edges
  extracted from all agent brain files (`docs/{cmo,carl,pam,opsy,biz,fin}/`).
  exports `GRAPH_DATA`, `AGENT_META`, `computeGaps()`, and all relevant types.
  the `computeGaps` function analyses graph topology for: isolated nodes, shallow
  research domains, ungrounded products, thin inter-agent bridges, and client
  projects missing methodology. each gap can carry a `curriculumSuggestion` string
  for cARL.

- `port/app/(dashboard)/brain/page.tsx` — server component. stat cards (nodes,
  connections, categories, gaps found), UrlTabs for graph vs gap analysis views.
  follows the same pattern as `carl/page.tsx` and `ops/page.tsx`.

- `port/app/(dashboard)/brain/components/knowledge-graph.tsx` — "use client"
  component. interactive force-directed graph using a **custom SVG simulation**
  (no d3 — the port has no chart library by design; this follows the sparkline
  pattern). agent colour filter chips, text search, click-to-inspect with
  slide-out detail panel showing outgoing/incoming edges, edge relationship
  labels on hover, zoom/pan via scroll wheel.

- `port/app/(dashboard)/brain/components/gap-analysis.tsx` — "use client"
  component. renders gap cards sorted by severity (high/medium/low) with type
  filter chips. each gap shows related nodes with agent-coloured dots. gaps with
  curriculum suggestions show a green "cARL curriculum suggestion" box. bottom
  section aggregates all curriculum items into a numbered list.

### modified file

- `port/app/components/nav-config.ts` — added `Waypoints` icon import from
  lucide-react, added `{ label: "brain", href: "/brain", icon: Waypoints }`
  to the knowledge section items array after bibliography.

### file to delete

- `site/public/tools/knowledge-graph/index.html` — standalone public version
  from initial prototyping. the graph should only be accessible behind port's
  auth, so delete this file and its parent directory.

## what to do

1. **review the diff.** read through the new files and the nav-config change.
   fix any typescript errors, missing imports, or style issues. the graph
   component uses a brute-force O(n²) repulsion loop — that's fine for 131
   nodes but worth noting.

2. **build-check.** run `cd port && npm run build` (or `npx next build` if
   there's no build script). fix any type errors or build failures. common
   things to watch for:
   - `Waypoints` might not exist in the installed version of lucide-react —
     if so, swap to `Network` or `Share2`
   - the `searchParams` prop pattern uses `Promise<Record<...>>` which is
     the Next.js 15 async searchParams — check this matches what carl/page.tsx
     uses
   - `UrlTabs` is imported from `@/app/components/url-tabs` — verify the path

3. **delete the public copy.** `rm -rf site/public/tools/knowledge-graph/`

4. **commit and push.** single commit, something like:
   `feat(port): add /brain knowledge graph + gap analysis page`

5. **deploy.** port deploys via `npm run deploy:cf` (NOT auto-deploy on push).
   deploy after verifying the build passes.

6. **verify.** hit `port.windedvertigo.com/brain` after deploy, confirm both
   tabs render, confirm the sidebar shows the brain entry under knowledge.

## design decisions worth knowing

- **no d3 dependency.** the port deliberately has no chart library. the
  force-directed layout runs a 300-iteration simulation at component mount
  time, producing static (x, y) positions. this means the graph doesn't
  animate on load — nodes appear in their final positions. if you want
  animation later, the simulation can run in a requestAnimationFrame loop
  instead.

- **gap analysis is topology-driven.** `computeGaps()` runs pure graph
  analysis — no AI, no API calls. as nodes/edges change, gaps update
  automatically. the curriculum suggestions are string templates, not
  LLM-generated. a future iteration could feed these into cARL's actual
  curriculum table via the `carl_add_curriculum_topic` MCP tool.

- **agent colours.** mo=#3b82f6, carl=#10b981, pam=#f59e0b, opsy=#ef4444,
  biz=#8b5cf6, fin=#ec4899, shared=#6b7280. these match the existing agent
  colour conventions used elsewhere in port.

- **data is static for now.** `graph-data.ts` exports a const. the TODO at
  the top of the file notes this should eventually move to supabase so agents
  can update the graph programmatically.
