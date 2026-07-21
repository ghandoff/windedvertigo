# executive + ambient agents — development status & reference
_living doc · last verified 2026-07-20 by Claude (MacBook session) against live Supabase + Slack + Cloudflare · companion to `executive-charters.md` (Garrett-only) and `../prompts/executive-agents-phase1-build.md`_

This is the single source of truth for the state of the winded.vertigo executive-agent
platform as it moves from "reactive, summoned" to "ambient, proactive." Keep it current —
it's what a fresh cloud/Cowork conversation reads to get oriented.

---

## the big picture
Six executive agents (Mo, PaM, cARL, Opsy, Fin, Biz) already exist with live memory,
dashboards, and a Cowork MCP connector. Phase 1 of the **ambient-agent spine** (built &
deployed 2026-07-19/20) adds proactive behavior: agents *perceive → evaluate →
act/preview/stay-silent* instead of only responding when addressed. Currently only **Mo**
and **PaM** have pilot proactive behaviors wired; the other four are memory/dashboard only
so far. Everything proactive is gated to a private sandbox until explicitly promoted.

---

## the agents (all six live today)

| agent | role | dashboard | MCP tool prefix | memory tables (decisions / memory / domain) |
|---|---|---|---|---|
| **Mo** | CMO — marketing, brand, pipeline | `/mo` (the "strategy" command centre) | `cmo_*` | 29 / 37 / — |
| **PaM** | PM — commitments, capacity, meeting→action | `/pam` | `pam_*` | 20 / 18 / 117 commitments |
| **cARL** | research — citations, findings, falsification | `/carl` | `carl_*` | 8 / 12 / 157 findings |
| **Opsy** | chief of staff / infra + platform metrics | `/ops` | `opsy_*` | 11 / 11 / 154 incidents |
| **Fin** | CFO — margin, invoices, runway | `/finn` | `fin_*` | 10 / 8 / 81 items |
| **Biz** | BD — pipeline coverage, go/no-go, proposals | `/biz` | `biz_*` | 172 / 42 / 31 roadmap |

- **Pilot proactive behaviors wired so far:** Mo (win-event reaction, content-runway watch, Friday scorecard, claim-boundary flags via the ambient sweep) and PaM (meeting→owner-confirmation DM, promise detection, Monday digest, absence-horizon). Biz/cARL/Fin/Opsy are **phase 3** per the charters — not yet ambient.
- Governance: `docs/agents/executive-charters.md` defines each agent's watch-list, permissions, and risk tiers. **Garrett edits it only.** Edits reach the code via `npm run sync:charters` → `port/lib/agent/charters.generated.ts` (build-time bundle; no runtime file reads on Workers).

---

## the ambient spine (phase 1 — built, deployed, sandbox-gated)

**Flow:** Slack channel message → `event_log` → 5-min debounce sweep (`agent-ambient-sweep` cron) → cheap Haiku relevance prefilter → Sonnet judgment → `agent_interventions` row → Slack preview card (approve/edit/redirect/ignore) and/or the `/inbox` tab → human resolves → executes or expires (default-deny on HIGH tier).

**Risk tiers (from the charters):** LOW = act, no gate · MEDIUM = act + notify, reversible · HIGH = preview card + explicit approval, default-deny on timeout.

**Rollout gate:** env var `AMBIENT_ROLLOUT_STAGE` (`sandbox` → `studio-comms` → `full`). **Currently UNSET → defaults to `sandbox`** → every channel post and every "would-DM" is redirected to `#agent-sandbox` (Slack channel id `C0BJHKZGZ28`, currently just Garrett + wv-claw). No real teammate is being DMed.

---

## infrastructure & links

