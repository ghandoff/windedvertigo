# Claude Code prompt — cARL dashboard redesign + whirlpool commitments system

> **How to use:** open a Claude Code session in `~/Projects/windedvertigo`, switch it into **Plan mode** (shift+tab), and paste everything inside the horizontal rules below. It will investigate the repo and return a plan for you to review. Approve before it writes anything.

---

You are working in the `windedvertigo` monorepo. **Start in plan mode and stay plan-first: do not edit files, run migrations, deploy, or run any mutating command until I have read and approved your plan.** Your job this turn is to investigate, then produce a thorough, phased implementation plan for two related builds. If anything is ambiguous, list it as an open question in the plan rather than guessing.

## orient before planning

Read these first so the plan matches house conventions and the real data model:

1. `./CLAUDE.md` and `../harbour-apps/CLAUDE.md` — repo conventions, deploy rules, and the agents/memory architecture. Pay attention to: "merged ≠ deployed" (GitHub and Cloudflare are separate steps), Supabase migrations are applied manually via the SQL editor, and "if MCP agent tools changed, the user reconnects the agents connector in Cowork."
2. `./docs/carl/2026-06-23-research-dashboard-ui-recommendations.md` — the dashboard critique + prioritised upgrades (P0→P3). This is the spec for workstream A.
3. `./docs/carl/2026-06-23-async-team-motivation-playbook.md` — the evidence-based playbook. The "visible system" requirements for workstream B derive from its playbook section.

Then investigate the codebase and **report what you find** as the foundation of your plan. At minimum, discover and document:

- **The `port` app** (internal AI tooling — kanban, harbour ops, the agent dashboards). Where it lives, framework (Next.js), and how it's deployed (`npm run deploy:cf`, manual).
- **The cARL data model.** The backing store is Supabase. Find the tables/columns behind findings, research lines / domains, curriculum topics, and the `connected_to` links between findings. Note how a "research line" tile is currently derived (it appears to be a `GROUP BY` on a free-text `domain` field — confirm this).
- **The `/carl` route and its components** — how tiles, tabs (research lines / findings / memory / log), and the AI search are rendered.
- **The MCP agent tools**, specifically `carl_add_finding` and `carl_add_curriculum_topic` — where they're defined and how the `domain` argument is validated (it currently accepts arbitrary strings; that is the root cause of tile sprawl).
- **The existing PaM commitments + whirlpool plumbing** — `pam_create_commitment` / `pam_update_commitment`, the `/pam` route, the `whirlpool-agenda-generator` and `whirlpool-post-meeting-linker` scheduled tasks, and any Notion "whirlpool" database they read/write. Workstream B should extend this, not duplicate it.

---

## workstream A — cARL research dashboard redesign

Implement the recommendations doc in its **suggested sequence**. Treat each phase as independently shippable.

### P0 — fix the data model (do first; it's the root cause)
- Introduce a **controlled domain vocabulary** of ~12–15 canonical domains (propose the list in your plan, derived from the current data — e.g. `threshold concepts`, `play-based & experiential pedagogy`, `learning design & UDL`, `ai in education`, `cognitive psychology`, `motivation & remote teams`, plus the `mo ·` and `pam ·` agent branches). Store it as a real table/enum, not a hard-coded array if avoidable.
- Update `carl_add_finding` (and `carl_add_curriculum_topic`) to accept **only** a canonical domain — fuzzy-match-and-confirm or reject-with-suggestions rather than silently creating a new domain. Add a separate free-text **`subtopic`** field so fine grain ("embodied cognition", "SLIMM / memory") lives *inside* a domain instead of spawning a new tile.
- Keep `tags` as the free-form, many-valued layer. Domains = controlled spine; tags = open.
- **Migration:** merge existing duplicate research lines into canonicals (e.g. `ai in education` / `AI in education` / `ai in education / embodied cognition` → one; the five `learning design*` variants → one; the three `play-based*` variants → one). Provide a proposed merge map in the plan for my review. The migration **must be reversible**: back up the affected tables first, do a dry-run that prints the before/after counts, and never hard-delete a finding — only re-point its `domain`.

### P1 — restructure the primary view
- Group domain tiles into **sections** with headers (learning & pedagogy / marketing & growth (mo) / delivery & ops (pam) / mission research).
- **Signal depth and recency:** finding-count as visual weight, a "last updated" date, and a coverage indicator for topics. A thin (1-finding) domain should look thin.
- **Lead with search + facets:** promote the AI search; let users filter findings by domain, tag, recency, and a "needs depth" facet (domains with <3 findings).
- Surface **blind spots + thin spots as a worklist**, not just the single banner — this becomes the daily routine's queue.

