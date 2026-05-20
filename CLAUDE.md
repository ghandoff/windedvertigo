# winded.vertigo — team context

Welcome. This file is the shared context for anyone working in this monorepo with Claude Code — whether locally or in a GitHub Codespace. It's intentionally small: a glossary, a project list, infrastructure pointers, and the workflow we use to ship together. If you're a designer learning git, read [How We Work](#how-we-work) first.

> Garrett's personal operational layer (CFO/COO/CMO automation, financial reviews, scheduled tasks) lives in a separate, gitignored second brain. Team members interact with those outputs through Slack, Notion, and the port dashboard — not through this repo. You don't need it to do your work here.

## People

| Who | Role |
|-----|------|
| **Garrett** | Garrett Jaeger — founder & legal rep, winded.vertigo LLC |
| **Payton** | Payton Jaeger, w.v collective — comms, website circulation, outreach |
| **Lamis** | Lamis Sabra, w.v collective |
| **Maria** | Maria Altamirano Gonzalez, w.v collective — operations, IDB Salvador lead |
| **James** | James Galpin, w.v collective |
| **Apoorva** | Apoorva Shivaram — formerly w.v collective (inactive) |
| **Kristin** | Kristin Lansing — formerly w.v collective (inactive) |
| **Meredith** | Meredith Storey, UN Global Compact / PRME — key client contact |
| **Sam** | Sam at PRME — works with Meredith on contracts |

## Terms

| Term | Meaning |
|------|---------|
| **w.v** | winded.vertigo |
| **whirlpool** | Monthly community learning event (public-facing) |
| **fruitstand** | Internal team meeting |
| **campfire** | Studio discussion format |
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
| **the collective** | The Winded Vertigo Collective — the full team |
| **Press Play** | Partner or program — joint whirlpool sessions |
| **stack audit** | Annual review of tools, DNS, hosting, subscriptions |
| **the port** | port.windedvertigo.com — operational hub (CRM + PM + studios + RFP) |
| **harbour** | The public side of the website family at windedvertigo.com |

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

## How We Work

This section is for everyone — including designers learning git through Codespaces + Claude Code. The workflow is small and stable; once you've done it twice it's automatic.

**The rule:** never edit `main` directly. Every change goes through a branch and a pull request (PR). PRs are how we see each other's in-flight work without having to ask.

### The four-step rhythm

1. **Branch.** Before editing anything, ask Claude to create a branch. Naming pattern: `<type>/<short-description>` where `<type>` is one of `feat` (new feature), `fix` (bug fix), `chore` (housekeeping), `docs` (documentation), `perf` (performance), `a11y` (accessibility). Examples: `fix/votes-race-condition`, `feat/co-rubric-companion`, `docs/onboarding-guide`.

2. **Open a draft PR immediately — before doing the work.** Claude Code does this for you. The PR title becomes a signal to the rest of the team: "I'm working on X right now." This prevents the most common friction in our setup, which was teammates accidentally editing the same thing because they couldn't see what others were doing. The PR starts in *draft* state, which means: visible to everyone, but not asking for review yet.

3. **Edit, commit, push.** Make your changes. Claude Code commits and pushes them. The draft PR auto-updates as you go — anyone watching can see the work evolve. Iterate as much as you want; you can keep editing the same branch.

4. **Mark ready for review.** When you're done, Claude removes the "draft" state. For **Payton and Lamis**, this is where Garrett takes over: he reviews the branch and merges it into `main`. You're not blocked — you can start the next thing. For **Maria**, you have ship authority: Claude will squash-merge directly on your behalf.

### Carve-outs (where you can skip the draft PR)

- Pure docs / memory edits: `CLAUDE.md`, `.brain/`, `TASKS.md`, README typos — these can land on `main` directly with a `[skip ci]` tag in the commit message.
- One-line typo fixes where the PR ceremony costs more than the visibility buys. Use judgment; default to draft PR if the change touches more than one file.

### What never to do

- Don't push directly to `main` for code changes.
- Don't force-push.
- Don't open the GitHub web UI to merge — everything routes through Claude Code's GitHub integration so the audit trail stays clean.
- Don't worry about merge conflicts in advance. If the push is rejected because `main` advanced, Claude rebases your branch on the latest `main` and re-pushes. Ask Claude to handle it.

### Parallel sessions

Multiple people (and multiple Claude Code sessions per person) can be editing at the same time. Each session gets its own branch, so collisions are rare. The PR queue (`gh pr list --state open`, or the Pull Requests tab on GitHub mobile) is the single source of truth for what's in flight.

## Your Context

This `CLAUDE.md` gives Claude shared context about the project. For your own personal preferences — how you like Claude to respond, projects you're focused on, tools you use — you can create your own private file:

- **`.claude/CLAUDE.md`** at your home directory (user-level, lives outside the repo, applies to all your Claude Code sessions). Not tracked in git, just yours.
- **`.brain/` directory at the repo root** (already gitignored). If you want a deeper personal memory system — task lists, decision logs, project notes — this is the convention. Your `.brain/` is invisible to teammates; only Garrett's exists in his local working tree and pushes to his separate private repo.

You don't have to set up either of these. The team `CLAUDE.md` you're reading is enough to start. Add personal layers as you discover what you want Claude to remember between sessions.

## CMO / brand voice context

Marketing strategy, brand voice guides, and campaign artifacts live in `.brain/memory/marketing/` — but that directory is gitignored and only exists in Garrett's local tree. If you're working on a marketing-adjacent task (social post, campaign copy, website tile language), ask in Slack or check the Notion brand voice page rather than expecting the directory to be present in your Codespace.

## Preferences

- **Lowercase aesthetic in brand voice** (winded.vertigo style). Avoid sentence-initial capitalization in marketing copy unless the source explicitly uses it.
- **Brand voice reference:** see Notion brand voice page or Garrett's `.brain/memory/marketing/` (Garrett's local only).
