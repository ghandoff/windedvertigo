# research — evolving the executive agents into a human-agent collective
_deep-research sweep run 2026-07-24 (cowork cloud session, garrett) · 22 sources fetched, 110 claims extracted, top 25 adversarially verified (3-vote): 25 confirmed, 0 refuted · synthesized to 11 findings · commissioned as cARL/Biz/PaM-lens research on stages 3–5 of the agent-development ladder_

_suggested repo home: `docs/agents/agent-evolution-research-2026-07.md` · written in the Cowork sandbox, which cannot push — needs commit (md-discipline rule 3). Distilled versions logged to cARL/Biz/PaM memory keys `agent-evolution-research-2026-07` on 2026-07-24._

---

## the ladder this research serves

(1) summoned → (2) ambient, human-gated **(the six are here, at studio-comms)** →
(3) earned per-action-type autonomy → (4) agent↔agent coordination →
(5) integrated human-agent collective. The PA agent (see
`pa-agent-proposal.md`) is the designated stage-3→5 pilot.

## headline: the path is memory → learning loop → graduated autonomy

The verified literature converges on a sequence that maps almost exactly onto
what the spine already half-built:

1. **Memory is a lifecycle, not a log** *(high confidence — two independent
   surveys, 3-0 verified)*. The field's converged taxonomy: memory by temporal
   scope (working / episodic / semantic / procedural), substrate, control
   policy, and function — with an explicit **formation → consolidation &
   forgetting → retrieval** lifecycle. Append-only logs (our current
   memory/decision tables) accumulate; they don't learn. The recency-window
   fix that aged out the 232 stranded PaM items was, accidentally, our first
   "forgetting" mechanism — the literature says make that a design principle.
   [arXiv 2603.07670 · arXiv 2512.13564]

2. **Agents learn from intervention outcomes via outcome-reflection, no
   fine-tuning needed** *(high)*. The ERL pattern (ICLR 2026): after each
   task, reflect on the trajectory + outcome, distill a compact heuristic;
   at run time, selectively retrieve only the relevant heuristics into
   context. This is precisely implementable on `agent_interventions`: every
   approve / edit / redirect / ignore is an outcome signal; a nightly
   reflection cron could distill them into per-agent lessons injected at
   briefing time. Key ablation *(medium)*: **abstracted heuristics beat
   replaying raw history, and selective retrieval beats dumping everything
   into context.** [arXiv 2603.24639 · arXiv 2406.14596]

3. **Episodic-memory audit checklist** *(medium — one position paper)*: a
   long-term agent's memory should support long-term storage, explicit
   reasoning over memories, single-shot learning, instance-specific memories,
   and contextual relations (when/where/why bound to content). Useful
   acceptance criteria for any memory upgrade. [arXiv 2502.06975]