### P2 — make it a living library
- A **connections / graph view** built from `connected_to`.
- A **spaced-resurfacing** rail that resurfaces an older finding on each visit.
- A **findings-first feed** toggle (recent findings stream vs by-domain).

### P3 — polish
- Per-domain **depth target** (e.g. "aim 3–5 findings") with progress.
- A **reading-queue / inbox** of sources found-but-not-yet-synthesised, feeding the daily run.

**Acceptance for A:** the existing 85 findings all survive and are reachable; tile count drops to the ~15 canonical domains; adding a finding with a novel domain string is impossible (or routes to confirm); the view is grouped, depth-signalled, and search-first.

---

## workstream B — whirlpool commitments visible system

Build the "visible system" the playbook calls for: a single, durable, low-friction place where each person records a written commitment at each whirlpool and **everyone can see the board between sessions**. Ground every design choice in the playbook's evidence — the point is async accountability **without surveillance**.

### requirements
- **Commitment object** (extend PaM commitments rather than inventing a parallel store): owner, commitment text (encourage **if-then / implementation-intention** phrasing — "when I sit down Tuesday, I'll draft X"), optional linked project/area, cycle (the whirlpool it's due before), and status (`committed` → `in progress` → `done` / `blocked · needs help`). Frame goals as **learning/process**, never hard single metrics.
- **A visible board** as the single source of truth: a view grouped by **owner (owned lanes)** and a toggle to a **kanban-by-status with WIP limits**. Visible to the whole team — accountability is ambient and peer-visible, not top-down.
- **Capture at whirlpool close:** a fast path for each person to add their one commitment, ideally wired into the existing `whirlpool-agenda-generator` / post-meeting flow so it's part of the ritual, and enterable **async** (nothing requires live presence — timezone fairness).
- **Async midpoint check-in:** an automated lightweight prompt (Slack, between sessions) asking "what's done / what's stuck / what you need." Satisfies the goal-setting feedback moderator and makes "I'm behind, here's what I need" a normal, safe move. No chasing.
- **Recognition surface:** a lightweight, informational way to mark completed commitments / wins — public and mission-linked, **never transactional** (no points, streaks, or pay-linked rewards; per the over-justification + volunteer crowding-out evidence these would backfire on the unpaid contributors).
- **Explicitly no surveillance:** no activity/time tracking, no "last active," no nudges that read as monitoring. Visibility comes from people posting their own commitments and status.

### integrations
PaM commitments API · the whirlpool Notion database · Slack (the relevant team channel) · and surface the board in `port` (propose: a `/whirlpool` route or a panel on `/pam`).

**Acceptance for B:** a member can add an if-then commitment in seconds; the whole team sees one board between whirlpools; an automated async midpoint check-in posts to Slack; completed commitments are celebrated informationally; nothing in the system tracks activity or presence.

---

## constraints & conventions (apply to both)

- **Plan first.** No edits, migrations, or deploys until I approve. Flag every **irreversible or destructive** step (DB migration, data merge, deploy) for explicit, separate sign-off.
- **merged ≠ deployed.** Land code on `main` via PR; `port` deploys only via manual `npm run deploy:cf`, which I run. Don't call anything "live" after merging.
- **Supabase migrations** are applied by me via the SQL editor — provide the SQL plus a backup + rollback step; never run a destructive migration yourself.
- **MCP tool change ⇒ reconnect.** Changing `carl_add_finding` means I must reconnect the agents connector in Cowork afterward; call that out in the rollout steps.
- House style: **lowercase UI copy, british spelling, oxford comma, kebab-case filenames**; brand name always `winded.vertigo`.
- Preserve all existing data. The 85 findings and the curriculum are the crown jewels — back up before touching.
- Suggest **two PRs** (dashboard, commitments) so they can ship independently, and within the dashboard PR keep P0/P1/P2/P3 as separable commits.

## what to hand back this turn (the plan)
A phased plan containing: (1) your findings from the investigation (data model, file locations, current behaviour); (2) the proposed canonical-domain list + the duplicate→canonical merge map; (3) file-level changes per phase; (4) the migration plan with backup, dry-run, and rollback; (5) the commitments data model + board/route design; (6) open questions; and (7) the explicit list of steps that need my approval (migrations, deploy, connector reconnect). Stop and wait for my review.

---
