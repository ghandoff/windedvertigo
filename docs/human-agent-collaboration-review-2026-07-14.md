# winded.vertigo — humans × agents working review
_prepared 14 july 2026 · sources: agent briefings (Mo, PaM, cARL, Opsy, Biz), Notion (TToC pages, whirlpool notes, meetings db), Gemini transcripts in Drive, Slack (June–July), the windedvertigo monorepo docs, windedvertigo.com_

---

## 1. Executive summary

You have built something unusually good in six weeks: six agents with persistent memory, shared decision logs, dashboards, an MCP connector, voice endpoints, and real work flowing through them (RFP pipeline, ops monitoring, research feeds, proposal drafting). The bones are right. The problem is not the lineup — it's the **loops**.

Three findings dominate everything else:

1. **The agents effectively work for one person.** Nearly every logged Mo/PaM conversation in the last 14 days is with Garrett (one PaM session traces to Payton; the rest are all Garrett). Lamis and Jamie's onboarding (repo clone + Cowork conversations) was due July 8 and hasn't happened. August has gone quiet. Slack posts from Opsy and Biz get essentially zero human replies — the Biz review queue shows 23 proposals "awaiting review," some 119 days overdue, re-posted daily into silence. The agents broadcast; only Garrett converses. This is the single biggest constraint on "working together more effectively," and it's an onboarding + interaction-design problem, not an agent-count problem.

