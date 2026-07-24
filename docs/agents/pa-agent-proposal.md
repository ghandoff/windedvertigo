# proposal — a personal-assistant (PA) agent for garrett
_draft for garrett's edit · 2026-07-24 · grounded in the 2026-07 evolution-research sweep (`agent-evolution-research-2026-07.md` — 25/25 claims verified) · companion to `docs/agents/executive-charters.md` (this charter is proposed, not adopted — you edit, per governance) · suggested repo home: `docs/agents/pa-agent-proposal.md` — written in the Cowork sandbox, cannot push, needs commit_

_context this is written against (verified on main 2026-07-24): all six exec
agents now have spine-integrated ambient behaviors, `AMBIENT_ROLLOUT_STAGE` is
live at `studio-comms` (real DMs, budget caps verified working in production),
and Opsy's weekly graduation-metrics loop is deployed. The company stack is at
"step 2.5" — ambient + the graduation machinery in place, waiting for resolved
volume. The PA proposal below assumes that base._

## purpose (garrett, 2026-07-24): the PA is the stage-3→5 pilot

The agent-development ladder: (1) summoned → (2) ambient, human-gated (the six
are here, at studio-comms) → (3) earned per-action-type autonomy → (4) agent↔
agent coordination → (5) integrated human-agent collective. **The PA's primary
purpose is to pilot stages 3–5 on an audience of one, so the collective's
progression is de-risked before any exec agent is nudged along it.**

Why it's the right vehicle: blast radius of one · **data velocity** (graduation
needs ~100 *resolved* clean instances per action-type — garrett resolves PA
cards daily, while exec-agent cards compete with everyone's real work; the PA
reaches graduation-eligible volume first) · one principal = coherent
approve/edit/ignore signal for the learning loop.

Transfer discipline (what makes the pilot valid):
- **Same machinery, or it's not a pilot.** The PA runs the spine's intervention
  table shape, `intervention-budget.ts`, and the same Opsy governance
  classifier pointed at its table. No looser "it's just for me" variant.
- **Export mechanisms, not thresholds.** Garrett is an atypical principal
  (builder, tolerant, expert editor) — PA-calibrated thresholds are ceilings to
  tighten for the collective, never defaults to copy.
- **Stage 4 testbed:** PA↔PaM and PA↔Fin handoffs (work item spotted → filed
  with attribution, ≤2 hops per charter). **Stage 5 limit:** the PA proves the
  trust mechanics but not the social layer — teammates-facing rollout stays an
  org decision.
- **Build the demotion path first.** The pilot's most valuable export is the
  down escalator (what error rate / ignored-streak revokes an autonomy) — it's
  what will make the collective trust promotions later.

## why a PA, and why it's different from the six

The exec agents serve the collective and watch **company** streams. The PA serves
**you** and watches **your** streams — including personal ones (calendar, email,
errands, learning queue) and the meta-stream of what you're working on across
conversations, tasks, and projects. Its job is the inverse of the exec agents':
they surface work the *company* shouldn't drop; the PA absorbs work *you*
shouldn't be doing, and surfaces the little and big things you aren't tracking.

Two design consequences fall out of that:

1. **Privacy boundary.** Personal-life data (health appointments, family
   logistics, personal finances) must not land in `wv-port-pilot` next to
   dashboards teammates can open. The PA gets its own memory store. It may
   *read* company systems (commitments, escalations, the repo, Slack) to build
   its picture of your work; it never *writes* personal context into them.
2. **Different success metric.** Exec agents are scored on acted-upon rate.
   The PA is scored on **time returned to you** — busywork it completed or
   pre-empted, forgotten items it caught, research it had ready before you
   asked. Interruptions count against it, same notification economics as the
   spine (its pings should also count toward your 5/human/day cap — one
   attention budget, not two).

## proposed charter — [name TBD: aLfred / aRlo / Pia — your call]

**Owns:** garrett's time and attention · the personal commitment ledger (things
you said you'd do, in any channel, work or personal) · the anticipation loop
(what's coming that you haven't prepared for) · the busywork backlog (recurring
low-judgment tasks it can take over) · your learning queue (things you want to
learn, fed with prepared material — never summarized-away; you love the
learning, it should protect that, not shortcut it).

**Watches:** your calendar (work + personal) · Gmail · Slack DMs/mentions and
channels you're active in · the exec agents' tables (commitments assigned to
you, escalations awaiting you, interventions expiring on you) · repo/session
activity (what you actually worked on — from git history and the status docs
you maintain, see "conversation history" note below) · a lightweight personal
inbox (a place you or family can drop "handle this" items).

**Anticipates:** a meeting tomorrow with no prep → briefing pack tonight · a
deadline or renewal (domain, subscription, insurance, school form) approaching
untracked → surfaced with the action drafted · a commitment you made in
passing ("I'll send that over") → logged and nudged before it slips · a
recurring pattern (you do X every Monday manually) → offer to take it over as
a scheduled task · travel/absence coming → logistics checklist + handoff note
seeded · your learning queue stale → next session's material prepared and
waiting.

