# executive + ambient agents — development status & reference
_living doc · last verified 2026-07-21 by cloud Claude against live Supabase + Cloudflare (direct curl) + code · companion to `executive-charters.md` (Garrett-only) and `../prompts/executive-agents-phase1-build.md`_

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

- **Pilot proactive behaviors wired so far:** Mo (win-event reaction, content-runway watch, Friday scorecard, claim-boundary flags via the ambient sweep) and PaM (meeting→owner-confirmation DM, promise detection, Monday digest, absence-horizon). **Opsy** — weekly initiative-quality / governance review (see "Opsy governance layer"). **Fin** — weekly obligations-hygiene digest (see "Fin obligations digest"). **Biz** — estimated-value proposer (see "Biz value-proposer"). **cARL is the only agent still without an ambient behavior** — held until PR #296 (cARL dashboard + symbiosis) merges to avoid file collisions. (Note: #319 was a stale duplicate of the already-merged #295 Biz eligibility gates — closed 2026-07-22; it never actually blocked Biz.)
- Governance: `docs/agents/executive-charters.md` defines each agent's watch-list, permissions, and risk tiers. **Garrett edits it only.** Edits reach the code via `npm run sync:charters` → `port/lib/agent/charters.generated.ts` (build-time bundle; no runtime file reads on Workers).

---

## the ambient spine (phase 1 — built, deployed, sandbox-gated)

**Flow:** Slack channel message → `event_log` → 5-min debounce sweep (`agent-ambient-sweep` cron) → cheap Haiku relevance prefilter → Sonnet judgment → `agent_interventions` row → Slack preview card (approve/edit/redirect/ignore) and/or the `/inbox` tab → human resolves → executes or expires (default-deny on HIGH tier).

**Risk tiers (from the charters):** LOW = act, no gate · MEDIUM = act + notify, reversible · HIGH = preview card + explicit approval, default-deny on timeout.

**Rollout gate:** `AMBIENT_ROLLOUT_STAGE` in `port/wrangler.jsonc` `vars` (`sandbox` → `studio-comms` → `full`). **Currently `studio-comms` — LIVE as of 2026-07-22 ~03:13Z deploy, verified 07:49Z.** Real DMs are on, and Mo/PaM read `#studio-comms` (`C08PBCT5E0N`); `#agent-sandbox` (`C0BJHKZGZ28`) is still watched too. Verified via `event_log` picking up `#studio-comms` messages (only happens in this stage) after the wv-claw bot was invited to the channel. Budget caps (≤3/agent/day, ≤5/human/day) are the flood insurance. Next stage `full` adds `#whirlpool` (invite the bot there first). Emergency rollback: dashboard var → `sandbox` (instant), then revert `wrangler.jsonc`.

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

