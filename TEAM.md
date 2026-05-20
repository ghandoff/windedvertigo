# Team Context

Shared institutional knowledge for everyone working in this monorepo — Garrett, Maria, Payton, Lamis, James, and any Claude Code session (local or Codespace) acting on their behalf.

This file is the **what** of winded.vertigo: who we are, what we call things, what's currently active, what we've built. For the **how** of working together (branching, PRs, commit conventions), see [CONTRIBUTING.md](./CONTRIBUTING.md). For per-developer Claude config, each contributor has their own gitignored `CLAUDE.md`.

If you're brand-new to the repo, read this top-to-bottom once, then keep it open as a glossary.

---

## People

| Who | Role |
|-----|------|
| **Garrett** | Garrett Jaeger — founder & legal rep, winded.vertigo LLC |
| **Maria** | Maria Altamirano Gonzalez, w.v collective — operations, IDB Salvador lead |
| **Payton** | Payton Jaeger, w.v collective — comms, website circulation, outreach |
| **Lamis** | Lamis Sabra, w.v collective |
| **James** | James Galpin, w.v collective |
| **Apoorva** | Apoorva Shivaram — formerly w.v collective (inactive) |
| **Kristin** | Kristin Lansing — formerly w.v collective (inactive) |
| **Meredith** | Meredith Storey, UN Global Compact / PRME — key client contact |
| **Sam** | Sam at PRME — works with Meredith on contracts |

## Terms

| Term | Meaning |
|------|---------|
| **w.v** | winded.vertigo |
| **the collective** | The Winded Vertigo Collective — the full team |
| **the port** | port.windedvertigo.com — operational hub (CRM + PM + studios + RFP) |
| **harbour** | The public side of the website family at windedvertigo.com |
| **whirlpool** | Monthly community learning event (public-facing) |
| **fruitstand** | Internal team meeting |
| **campfire** | Studio discussion format |
| **stack audit** | Annual review of tools, DNS, hosting, subscriptions |
| **PRME** | Principles for Responsible Management Education (UN Global Compact program) |
| **PPCS** | PRME Pedagogy Certificate System — evidence infrastructure + AR program |
| **creaseworks** | w.v product — creativity platform |
| **GoTCHA!** | w.v product/project |
| **eddyy** | w.v product/project |
| **perp labs** | w.v studio initiative — perpetual labs |
| **toy lab** | w.v studio initiative |
| **play, fair** | w.v studio initiative — play and fairness research |
| **IDB** | Inter-American Development Bank — El Salvador ed-tech procurement |
| **MINEDUCYT** | El Salvador Ministry of Education, Science and Technology |
| **Press Play** | Partner or program — joint whirlpool sessions |

## Active Projects

| Name | What | Status |
|------|------|--------|
| **IDB Salvador** | Ed-tech modernization procurement SDP 01/2026 | Active |
| **PRME 2026** | Contract with UN Global Compact | Active — invoicing |
| **Amna at 10** | Evidence synthesis & impact report proposal | Submitted |
| **LEGO / Superskills!** | Cross-cutting skills certification with Learning Economy Foundation | Active |
| **Sesame Workshop** | Learning design engagement | Active |
| **UNICEF** | Learning design engagement | Active |
| **Website launch** | windedvertigo.com circulated to trusted contacts | Active — soft launch |

Whirlpool action items live in [`.brain/TASKS.md`](./.brain/TASKS.md) (force-tracked).

## Monorepo Structure

```
windedvertigo/
  harbour/          — main website (windedvertigo.com)
  crm/              — client relationship manager (port.windedvertigo.com)
  ops/              — command center dashboard (ops.windedvertigo.com)
  apps/             — standalone apps (values-auction, PEDAL-conference, harbour subapps)
  ancestry/         — ancestry.windedvertigo.com
  packages/         — shared packages
  scripts/          — deploy scripts (deploy-crm.sh, deploy-ops.sh, deploy-site.sh)
```

**Tech stack:** Next.js 16 + Turbopack, Tailwind v4, Auth.js v5 (Google OAuth), npm workspaces (no turborepo). Cloudflare Workers (via OpenNext) is the primary host. Cloudflare DNS.

## Infrastructure State

