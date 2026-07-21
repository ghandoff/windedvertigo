# cloud continuation prompt — executive/ambient agent development
_paste the block below into a new cloud/Cowork Claude conversation to continue this work from any device. Keep this file updated as the canonical starting prompt._

---

We're continuing development of winded.vertigo's executive agents (Mo, PaM, cARL, Opsy, Fin, Biz) — making them **ambient and proactive** (perceive → evaluate → act/preview/stay-silent) rather than only responding when summoned.

**First, get oriented — read these three files, in order:**
1. `docs/agents/executive-ambient-agents-status.md` — the living status doc: current state of all six agents, the ambient spine, open bugs, and next steps. Single source of truth — start here.
2. `docs/prompts/executive-agents-phase1-build.md` — the original build spec for the ambient spine.
3. `docs/agents/executive-charters.md` — the per-agent charters (watch-lists, permissions, risk tiers). **Read-only — I edit this, you don't.**

Also skim `docs/prompts/executive-agents-phase1-handoff.md` for the phase-1 build history. Repo conventions come from `CLAUDE.md` (auto-loaded) — follow them.

**Where we are:** Phase 1 of the ambient spine is built, merged, and deployed, sandbox-gated (`AMBIENT_ROLLOUT_STAGE` unset → `sandbox`; every post and would-DM redirects to `#agent-sandbox` — nothing reaches real teammates). Mo and PaM have pilot proactive behaviors; the other four are memory/dashboard only. Full detail in the status doc — verify against live systems rather than trusting either it or this summary.

**Your first actions this session:**
0. **Docs sync:** fold any not-yet-recorded findings into the status doc's "current live state" section, and keep this continuation prompt matching how we actually start a session. Commit via the solo-merge flow.
1. Verify current state yourself: deploy (`curl -s https://port.windedvertigo.com/api/version` — if your sandbox blocks it, ask me to run it and paste the output; compare `built`, not `sha` — `sha:"dev"` is normal), Supabase `wv-port-pilot` / `fpqbokzjipovjhvujqtm` (count `agent_interventions` by agent/status — if you can't reach it, hand me the SQL for the editor), and `#agent-sandbox` (`C0BJHKZGZ28`) via the `slack` MCP in `.mcp.json`.
2. Then tackle the open bugs in the status doc's priority order — **bug #1 (notification-budget cap on the standalone crons) first**.

**How we work:**
- You write + commit + push; **I run the deploy** (`cd port && npm run deploy:cf`) — deploys get permission-blocked when you run them. Present migration SQL for me to apply in the Supabase editor if you're blocked there too.
- Solo-merge: branch → PR → `gh pr merge --admin --squash --delete-branch`. `git pull --rebase origin main` at the start.
- merged ≠ deployed. Nothing is live until I deploy + (if schema) the migration is applied.
- Keep `docs/agents/executive-ambient-agents-status.md` updated as you make progress — it's the handoff surface across all my devices; reflect whatever you change there before we wrap.

Confirm you've read the three files and tell me the current live state you found (deploy version, intervention counts, any drift from what the status doc claims) before starting on bug #1.

---