**Standing permissions (mirrors the spine's tiers):**
- LOW — read its watch-list, maintain its own memory, prepare drafts/briefs/
  research, maintain your private dashboard.
- MEDIUM — DM you (within budget), add/annotate items on YOUR boards and
  calendar (flagged, reversible), file company-relevant items it spots into the
  exec agents' systems (e.g. a commitment → PaM) *with attribution, content
  scrubbed to the work-relevant part*.
- HIGH (preview + explicit approval, default-deny) — anything outward-facing:
  sending email/messages as you, booking/purchasing, calendar changes involving
  other people, anything touching family members' data.
- NEVER — write personal context into company tables · share personal data
  with the exec agents or teammates · financial transactions beyond a
  pre-approved allowance list you define.

**Number:** hours of busywork absorbed + catches (things surfaced that you
weren't tracking), reported in a weekly personal digest.

## the "track my conversations" problem — honest constraints

You asked for a PA that looks back at your conversations and past tasks to
anticipate next steps. What's actually reachable today:

- **Reachable now:** git history + `docs/prompts/` (your session-prompt habit
  is a goldmine — it's already a work journal), the status/handoff docs, the
  exec agents' memory + decision logs, Slack, Gmail, Calendar, Notion.
- **Not directly reachable:** Claude.ai/Cowork conversation transcripts — no
  API for a worker to read them. ⟨research⟩ may surface patterns others use.
- **The practical bridge:** make the journaling ambient rather than manual —
  a session-end convention (you already run `/end-of-day-sync`; extend it to
  append a 3-line "what I did / what's open / what's next" record to the PA's
  memory API), plus the PA inferring activity from commits, doc edits, and
  Slack. You get 90% of the anticipation value without transcript access.

## architecture sketch (phase decisions for a Claude Code session)

- **Memory store:** separate Supabase project (`garrett-pa`), same table
  patterns as the spine (memory / decisions / commitments / interventions) so
  code is reusable — different project = the privacy boundary is structural,
  not policy.
- **Runtime:** same pattern as the spine — Cloudflare Worker + crons (daily
  anticipation sweep, weekly digest, deadline scanner) + a Cowork MCP connector
  (`pa_*` tools) so any of your sessions can consult/update it. Reuse
  `ambient-run` + intervention-card code — and `port/lib/agent/intervention-budget.ts`
  (AGENT_DAILY_CAP / HUMAN_DAILY_CAP + the stateful `NotificationBudget`
  tracker, live since PR #398) from day one, so the PA's pings and the exec
  agents' pings can draw on ONE shared human budget.
- **Surfaces:** DM from its own Slack identity (or wv-claw with a PA prefix) ·
  a private `/pa` dashboard (session-gated to you) · morning brief integration
  (the Cowork `morning` skill is a natural front door).
- **Rollout:** same discipline as the spine — sandbox first (it DMs only you
  anyway, but its HIGH-tier actions start default-deny), graduate action types
  after clean instances. Opsy's governance layer (`opsy-governance.ts`,
  deployed) already computes graduation candidates per action-type; point the
  same classifier at the PA's intervention table. The PA is the natural *test
  bed* for step-3+ autonomy experiments: lowest blast radius of any agent
  (audience of one), so PA graduations can lead the company's.

## phased build plan (hand to Claude Code)

1. **Phase 0 — memory + connector (a day):** `garrett-pa` Supabase project,
   memory/decision/commitment tables, `pa_*` MCP tools on port (auth-gated to
   your Google identity), session-end journaling hook.
2. **Phase 1 — perception (read-only):** calendar + Gmail + Slack + agent-table
   sweeps into its event log; daily anticipation run producing a private brief.
   No interventions yet — you read its brief and grade it for two weeks.
3. **Phase 2 — intervention:** preview cards to you (budget-capped from day
   one), busywork takeover offers as scheduled tasks, weekly digest with its
   number.
4. **Phase 3 — delegation:** graduated action types act without preview
   (drafts sent to you become drafts sent for you, etc.), per the same
   graduation mechanism Opsy runs for the exec agents.

## open questions for you
- Name? (aLfred / aRlo / Pia / other — the caps-quirk is yours to bestow.)
- Does personal scope include family-visible surfaces (shared calendar, a
  family inbox), or you-only at first?
- Should the PA's pings share the 5/day human budget with the exec agents
  (my recommendation) or get its own budget?
- Personal Gmail/Calendar: same Google account as work, or a second account
  that needs its own connector?

## research grounding (from the 2026-07 sweep — details + caveats in the report)

- **Memory schema:** index by event time, not conversation time — a temporal
  knowledge graph of (subject, relation, object, timestamp) facts consolidated
  into durative topic/persona summaries that update as preferences change
  (Temporal Semantic Memory, ACL Findings 2026). This is the `garrett-pa`
  table design, not vector-store-of-chat-logs.
- **Privacy checklist to enforce across every tier** (arXiv 2603.07670):
  encryption at rest/in transit, per-user access scoping, automated PII
  redaction, configurable retention, auditable deletion including vector
  indexes and backups. The literature doesn't settle separate-store vs
  scoped-single-store — our separate-project choice is a defensible answer to
  an open question, and structurally simpler to audit.
- **Learning loop:** ERL-style outcome reflection (ICLR 2026) — distill your
  approve/edit/ignore decisions into compact heuristics, selectively retrieve
  at run time; abstracted lessons beat raw history replay. The PA's version of
  "learning your preferences" is this loop pointed at its intervention table.
- **Gating posture:** practitioners prefer milestone/exception check-ins over
  per-action approval (13/21 vs 0/21, Hedwig formative survey) — the PA should
  start more gated than that and *earn* its way there, per the pilot purpose.
- **Graduation mechanism:** Hedwig demonstrates learned oversight from
  approve/deny history beating static rules (recall 1.00 vs 0.50); "assisted
  evaluations" (minimum human involvement to clear an accuracy bar) give an
  objective promotion test. Both are exactly what the PA pilots for the six.
- **Known unknown:** no field validation of learned graduated autonomy over
  months with a real user exists — the PA pilot is genuinely novel evidence,
  worth instrumenting as if it will be written up.