| Service | Domain | Host | Worker | Status |
|---------|--------|------|--------|--------|
| Site | windedvertigo.com | CF Workers (OpenNext) | `wv-site` | Live |
| Harbour | apps under windedvertigo.com | CF Workers (OpenNext) | `wv-harbour-harbour` (R2 tile images, Auth.js Pool A SSO) | Live |
| Depth-chart | windedvertigo.com/harbour/depth-chart/* | CF Workers (OpenNext) | `wv-harbour-depth-chart` | Live |
| Port (CRM) | port.windedvertigo.com | CF Workers (OpenNext) | `wv-port` (R3 bindings, R2 `port-assets`) | Live |
| Port agent | Slack DM @wv-claw | Vercel | `wv-claw` | Live |
| Nordic | nordic.windedvertigo.com | CF Workers (OpenNext) | `wv-nordic` (5 cron triggers, R2 `nordic-pcs`) | Live |
| Ancestry | ancestry.windedvertigo.com | CF Workers (OpenNext) | `wv-ancestry` (R2 `ancestry-media`, 2 cron triggers) | Live |
| Ops | ops.windedvertigo.com | CF Workers (OpenNext) | `wv-ops` (OPS_DATA + SMOKE_LATEST KV) | Live |
| Vault | windedvertigo.com/harbour/vertigo-vault/* | CF Workers (OpenNext) | `wv-vault` (Auth.js Pool A SSO, R2 `creaseworks-evidence`) | Live |
| Creaseworks | windedvertigo.com/harbour/creaseworks/ | CF Workers (OpenNext) | `wv-harbour-creaseworks` | Live |
| Values Auction | values-auction-d9m.pages.dev | CF Pages + Worker | `values-auction` + `values-auction-hub` (Durable Object + KV) | Live |
| wv-launch-smoke | wv-launch-smoke.windedvertigo.workers.dev | CF Workers | `wv-launch-smoke` (30-min cron, 40-target probe) | Live |

**Canonical image bucket:** R2 `creaseworks-evidence`. Public URL: `https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev`. Used by site, harbour, vault, creaseworks.

## Coordination signals

The repo carries its own live picture of "what's happening right now." When you start a session, three places to glance:

| Where | What it tells you |
|-------|-------------------|
| `gh pr list --state open` (or GitHub mobile) | All in-flight work, including drafts. The draft PR title is the in-flight signal — see [CONTRIBUTING.md](./CONTRIBUTING.md). |
| [`.brain/memory/handoff/`](./.brain/memory/handoff/) | Per-session handoff notes. One file per session, force-tracked. Read the freshest two or three when picking up where someone left off. |
| [`.brain/TASKS.md`](./.brain/TASKS.md) | Whirlpool action items with named assignees. |

The SessionStart hook in `.claude/hooks/session-start-diagnostic.sh` surfaces branch state, main divergence, and open draft PRs at the top of every Claude Code session — so concurrent sessions notice each other before editing.

## Your Context

This file (TEAM.md) gives shared context. For your **personal** Claude config — how you like Claude to respond, projects you're focused on, your own tool preferences — create your own gitignored file at the repo root:

- **`CLAUDE.md`** at the repo root is gitignored by default. Each contributor has their own; they don't see each other's. This is where Claude-specific instructions go (lowercase aesthetic, your preferred response style, your active focus).
- **`.brain/`** at the repo root is gitignored (with specific exceptions — see [`.brain/memory/handoff/README.md`](./.brain/memory/handoff/README.md)). If you want a deeper personal memory layer — task lists, decision logs, project notes — this is the convention. The exceptions (`.brain/TASKS.md` and `.brain/memory/handoff/*`) are force-tracked because they're collision-surface infra, not personal memory.

If you find yourself writing a convention into your personal `CLAUDE.md` that everyone should follow, **promote it to [CONTRIBUTING.md](./CONTRIBUTING.md)**. If you find yourself writing a fact about the team or projects that everyone should know, **promote it to this file (TEAM.md)**.

## Marketing / brand voice

Marketing strategy, brand voice guides, and campaign artifacts live in `.brain/memory/marketing/` — but that directory is *not* force-tracked (it's personal to Garrett's local tree). If you're working on a marketing-adjacent task (social post, campaign copy, website tile language), ask in Slack or check the Notion brand voice page.

**Style guideline that does apply repo-wide:** lowercase aesthetic in brand voice (winded.vertigo style). Avoid sentence-initial capitalization in marketing copy unless the source explicitly uses it.