- **Port app (production):** https://port.windedvertigo.com — deployed as the `wv-port` Cloudflare Worker.
- **Version / deploy check:** `curl -s https://port.windedvertigo.com/api/version` (compare `built` to merge time).
- **The inbox (both card types):** https://port.windedvertigo.com/inbox — renders `review_queue` items AND `agent_interventions` (currently ~100+ proposed PaM cards, see open bugs).
- **Intervention metrics:** `GET https://port.windedvertigo.com/api/agent/interventions/metrics` (Bearer `CMO_API_TOKEN`) — per-agent acted-on / dismissed / false-escalation rates for Opsy's future graduation analysis.
- **Cowork MCP connector (all six agents):** `https://port.windedvertigo.com/api/mcp/agents/all` — leave OAuth client fields blank → Connect → Google sign-in → approve. Setup: `docs/plugins/REMOTE-MCP-SETUP.md`.
- **Repo:** `github.com/ghandoff/windedvertigo`, port app under `port/`. Deploy is manual: `cd port && npm run deploy:cf` (merged ≠ deployed).
- **Supabase:** project `wv-port-pilot`, ref `fpqbokzjipovjhvujqtm` (org `mnubwoharpbonzlztzri`).
- **Slack:** wv-claw app (bot token `SLACK_AGENT_BOT_TOKEN`). Interactivity URL `/api/agent/slack/interactive`; events at `/api/agent/slack/events`.

### spine database tables (Supabase, all RLS-on / service-role-only)
- `agent_interventions` — the decision/preview-card queue (decision, risk_tier, artifact, status, expires_at, target_human, budget/metrics source).
- `event_log` — raw Slack channel-message ledger for the debounce sweep (currently 0 rows — no human messages posted to a watched channel yet).
- `time_off` — absence calendar for PaM's horizon check (currently **0 rows — needs seeding**, no entry UI in phase 1).
- `agent_escalations` — the 5-level escalation ladder (predates the spine; 4 open Biz escalations live).
- `agent_actions` — wv-claw's per-Slack-turn audit/cost log (distinct from `agent_interventions`; do not conflate).

---

## current live state (verified 2026-07-20)
- `agent_interventions`: **102 PaM `proposed`** (climbing ~10 / 15 min), 1 PaM + 2 Mo `executed`. → see open bug #1.
- `event_log`: 0 rows. `time_off`: 0 rows. `agent_escalations`: 4 open (Biz).
- Deploy: live, `built` 2026-07-20T07:00 UTC (includes the Slack token fix, PR #394).
- Slack token fix confirmed working — PaM cards are posting to `#agent-sandbox` correctly; no real DMs sent.

---

## OPEN BUGS (fix before promoting off sandbox)
1. **Notification budget NOT enforced on standalone crons.** Charter caps interventions at ≤3/agent/day, ≤5/human/day. That check lives only in `port/lib/agent/ambient-run.ts`; the standalone crons (`pam-owner-confirmation-sweep`, `pam-monday-digest`, `pam-absence-horizon`, `mo-*`) call `insertIntervention` directly and skip it. That's why 100+ PaM cards have accumulated. **Must fix before promotion** or graduating off sandbox fires a flood of real DMs. Fix: extract the budget check into a shared helper and apply it in every cron that surfaces an intervention.
2. **Sandbox marker invisible.** In sandbox mode the "would-DM" cards land in `#agent-sandbox`, but the `[sandbox — would DM x]` prefix sits in the Block Kit *fallback text*, which Slack hides when `blocks` are present. Move the marker into a visible context block in `port/lib/agent/intervention-card.ts`.
- Minor: confirm dedup in `pam-owner-confirmation-sweep` (same-titled items appear repeatedly — likely distinct `meeting_action_items` rows, worth checking).

## NEXT STEPS (in order)
1. Fix open bug #1 (budget cap) — highest priority; it's actively accumulating.
2. Fix open bug #2 (sandbox marker visibility).
3. Run the remaining phase-1 acceptance criteria (spec §4): Mo win-event card; HIGH-tier auto-expiry (default-deny); budget-suppression test; `/inbox` render + working buttons; metrics endpoint.
4. Seed `time_off` for the absence-horizon behavior.
5. Human gate — promote `AMBIENT_ROLLOUT_STAGE`: `sandbox` → `studio-comms` → `full`, with a whirlpool rollout note before `full`.
6. Phase 2/3 — extend ambient behaviors to Biz, cARL, Fin, Opsy per their charters; Opsy's graduation-metrics loop.

## how we work (constraints learned this session)
- **Claude writes + commits + pushes; Garrett runs the deploy.** `npm run deploy:cf` gets blocked by this environment's permission classifier when Claude runs it. Same occasionally for Supabase DDL — apply blocked migrations by hand in the SQL editor.
- Solo-merge convention: branch → PR → `gh pr merge --admin --squash --delete-branch`. Always `git pull --rebase origin main` at session start.
- merged ≠ deployed: a change is only live after `npm run deploy:cf` + (if schema) the migration applied in Supabase.
