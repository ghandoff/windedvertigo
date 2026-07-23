# cowork session handoff — 2026-07-20

_written by cowork session (cloud conversation). covers all active workstreams
and open items as of this date. start a new conversation and reference this file
to pick up where things left off._

---

## workstream 1: /brain knowledge graph (DONE → evolved by claude code)

**status:** merged to main. the initial cowork build (131 nodes, 165 edges,
force-directed SVG graph, gap analysis with cARL curriculum suggestions) was
handed off to claude code via `docs/prompts/claude-code-brain-knowledge-graph.md`
and has since been significantly expanded:

- **types refactored** into `port/lib/knowledge/types.ts` — added `NodeKind`
  (human | agent | shared | co-created), `NodeSource` provenance, `canonicalKey`
  reconciliation, new gap types (capability-gap, claimed-unevidenced,
  evidence-asymmetry, framework-adoption, population-coverage, service-coverage,
  ungrounded-framework, unattributed-coproduction)
- **live supabase layer** — `port/lib/knowledge/supabase.ts` fetches from db,
  falls back to the committed const snapshot
- **ingestion pipeline** — `ingest-agents.ts`, `ingest-bibliography.ts`,
  `ingest-curated.ts`, `ingest-notion.ts` for multi-source node population
- **reconciliation** — `reconcile.ts` + `reconcile-fuzzy.ts` for cross-source
  node merging
- **attribution tab** — third tab on `/brain` showing attribution panel
  (`attribution-panel.tsx`), backed by `port/lib/knowledge/attribution.ts`
- **gap analysis panel** — heavily evolved: star/dismiss/assign-to-cARL
  actions, owner attribution per gap type, localStorage persistence,
  `/api/actions/assign-gap` endpoint integration
- **graph component** — filter dropdowns, provenance legend, proposal-facing
  default view, stale-node dashed rings, `initialFocus` query param support

**nothing to do** — this workstream is in good shape.

---

## workstream 2: executive agents phase 1 (ambient spine)

**status:** code merged + deployed (PRs #393, #394). two open bugs remain.

**full handoff:** `docs/prompts/executive-agents-phase1-handoff.md` has complete
context including the two bugs, remaining acceptance criteria, and sandbox
graduation steps.

**open bugs:**
1. notification budget not enforced on standalone crons — pam crons skip the
   ≤3/agent/day cap and have accumulated 50+ interventions. must fix before
   promoting off sandbox.
2. sandbox marker is invisible — `[sandbox — would DM x]` lives in Block Kit
   fallback text, not rendered blocks.

**next steps:** fix bug #1 → run remaining acceptance criteria (spec §4, items
1/3/4/5/6) → seed `time_off` table → promote `AMBIENT_ROLLOUT_STAGE` env var
from sandbox → studio-comms → full.

---

## workstream 3: uncommitted local changes

**on main (unstaged):**
- `site/app/book/poll/[slug]/page.tsx` — poll page refactor (95 lines removed,
  simplification)
- `site/app/book/poll/[slug]/poll-respond-form.tsx` — poll form rewrite
  (171 insertions, 203 deletions)

**on `wip/mini-pre-sync-2026-07-20` branch:**
- 206 files changed (+9,109 / -10,089) — includes brain handoff notes,
  rfp-ingest, booking poll form, conference-experience images. this branch is
  behind main and needs rebasing or selective cherry-picking.

**on `feat/caipb-audit-fixes` branch (from prior session):**
- 8 uncommitted files in `apps/nordic-sqr-rct/` — needs committing from
  desktop. this has been flagged across multiple sessions.

---

## workstream 4: branch hygiene

~90 local branches, many stale. notable clusters:

- `worktree-agent-*` (11 branches) — leftover from claude code worktree agents.
  safe to delete.
- `rescue/*` (4 branches, 13 days old) — rfp-related rescues. check if merged
  or still needed.
- `feat/booking-*` (4 branches) — booking system phases. likely superseded.
- `feat/caipb-*` (3 branches) — nordic audit. check status.
- `claude/*` (4 branches) — automated claude branches. `claude/great-lewin`
  is 3 hours old (active?), rest are 3+ weeks old.

recommend running `/branch-cleanup` skill in claude code to audit.

---

## workstream 5: infrastructure items (carried forward)

- **google cloud TLS certificate** — flagged for deadline review in a prior
  session, never looked at. still pending.
- **deploy friction** — `npm run deploy:cf` gets blocked by the environment's
  permission classifier when claude runs it. garrett runs deploys manually.
  this is documented in the phase-1 handoff note.
- **public knowledge-graph copy** — `site/public/tools/knowledge-graph/index.html`
  should have been deleted when the port version shipped. the cowork sandbox
  couldn't remove it; check if claude code did.

---

## open decisions (no resolution yet)

1. **digest bot identity** — PR #394 repointed `lib/slack.ts` from the dead
   `SLACK_BOT_TOKEN` to `SLACK_AGENT_BOT_TOKEN` (wv-claw). if the digest
   crons need their own posting identity, `SLACK_BOT_TOKEN` needs a fresh
   credential and the preference flipped back.

2. **knowledge graph data layer** — currently falls back to a committed const
   when supabase is unreachable. the `TODO` in `graph-data.ts` notes this
   should move fully to supabase so agents can update the graph
   programmatically. ingestion pipeline exists but unclear if it's wired
   into a cron yet.

3. **ambient spine rollout timing** — bug #1 (budget cap on crons) blocks
   graduation. no date set for promoting to `studio-comms` or `full`.
   team rollout note hasn't been written yet.

---

## key files to read for context

| purpose | file |
|---------|------|
| repo conventions | `CLAUDE.md` |
| executive agents spec | `docs/prompts/executive-agents-phase1-build.md` |
| executive agents handoff | `docs/prompts/executive-agents-phase1-handoff.md` |
| agent charters (read-only) | `docs/agents/executive-charters.md` |
| brain graph prompt | `docs/prompts/claude-code-brain-knowledge-graph.md` |
| knowledge graph types | `port/lib/knowledge/types.ts` |
| brain page | `port/app/(dashboard)/brain/page.tsx` |