4. **Graduated autonomy has a working reference implementation** *(high)*.
   Hedwig (UW, ACM) learns evolving behavioral guidelines from approve/deny
   history, loosening oversight where trust is earned, tightening it outside
   familiar territory. Its **learned** oversight classifier beat a **static
   rules file at recall 1.00 vs 0.50** — the static config silently passed
   operations its own rules said to review. Directly relevant: our
   graduation mechanism (Opsy's) is currently threshold-static; a learned
   layer on top of the same approve/deny data is the literature's next step.
   Caveats: synthetic-persona evaluation (2 personas × 20 decisions), n=21
   formative survey. [arXiv 2605.11495 · ACM 3786335.3813223]

5. **Practitioners reject per-action gating** *(high, small n)*: 13/21
   experienced developers preferred check-ins at milestones or on
   risky/unexpected events only; **zero preferred per-action approval.** Our
   uniform preview-card gating is the right stage-2 posture but will over-ask
   five humans as volume grows — the promotion path off it is not a luxury.
   [arXiv 2605.11495]

6. **Autonomy is a per-agent design dial, with an objective promotion test**
   *(medium — single credible source)*. The L1–L5 ladder (operator →
   collaborator → consultant → approver → observer; our gated agents sit
   ~L3–L4) plus **"assisted evaluations"**: measure the *minimum human
   involvement* needed for the agent to clear an accuracy threshold — an
   objective basis for promotion decisions, better than vibes. Note the
   authors' own warning, which fits our governance: **higher autonomy is not
   inherently better; the ladder is a dial, not a destination.**
   [knightcolumbia.org · arXiv 2506.12469]

7. **Autonomy should vary by task and agent, not be uniform** *(medium,
   2-1 vote)*: systematic-review support for per-agent gating policies —
   e.g. Fin/Biz tighter than cARL. Our tier system already does this per
   action; the evidence supports extending it per agent. [arXiv 2504.10918]

## trust & team operations (stages 4–5)

8. **Transparency and reliability are the strongest trust drivers in
   human-agent teams** *(high — CHI 2025 review + systematic review)*.
   Invest in legibility before autonomy: visible reasoning, trigger
   references on every card (we do this), public outcome logs and
   reliability track records (partially — the metrics endpoint exists, a
   human-readable reliability surface doesn't). Also: **trust calibration is
   necessary but insufficient** — appropriate reliance requires designing for
   human cognition, not just accurate trust. [ACM 3706598.3713527 · arXiv 2504.10918]

9. **Long-term team improvement is a documented research gap** *(medium)*.
   Across 133 empirical human-agent teaming studies (2007–2024), team
   formation and long-term improvement are significantly underexplored.
   Translation: **there is no playbook for stage 5; our instrumented
   intervention outcomes are original evidence.** Design from first
   principles, keep instrumenting. [arXiv 2504.10918]

## the PA agent (stage-3→5 pilot)

10. **Index memory by event time, not dialogue time** *(medium)*. Most memory
    systems file facts under when the conversation happened — a core failure
    mode for tracking a life ("talked May 28 about a May 29 trip"). The
    Temporal Semantic Memory architecture (ACL Findings 2026): a temporal
    knowledge graph of (subject, relation, object, timestamp) facts,
    consolidated into durative topic/persona summaries that update as
    preferences change (80.77% on knowledge-update benchmarks). Direct schema
    guidance for the `garrett-pa` memory store. [arXiv 2601.07468 · ACL Findings 2026]

11. **The privacy boundary has a concrete governance checklist** *(medium)*:
    encryption at rest/in transit, per-user access scoping, automated PII
    redaction, configurable retention, and **auditable deletion across every
    tier including vector indexes and backups**. The literature specifies
    *what* to enforce, not how to partition stores — our separate-Supabase-
    project choice is a defensible answer to an open question. [arXiv 2603.07670]

## what the sweep did NOT find (honest gaps)

- **Industry practice is unverified terrain.** Sub-question 2 (what orgs and
  products actually do with mixed human-agent teams in 2025–26) produced
  **zero claims that survived verification** — only vendor narratives
  (McKinsey's "2–5 humans supervising 50–100 agents", Microsoft WorkLab) and
  product marketing. Treat agentic-org claims heard from clients/funders as
  unverified forecasts. Flip side (logged to Biz): our instrumented rollout
  is ahead of documented practice — original evidence with thought-leadership
  and service-line value.
- **Notification economics and shared-board patterns** for mixed teams are
  addressed only obliquely (check-in preferences, trust findings) — no direct
  empirical work surfaced. Our budget-cap design remains ahead of the
  evidence here too.
- **Field validation of learned graduated autonomy** (Hedwig-style) over
  months with real users doesn't exist yet — the PA pilot would be among the
  first real deployments.

## implications — proposed next build steps (in order)

1. **Reflection loop on `agent_interventions`** (the ERL pattern): nightly
   cron distills resolved outcomes into per-agent lessons (new `agent_lessons`
   table or memory keys); briefing/ambient runs selectively retrieve them.
   Cheap, high-leverage, uses data we already collect.
2. **Memory lifecycle pass on the six agents' tables**: add consolidation
   (periodic distill of memory keys) and principled forgetting (age-out
   windows like the sweep's 14-day fix, but by design).
3. **PA agent build** (see `pa-agent-proposal.md`) as the stage-3 pilot:
   TSM-style event-time memory, separate project, shared budget helper,
   Opsy's classifier pointed at its table. Build the **demotion path first**.
4. **Reliability surface**: human-readable per-agent track record (acted-on
   rate over time) on the dashboards — the trust literature says this is the
   cheapest trust builder available.
5. **Assisted-evaluation promotion tests** when any action type nears ~100
   resolved: measure minimum-human-involvement objectively before Opsy
   proposes graduation.

## governance notes for garrett

- cARL's domain vocabulary has no home for agent-platform research — the
  library rejected these findings. Propose adding a canonical domain (e.g.
  `opsy · agent platform`) — vocabulary changes are governance, yours.
- Autonomy-levels authors' caution, worth writing into the charters when
  stage 3 starts: higher autonomy is a design choice per action type, never a
  default trajectory.

## sources (verified-claim-bearing)

arXiv 2603.07670 (memory survey) · arXiv 2512.13564 + Shichun-Liu/Agent-Memory-Paper-List (memory survey #2) · arXiv 2603.24639 (ERL, ICLR 2026 wksp) · arXiv 2406.14596 (ICAL) · arXiv 2502.06975 (episodic memory position) · arXiv 2605.11495 + ACM 3786335.3813223 (Hedwig) · knightcolumbia.org levels-of-autonomy + arXiv 2506.12469 · ACM 3706598.3713527 (CHI 2025 trust review) · arXiv 2504.10918 (133-study HAT review) · arXiv 2601.07468 + ACL Findings 2026.1496 (TSM). Fetched but yielding no verified claims: McKinsey agentic-organization, Microsoft WorkLab, dust.tt, tianpan.co notification-budget essay, π-Bench (2605.14678), and 4 others — see the workflow journal for the full audit trail.