## current live state (verified 2026-07-21 by cloud Claude — direct curl + Supabase + code read)
- **Deploy:** direct `curl https://port.windedvertigo.com/api/version` → `{"worker":"wv-port","sha":"dev","ref":"unknown","built":"2026-07-20T07:00:20.874Z"}`. `built` matches the 07-20 deploy — **the spine is running current code.** `sha:"dev"`/`ref:"unknown"` is **normal**, not an anomaly: `app/api/version/route.ts` defaults `BUILD_SHA→"dev"` and `BUILD_REF→"unknown"`; only `BUILD_TIME` is injected at deploy. **Always compare `built`, never `sha`** (matches CLAUDE.md). The 07-21 Cowork session's anomalous `built:2026-06-06T07:14:08Z` was a **stale/cached proxy response** — a direct curl resolves it; it was never a real deploy problem. (Nice-to-have: inject a real `BUILD_SHA` at deploy so `/api/version` is more useful — known limitation, not a bug.)
- **`agent_interventions`:** 102 PaM `proposed`, 1 PaM `executed`, 2 Mo `executed`. The PaM proposed count is **unchanged since 07-20 (still 102) — NOT climbing** (the handoff's "~10/15 min" held only during the two bursts below). Last proposed row: 2026-07-21 10:45:23 UTC = 03:45 PDT.
- **Card flow stopped after 03:45 PDT 07-21 — cause found, NOT an error and NOT a drained backlog.** The owner-confirmation sweep only scans the **100 newest** pending items (`listPendingTriageActions` — `limit=100`, `created_at DESC`), then cards the eligible-and-not-yet-carded ones. That top-100 window is now fully carded, so the sweep emits 0/tick. Cards fired in two bursts (07-20 06:30–08:15 UTC ≈ 79 rows; 07-21 10:15–10:45 UTC = 23 rows), each draining the then-current window; burst 2 started right after `pam-action-triage` (daily 10:00 UTC) marked newer items. Backlog now: **1,373** action items, **449** pending, **334** eligible (pending + owner + meaningful) → **102 carded / 232 uncarded**. The 232 uncarded were all created **2026-06-01 → 07-02** — *older than every carded item* (2026-07-06 → 07-20), i.e. permanently below the newest-100 window. → see **new finding: stranded backlog** below.
- **`event_log`:** 0 rows (no human message has posted to a watched channel yet). **`time_off`:** 0 rows (needs seeding). **`agent_escalations`:** 4 open (Biz).
- Slack token fix (PR #394) confirmed working — PaM cards posted to `#agent-sandbox`; no real DMs sent.

---

## FIXED THIS SESSION — merged + **DEPLOYED** 2026-07-21T21:12:41Z (PR #398)
_No schema change → no migration. Deploy confirmed live (`/api/version` `built` advanced to 21:12:41Z). Post-deploy: `rows_since_deploy=0` — the spine is correctly quiescent (recent window carded + the new 14-day filter → no candidates; **no flood**). The budget-suppression + new-marker paths will self-verify over the next natural triage cycle (deferred by Garrett)._
1. **Notification budget now enforced on the standalone crons.** New shared helper `port/lib/agent/intervention-budget.ts` (`AGENT_DAILY_CAP=3`, `HUMAN_DAILY_CAP=5`; one-shot `isOverNotificationBudget()` + a stateful `NotificationBudget` tracker for multi-surface crons). `ambient-run.ts` refactored onto it (no behavior change). `pam-owner-confirmation-sweep` + `pam-absence-horizon` now check the budget per card — the row is **always inserted** (spec §2.2, queues in `/inbox`), only the Slack DM is skipped when over budget; both return `suppressedByBudget`. **Scope (confirmed with Garrett): the scheduled standing reports — `pam-monday-digest`, `mo-friday-scorecard`, `mo-content-runway-check` — are exempt** (once-per-cadence "Number, reported [day]"; each surfaces one bounded row).
2. **Sandbox marker now visible.** `buildInterventionBlocks` (`port/lib/agent/intervention-card.ts`) prepends a real `context` block (`🧪 sandbox — would DM \`x\` in production · nothing was sent`) whenever `ambientRolloutStage()==='sandbox'`, derived from the row's `targetHuman`/`channel`. Empty in every other stage, so live cards stay unmarked.
3. **Sweep recency window (from the stranded-backlog finding).** `listPendingTriageActions` gained an optional `createdSince` param (mirrors `listUntriagedActions`); the sweep passes a `CANDIDATE_WINDOW_DAYS = 14` window so old pending items age out **by design** instead of lurking below the newest-100 `limit`. The 232 pre-2026-07-02 items now age out intentionally.

## NEW FINDINGS (2026-07-22, from the post-promotion health check)
- **Budget cap verified live: no flood.** The first post-promotion owner-confirmation sweep raised 10 cards at real people; **0 were DMed** (PaM already over its 24h budget from the sandbox-era burst). Suppressed to `/inbox` — bug #1's fix confirmed working in production.
- **Reactive `@`-mention path was 401ing on Workers — FIXED + VERIFIED (deployed 2026-07-22 22:26Z).** Every `@`-mention/DM replied `401 AI_GATEWAY_API_KEY`. **Real root cause:** a stale `ANTHROPIC_BASE_URL` (dead Vercel AI Gateway URL) baked into the build via `.env.local`. Crons run as request handlers → read the CF **runtime** env (var unset) → `getAnthropic()` hit `api.anthropic.com` → fine. The reactive agent runs in Next `after()` background context → falls back to the **baked-in** env → `getAnthropic()` honored `?? ANTHROPIC_BASE_URL` → dead gateway → 401. Two PRs: **#415** made `index.ts` use the lazy `getAnthropic()` per-request (good practice, but a no-op for this bug since `getAnthropic` itself honored the leaked URL); **#416** is the actual fix — pin `baseURL: "https://api.anthropic.com"` in `getAnthropic` so it ignores the env in every context. Verified: DM to wv-claw now returns a real reply. (Belt-and-suspenders: delete `ANTHROPIC_BASE_URL` from `port/.env.local`.) The ambient spine was never affected (crons run in request context). **Note the general Workers footgun:** `after()`/background code can't rely on `process.env` matching the runtime env — several other module-scope `new Anthropic()` calls (chat, compose, rfp routes) would break the same way if ever run from a background context.

## NEW FINDINGS (2026-07-21)
- **Stranded triaged backlog (232 items): RESOLVED by design** via the recency window (fix #3 above). The 232 pre-Jul-2 items are intentionally not harvested now (a months-old commitment is stale). If any of them still need action, that's a separate one-off card/dismiss pass — flagged, not done.
- **Dedup (was the "minor" item): RESOLVED / non-issue.** Verified: **0** `meetingActionItemId`s appear more than once across all PaM cards. The "×3 same-title" cards are genuinely distinct `meeting_action_items` rows (same title recorded in different meetings). `listRecentByAgent("pam", 7)`'s `7` is **days, not a row cap** — a full 7-day dedup window with no truncation, so it's robust.

## Opsy governance layer — merged + **DEPLOYED** 2026-07-21T21:40:40Z (PR #399)
_Route confirmed live: `GET /api/cron/opsy-initiative-metrics` returns 401 (auth-gated, deployed). First real run: Monday 12:00 UTC. (Note: the first deploy attempt built from a stale checkout — needed `git pull --rebase origin main` before `npm run deploy:cf`; verify the new route is 401 not 404 after any deploy that adds a route.)_
Opsy's first spine-integrated behavior, per its charter ("initiative-quality metrics for all agents · noisy/quiet/wrong → threshold-tuning proposal · graduation candidates after ~100 clean instances → proposal to Garrett"). No schema change → no migration.
- **`getActionTypeMetrics(days)`** (`port/lib/supabase/agent-interventions.ts`) — acted-on/dismissed/false-escalation/expired sliced by **(agent, action-type)**, because autonomy graduates per ACTION TYPE, not per agent. Action-type key = `artifact.executeAction.type` ?? `decision/riskTier`.
- **`port/lib/agent/opsy-governance.ts`** — tunable *proposal* thresholds (distinct from the Garrett-only charter) + `classifyGovernance()` → `{graduation, wrong, noisy, quiet}` + `renderGovernanceDigest()`. Graduation = ≥100 **resolved** clean instances, ≥90% acted-on, ≤5% false-escalation, ≤10% dismissed. Noisy/wrong gate on **resolved** (not raw volume) so unresolved sandbox cards don't cry wolf.
- **`/api/cron/opsy-initiative-metrics`** (weekly, Mon 12:00 UTC in `CRON_TABLE`) — classifies, and *only when there's a signal* DMs Garrett a digest + logs one LOW-tier Opsy row. Quiet week → silent (no row, no ping). Budget-exempt (scheduled standing report). It only **proposes** — granting a permission is Garrett editing the charter → `npm run sync:charters` → redeploy; no code path auto-grants.
- Against today's data it would correctly emit **nothing** (the 102 PaM cards are unresolved, not "noisy"; nothing has ≥100 resolved instances yet).

## Fin obligations digest — merged + **DEPLOYED** 2026-07-22T02:11:18Z (PR #407)
_Route confirmed live: `GET /api/cron/fin-obligations-digest` returns 401. First run: Monday 13:00 UTC. (Reminder: needed several deploy attempts — the first two built from a checkout that hadn't pulled #407 and 404'd; `git pull --rebase origin main` in `~/Projects/windedvertigo/port` first, then confirm the route is 401 not 404.)_
Fin's first spine-integrated behavior (charter: "invoice hygiene · Watches: invoices, milestone dates"). The `fin-email-scan`/`fin-box-scan` crons ingest bills/invoices/tax notices into `fin_items` but nothing surfaced the overdue ones (81 open, 11 overdue at build). No schema change → no migration.
- **`/api/cron/fin-obligations-digest`** (weekly, Mon 13:00 UTC) — reads `fin-data.ts` (`getOpenFinItems` + `getUpcomingFinItems(14)`), DMs Garrett a single digest of **overdue + due-soon** items, only when non-empty; logs one `fin` `act_low` row. Budget-exempt standing report, same shape as Opsy's. A **digest, not per-item cards** — Fin can't execute anything (can't pay a bill), so approve/ignore has no action, and 11 items would be 11 cards over the 3/day cap.
- **Recency window `OVERDUE_LOOKBACK_DAYS = 60`** — 3 of the 11 "overdue" rows are stale 2024 items (oldest 2024-04-15) that were ingested and never actioned; the window drops them so Fin doesn't nag about 2-year-old cruft. Against today's data it emits **8 overdue, 0 due-soon**.
- Fin is deliberately **NOT** in Opsy's `ACTIVE_AMBIENT_AGENTS` quiet-list — a silent week (no overdue items) is correct for Fin, not a fault.

### Fin — flagged (not done)
- **Margin-per-engagement (40% floor) — data prerequisite.** The charter's headline Fin behavior needs per-engagement revenue/cost data; the `fin_*` schema is operational-finance only (bills/invoices/snapshots), no engagement margins. Needs a data model before it can be built.
- **3 stale >90-day `fin_items`** (2024 dates) — one-time cleanup: mark actioned/dismissed in `/finn`. Not a code fix.

## Biz value-proposer — built, **pending deploy** (2026-07-22, branch `feat/biz-value-proposer`)
Biz's first spine behavior **and** the data-unlock for its charter Number (weighted pipeline coverage). No schema change.
- **The gap:** `estimated_value` is null on all 39 active RFPs — it's a **manual Notion field** the RFP ingest never fills, so there's no data to weight the pipeline with. (All 39 do have a `one_pager` to extract from.)
- **`/api/cron/biz-value-proposer`** (daily 15:00 UTC) — for active RFPs (radar/pursuing) missing a value, Claude (Haiku, `rfp-document-extraction`) proposes an estimated value from the one-pager (`lib/biz/value-extract.ts`), surfaced as a MEDIUM-tier **preview card** to Garrett. **On approve**, a new intervention executor `biz_set_estimated_value` writes it to **Notion** via `updateRfpOpportunity` (source of truth) → the hourly sync flows it to Supabase. Budget-gated + dedup by `notion_page_id`, so the ~39-item backfill paces itself (~3/day) and new RFPs get a proposal as they land. Skips RFPs where Claude finds no basis.
- **Data constraint learned:** the sync is Notion→Supabase, so a Supabase-only write to `estimated_value` would be clobbered — approvals MUST write to Notion (they do).
- **Display note (deferred):** Garrett reported the RFP "Lighthouse" shows no pursuing/submitted cards, but the DB has 12 pursuing (synced 22:00 2026-07-22) and the `/opportunities` board code includes them in `ACTIVE_STATUSES` — so it's a display/filter issue to chase separately, not missing data. `submitted` is genuinely 0 (RFPs go pursuing→won/lost).

## NEXT STEPS (in order)
1. ~~Deploy the Opsy governance layer~~ **DONE** — live 21:40Z. First governance run: Monday 12:00 UTC.
2. Run the remaining phase-1 acceptance criteria (spec §4) as data arrives: Mo win-event card; HIGH-tier auto-expiry (default-deny); budget-suppression test (trigger the sweep, confirm `dmed ≤ 3`); `/inbox` render + working buttons; metrics endpoint. (Deferred to the natural cycle.)
3. **Promotion-readiness pack written** → `docs/agents/ambient-rollout-note.md` (team-facing card guide, the staged-promotion runbook, and the `time_off` seed SQL). Remaining human steps: seed `time_off`, post part 1 to the team, then flip `AMBIENT_ROLLOUT_STAGE`.
4. ~~Promote to `studio-comms`~~ **DONE + verified live 2026-07-22** (team announced, bot invited to `#studio-comms`, `event_log` confirmed). Stage lives in `port/wrangler.jsonc` `vars` (durable across deploys). **Now: watch the first 48h** — real posts appearing, no agent breaking 3/day, how cards land — then decide on `full` (adds `#whirlpool`; invite the bot there first).
5. Phase 3 — remaining spine-integrated ambient behaviors: **Fin obligations digest ✓ built** (above); **Biz** (RFP go/no-go cards) and **cARL** (citation gate) are **blocked by open PRs #296 / #405–#406** — build once they merge. Fin's margin-floor behavior waits on an engagement-cost data model. Grow `ACTIVE_AMBIENT_AGENTS` in `opsy-governance.ts` as each *continuously-firing* behavior lands (Fin's digest is intentionally excluded — a silent week is fine).

## how we work (constraints learned this session)
- **Claude writes + commits + pushes; Garrett runs the deploy.** `npm run deploy:cf` gets blocked by this environment's permission classifier when Claude runs it. Same occasionally for Supabase DDL — apply blocked migrations by hand in the SQL editor.
- Solo-merge convention: branch → PR → `gh pr merge --admin --squash --delete-branch`. Always `git pull --rebase origin main` at session start.
- merged ≠ deployed: a change is only live after `npm run deploy:cf` + (if schema) the migration applied in Supabase.