2. **The around-the-clock layer is half-wired.** Agents are explicitly designed as "always-available briefed colleagues" — autonomy is the exception (Opsy, cARL's weekly study, the carl-automation feeds). Several promised loops don't fire: the Friday 10am PaM digest to #whirlpool never appears; `meet-transcript-ingest` and `rfp-gmail-scanner` have been failing for weeks on **one config fix** (a missing `drive.readonly` delegation scope + `GOOGLE_IMPERSONATE_SUBJECTS` on wv-port — Opsy root-caused it on June 26/29, it's still open). That one 15-minute admin action unlocks the meeting-notes pipe you already specced, which is the keystone for agents anticipating your needs without prompting.

3. **The TToC rubric already exists — it just isn't in the machines.** The TToC Front Page v2 in Notion contains a working project rubric (Must Have / Should Have / Clear Rejections), and the June 30 strategy playdate explicitly flagged the open question: "making TToC persistent in agent memory so it is integrated into planning by default, not just referenced per session." Jamie is finalizing the decision tool this month. Encoding it as a shared gate every agent calls is the highest-leverage alignment move available — and it directly answers "align with our transformational theory of change."

Do you need more agents? **Not now.** You need the six you have to talk to five humans instead of one, run on heartbeats instead of prompts, and score everything against the TToC. Two or three new agents make sense later (Section 6).

---

## 2. Where you are today

**Humans.** Garrett (founder — hyper-dominant across every channel, self-aware bottleneck: "I'm so in the forest that I can't see what it looks like to others"). Maria (power user after Garrett — uses PaM socially, red-teams Biz's guardrails, reviewed docs "with Biz and Fin and Cowork"). Jamie (owns the TToC; built his own parallel agent stack — Alfred, Buck, Blake, Socrates, Mrs. Bucket — and wants federation: "My Pam could talk to your Pam"). Lamis (facilitation/comms; just back from July 5–14 leave; enthusiastic but not yet onboarded to the agent layer). Payton (design/comms; designing a walking-podcast digest of team activity). August (tooling; nearly silent in June–July; ClickUp/Linear evaluation still pending). Aaron Fruit (aesthetics, FruitStand pod).

**Agents.** Mo (CMO — strategy, pipeline, $482.5k of $500k target), PaM (lean PM — commitments, RACI shepherds, whirlpool agendas), cARL (research — weekly study job, findings auto-filed, feeds insights into other agents' memory), Opsy (most autonomous — 5-minute health checks, auto-fix authority for safe actions, #ops-alerts), Fin (CFO — QBO/Gusto/Gmail reads, never executes payments), Biz (BD — RFP radar, QC review, go/no-go scorecards; 54 active opportunities, $180k raw pipeline). All share one skeleton: Supabase `{agent}_decisions` + `{agent}_memory`, briefing endpoints, one MCP connector, skill.md personas, port dashboards.

**How work flows now.** Humans meet (whirlpools Mon/Wed, bi-weekly strategy playdates, weekly 1:1s) → Gemini + Notion AI capture everything twice → but agents can't read it (broken ingest), so Garrett manually relays context into agent memory via Cowork sessions. Agents post findings to Slack channels nobody answers. Decisions logged with one agent don't reliably reach teammates (the June 22 rule — "agents supplement, not replace, human communication" — is carried entirely by Garrett).

---

## 3. What's already working — protect it

- **Opsy's incident discipline**: root-causing instead of re-fixing, threaded resolve notes in #ops-alerts, learned patterns, RLS lockdown with an event trigger. This is the model for every agent's "posture."
- **cARL's citation gatekeeping** and the plain-language standing rule ("write so the team could teach it back").
- **Maria's hard-gates work** (code-enforced BIZ-E1/BIZ-Q1 after her memo: "it's reliable in practice, but it isn't a hard gate"). This is the correct instinct — encode norms in code, not prompts.
- **The human-in-the-loop patterns from the July 8 whirlpool**: named human verifier fields on AI claims, coders named by lens, "experts verifying and critiquing AI first drafts." Garrett's framing — "we're basically outsourcing the €20–25k contract to a machine… how do we do that the right way and have us as experts in the loop" — is exactly right and should become standard across all agent output, not just Amna.
- **PaM's lean relaunch** (June 30): RACI shepherd per project, async between whirlpools, false-horizon milestones, "not the notion thousand-tasks way."
- **The wellbeing culture**: check-ins, "I wouldn't like you two working on a holiday," protecting Payton's rest, VAT decisions framed as protecting payroll. The agent system should be measured against this, not just output.

---

## 4. What's breaking

1. **One-human loop.** All agent conversations route through Garrett; his 10-day trip parked everything ("bid-decision field stuck on 'no-go'" while proposals were due). Onboarding Lamis + Jamie is logged as overdue in PaM (due Jul 8).
2. **Broadcast fatigue, zero closure.** Opsy warning/resolved pairs for the same known creaseworks/supabase-pilot slowness (root-caused June 12; the fix — flip marketing pages from `force-dynamic` to `revalidate=300` — still awaits Garrett's approval); Biz's daily 1am posts into #funding-opportunities with no reactions; the "awaiting biz review" list growing 18 → 23; six credential checks ("supabase-nordic, neon-pools, vercel-deployments, github-actions, stripe-webhooks, cf-worker-analytics") asked for weekly and never actioned.
3. **Promised automations not firing.** Friday PaM digest to #whirlpool: told to Maria June 23, not observable on 6/26, 7/3, or 7/10. "PaM sweeps this channel after and logs the commitments" asserted in agenda text with no sweep posts visible. Trust in the agent layer erodes fastest when humans are told an automation exists and it doesn't.
4. **The keystone config fix is still open.** meet-transcript-ingest (503) + rfp-gmail-scanner (500): add `https://www.googleapis.com/auth/drive.readonly` (and `gmail.modify`) to the service account's domain-wide delegation in Workspace Admin, and set `GOOGLE_IMPERSONATE_SUBJECTS=garrett@windedvertigo.com` on wv-port. Opsy confirmed the transcripts are sitting in the right folder; the code is correct. Backfill with `?sinceDays=N` afterwards.
5. **Memory hygiene.** ~110k of the 159k characters in Mo's briefing are scraped journal tables-of-contents from two polluted cARL insight entries — Mo's context is two-thirds junk. Plus: 13 RFP names duplicated (65 extra rows), stale Mo keys from June 5 (WTG "top priority" never submitted, PPCS "due late June"), a data-quality check that throws `[object Object]`.
6. **TToC not in the machines.** The rubric exists in Notion; agents don't consult it. Biz scores go/no-go on fit + P-win but not on mission alignment; the survival-vs-mission filter lives in meeting notes, not in the pipeline.
7. **Voice is wired but wobbly.** Calls eject ~9–40s in ("Meeting has ended" Daily error) after the Cartesia→Vapi switch, plus Cartesia billing rejections that would give a live caller dead air. Walking 1:1s with agents — the single best "light touch" idea you have — is blocked on this.

---

## 5. Aligning agents with the transformational theory of change

The TToC ("Play is the technology. Justice is the direction. Aliveness is the destination.") is unusually operationalizable because it already contains falsifiable hypotheses, transformative outcomes, and a three-tier project rubric. The move is to make it **infrastructure, not literature**:

- **Build the `ttoc_gate` tool** on the shared MCP server (all agents can call it): input = an opportunity/commitment/campaign; output = a scored card against the Must Have criteria (serves ≥1 Transformative Outcome, centres justice, aliveness-aligned, team genuinely energised), Should Haves, Clear Rejections, plus a **survival-vs-mission tag** (the Nordic precedent: survival work is legitimate, but it must be labelled). This is Jamie's July deliverable ("finalize the TToC into a decision tool") given a permanent home — his rationale page stays the canonical text; the tool cites it.
- **Wire it into three places first:** Biz's go/no-go scorecard (mission alignment as a scored dimension next to P-win — a 52/100 defer should say *why* in TToC terms); PaM's intake (every new commitment gets the survival/mission tag and a shepherd); Mo's campaign briefs (the claim-boundary rule — market conditions, never outcomes — is a TToC-derived guard that should be checked mechanically, like Maria's Biz gates).
- **The deeper alignment is in the interaction design itself.** Your TToC says transformation requires "distributing safety to fail" and low-stakes environments where "error feels like information, not failure." Apply that to the agent system: agents that nag, pile up red overdue lists, and broadcast unclosed alerts create a *high-stakes* interface. The PaM posture ("never guilt-trips") has it right — the whole system should feel like metabolisable uncertainty, not a compliance dashboard. Concretely: cap what agents surface (see Section 7), close every loop visibly, and celebrate finished work in the digest before listing asks.
- **Agents should also unlock *human* creativity, not just throughput** — your words: "help unlock our human creativity." That means agents default to preparing raw material for human judgment (three options + a recommendation + the evidence), never shipping final creative output. The FruitStand direction (hand-crafted assets over AI imagery, "we are also f***ing weird — find our voice") is a brand decision the agents should be told about explicitly: Mo's memory should carry "human aesthetic is a differentiator; AI drafts words and structure, humans make the artifacts."

---

## 6. Do you need more agents? Mostly no — here's the test

Jamie's scaling lesson from his own stack is the right rule: "try not to have a super agent, but also don't get out of hand and have a million mini agents… have really clear boundaries and scopes." Create a new agent only when there's (a) a distinct **lane** no current agent owns, (b) a distinct **memory** worth accumulating, and (c) a distinct **rhythm** of autonomous work. By that test:

**Don't create now — extend instead:**
- Consortium knowledge-graph / canonical-CV work → cARL + Biz extension (Maria's voice-interview intake feeds it).
- Meeting-notes ingestion → infrastructure (the pipe), not an agent.
- TToC gate → shared tool, not an agent. A "TToC agent" would recreate the bottleneck with extra steps.
- Time-off/calendar tracking → PaM (already assigned).

**Genuine future candidates (in priority order):**
1. **A delivery/QA verifier for client work** (working name: "Vera") — owns the triangulation/adjudication pattern you built for Amna (Coder A / Coder B / expert-persona cARL), the named-human-verifier ledger, and client-facing claim traceability. This becomes acute as Amna scales and as "AI workflow integration" becomes a *service you sell* (the Lamis × Garrett July 9 insight) — you'll want your own QA machinery productized. Trigger: when a second client engagement needs the verification workflow.
2. **A conference producer** for play,fair October 2027 — distinct lane, long memory, real deadlines. Trigger: when conference deep-work starts in earnest (you deferred it to late July; a producer agent makes sense around September, seeded with Mo's strategy draft).
3. **A librarian/canon-keeper** — owns the glossary, the canon channel, brand + AI guidelines, assumption logs, and the "no drift, no trace" problem Jamie named. Trigger: after the shared-GitHub-repo centralization decision (July 6) is implemented, if drift persists.

Also worth naming: **Fin and Mo have no Slack surface at all**, and Fin barely appears anywhere. Before adding agents, give the existing six full presence (Section 7) and see what's still missing.

---

## 7. Around-the-clock, without the firehose: the operating rhythm

The design principle: **agents work at night; humans get one well-shaped touch a day, one deep touch a week, and interrupts only for genuine gates.** Light touch ≠ many touches.

**Per-agent heartbeats (scheduled, not prompted):**

| agent | overnight/continuous | daily | weekly |
|---|---|---|---|
| Opsy | 5-min health checks, auto-fixes (exists) | triage pass + threaded resolves (exists — keep) | Sunday ops digest (exists; add "decisions needed" as the *first* line) |
| Biz | RFP radar ingest (exists) | 1am triage **with aging rules**: radar items past deadline auto-archive; anything unreviewed 14 days auto-defers with a one-line reason. The queue must never rot to 119 days again. | Friday pipeline digest: 5 lines — new high-fits, deadlines <7d, decisions needed |
| PaM | sweep #whirlpool + meeting notes for commitments (build it — it's asserted but not firing) | — | **Friday 10am digest to #whirlpool** (make the promised one real): done this week / due next week / blocked / one ask per person |
| Mo | — | — | Monday strategy note ahead of whirlpool: pipeline delta, campaign status, one decision needed |
| cARL | weekly study job (exists) | — | digest of new findings routed to the relevant human (Jamie research, Maria facilitation, Payton evidence-posts) — with the ingestion bug fixed so it never dumps journal TOCs into memory again |
| Fin | — | — | Friday cash + AP/AR + payroll note to Garrett (owner-only), monthly to collective |

**The one daily touch:** a single **8am collective digest** (PaM compiles from all agents' overnight logs) posted to #general or a new #daily-brief: max 7 lines, wins first, then deadlines, then *at most one ask per human*. Everything else stays on dashboards for pull, not push. This replaces reading five bot channels.

**The escalation ladder (when agents may interrupt):**
1. FYI → dashboard only (default)
2. Daily digest line
3. Slack post in the topic channel (threaded, must be closed with a resolve note — Opsy's pattern, adopted by all agents)
4. DM to the shepherd (not always Garrett — route by RACI)
5. DM + phone-worthy: only for hard gates (submission deadlines <24h, security criticals, client-visible breakage)

**Anticipation (agents proposing, not just reporting):** once the meeting-notes pipe is live, agents read every internal meeting within minutes. Then: PaM extracts commitments and *proposes* the assignment list for human confirm (one tap, not one meeting); Biz cross-references new RFPs against the TToC gate and team capacity from PaM before surfacing them ("high fit, but Maria is at WIP limit and it lands during Lamis's leave — recommend no-go"); Mo drafts the whirlpool agenda from actual meeting threads (fixing the "~half right" agenda drift); cARL notices recurring questions in transcripts and queues studies unprompted. This is "anticipate our needs" made concrete — and it all hangs on the one delegation-scope fix.

**Expert-in-the-loop gates (make the July 8 pattern universal):** every substantive agent output ships with (a) a named human verifier, (b) source citations (cARL's rule), (c) an explicit confidence/traceability note (already on the Biz roadmap as BIZ-C1/C2 — prioritize those two upgrades), and (d) a visible "what the human changed" delta so the agents learn. Where a norm matters, enforce it in code like Maria did, not in prompts.

**Interaction surfaces per human** (from the Payton × Garrett onboarding note — this was right, finish it): Slack for quick asks, port dashboards for state, Cowork for building, voice for walking check-ins. Onboard Lamis and Jamie this week (the overdue commitment); give Maria the recognition and the mandate as agent steward #2 — she's already doing the job. Ask August for one thing only: the ClickUp/Linear/Moniker recommendation with a deadline, or explicitly park it.

---

## 8. Protecting your lives while the agents work

- **The system observes capacity, not just deadlines.** PaM's time-off calendar (already assigned) + WIP limits per person (cARL filed the evidence for exactly this) → agents stop surfacing asks to anyone at their limit or on leave. Lamis should have received zero asks July 5–14; make that mechanical.
- **Quiet hours by default.** Agents post digests at 8am PT; nothing pushes to humans evenings/weekends except ladder-level-5 gates. The agents genuinely work around the clock — the humans shouldn't feel it.
- **Walking-first check-ins.** Fix the Vapi/Daily ejection and Cartesia billing (Opsy has both incidents open), then run the Phase 1 plan: weekly 30-min voice 1:1s (PaM commitments, Mo strategy, cARL learning) and ad-hoc bike/walk calls. Payton's 45–90-min podcast digest of team activity is the same idea for listening — ship it as a cARL/Mo collaboration.
- **Measure the right thing.** Add two lines to the weekly PaM digest: hours of human time the agents saved this week (estimate), and hours of human time the agents *consumed* (reviewing, fixing, closing their loops). Maria named maintenance as "hidden workload" — track it, and let the survival-vs-mission lens apply to your own tooling: agent work that only feeds the agents is survival work, cap it.
- **Keep the whirlpools for play.** Garrett's own note — "sometimes I feel like we're doing a little too much deliberation… we need to balance that with just play." The whole point of the async/digest layer is that synchronous time goes to playing, designing, and the vulnerability-interviews you've started, not status.

---

## 9. Roadmap

**This week (mostly config + hygiene, ~half a day of Garrett + one Opsy/Cowork session):**
1. Workspace Admin: add `drive.readonly` + `gmail.modify` to the service account's domain-wide delegation; set `GOOGLE_IMPERSONATE_SUBJECTS` on wv-port; backfill transcripts since June 24. *(unblocks the meeting-notes pipe AND the RFP Gmail scanner)*
2. Onboard Lamis + Jamie (repo clone + Cowork agent conversations — the overdue July 8 commitment). Lamis is back from leave today.
3. Make the Friday PaM digest real; announce it once it has actually fired.
4. Hygiene sweep: purge the two polluted cARL entries from Mo's memory + patch cARL's ingestion; run the RFP dedup SQL; refresh Mo's stale June 5 keys; fix the `[object Object]` check.
5. Biz queue triage with the new aging rules — take "awaiting review" from 23 to ~5 real items.
6. Approve the known wv-site/creaseworks caching fix (`revalidate=300`) and hand Opsy the six missing credentials (or explicitly descope those checks so the ask stops repeating).

**This month:**
7. Jamie ships the TToC decision tool → encode as the shared `ttoc_gate` MCP tool; wire into Biz scoring, PaM intake, Mo briefs. Add survival-vs-mission tags everywhere.
8. Stand up the daily 8am collective digest + adopt the escalation ladder; give Mo and Fin their weekly Slack notes.
9. Prioritize Biz upgrades BIZ-C1 (inline citations) + BIZ-C2 (traceability score) + BIZ-G4 (delta alerts); make the named-verifier field standard on all agent outputs.
10. Fix voice (Daily ejection + Cartesia billing), then pilot weekly walking 1:1s.
11. Ship the strategy-brief write tab on /mo (already specced) — the port's first human write surface, so the team can edit strategy without a Cowork session.

**This quarter:**
12. Consortium infrastructure: voice-interview intake → canonical CVs → knowledge graph (cARL + Biz extension); this is also the IDB/LTP value exchange.
13. Federate with Jamie's port (shared memory across everybody's agents — "My Pam could talk to your Pam") with the privacy rule kept: log to the collective only when told.
14. Revisit the new-agent question with real data: delivery/QA verifier if a second client needs the Amna machinery; conference producer ~September.
15. Package what you've built as the sellable offering Lamis spotted ("automate, but in a really clever way" — for Amna first). Your own operating system becomes the product demo.

---

## 10. One-line answers to your questions

- **Work together more effectively?** Onboard the other four humans, route by RACI shepherd instead of through Garrett, and close every agent loop visibly.
- **Unlock human creativity + align with the TToC?** Agents prepare options and evidence, humans make the artifacts; encode the TToC rubric as a gate every agent calls; design the agent interface itself to be low-stakes (that *is* your theory of change, applied to yourselves).
- **More agents?** Not yet. Extend cARL/Biz/PaM; revisit with the three-part test (lane, memory, rhythm) in September.
- **Interactive without prompting?** Fix the delegation scope, ship the meeting-notes pipe, put every agent on a heartbeat, and let them propose rather than report.
- **Light-touch, expert-in-the-loop?** One 8am digest, one Friday wrap, a five-level escalation ladder, named verifiers on everything, hard gates in code.
- **Build the business while enjoying life?** Quiet hours, WIP/leave awareness in the agents, walking 1:1s, and track the maintenance burden so the agents stay net-positive on your time.
