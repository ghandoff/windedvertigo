# cloud continuation prompt — executive/ambient agent development
_paste the block below into a new cloud/Cowork Claude conversation to continue this work from any device. Keep this file updated as the canonical starting prompt._

---

We're continuing the development of winded.vertigo's executive agents (Mo, PaM, cARL, Opsy, Fin, Biz) — specifically making them **ambient and proactive** (perceive → evaluate → act/preview/stay-silent) rather than only responding when summoned. I'm running this from the cloud so I can pick it up on my desktop, MacBook, and iPhone.

**First, get oriented — read these three files in the `ghandoff/windedvertigo` repo, in order:**
1. `docs/agents/executive-ambient-agents-status.md` — the living status doc: current state of all six agents, their dashboards, databases, the ambient spine, port links, open bugs, and next steps. Start here.
2. `docs/prompts/executive-agents-phase1-build.md` — the original build spec for the ambient spine.
3. `docs/agents/executive-charters.md` — the per-agent charters (watch-lists, permissions, risk tiers). **Read-only — I edit this, you don't.**

Also skim `docs/prompts/executive-agents-phase1-handoff.md` for the phase-1 build history.

**Where we are:** Phase 1 of the ambient spine is built, merged, and deployed live (sandbox-gated — nothing reaches real teammates yet). Mo and PaM have pilot proactive behaviors; the other four are memory/dashboard only. Full detail is in the status doc — don't take my summary here as authoritative over it; verify against the live systems.

**Your first actions this session:**
- Verify current state yourself rather than trusting the docs blindly: check the deploy (`curl -s https://port.windedvertigo.com/api/version`), the `agent_interventions` table in Supabase (`wv-port-pilot` / `fpqbokzjipovjhvujqtm`), and `#agent-sandbox` in Slack.
- Then confirm the two known open bugs are still open and tackle **bug #1 (notification-budget cap not enforced on the standalone crons)** first — it's actively accumulating proposed interventions every 15 minutes and blocks safe promotion off sandbox. The fix and the full next-step order are in the status doc.

**How we work:**
- You write + commit + push; **I run the deploy** (`cd port && npm run deploy:cf`) — deploys get permission-blocked when you run them. Present migration SQL for me to apply in the Supabase editor if the classifier blocks you there too.
- Solo-merge: branch → PR → `gh pr merge --admin --squash --delete-branch`. `git pull --rebase origin main` at the start.
- merged ≠ deployed. Nothing is live until I deploy + (if schema) the migration is applied.
- Keep `docs/agents/executive-ambient-agents-status.md` updated as you make progress — it's the handoff surface across all my devices, so whatever you change, reflect it there before we wrap.

Confirm you've read the three files and tell me the current live state you found (deploy version, intervention counts, any drift from what the status doc claims) before proposing what to do first.

---
