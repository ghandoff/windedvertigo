# populating the Mo, PaM & cARL dashboards

> written 2026-06-05. a playbook for pre-loading the three agent dashboards with
> current, relevant w.v work so ongoing conversations start from real context.

## where things stand today

| agent | dashboard | what's there | what's empty |
|-------|-----------|--------------|--------------|
| **Mo** | `/strategy` (+ Mo's log tab) | 11 working-memory keys, the strategy data | only **1 decision** logged — the log is nearly bare |
| **PaM** | `/pam` (board + timeline) | 7 memory keys (per-person summaries) | **0 commitments** — board and Gantt are empty |
| **cARL** | `/carl` (library) | 4 memory keys (domains, frameworks) | **0 findings** — the living library is empty |

memory keys are summaries ("garrett-commitments: WTG draft, PPCS architecture…").
they're useful, but the *boards* — the commitments PaM tracks, the findings cARL
collects, the decisions Mo logs — are what make the dashboards alive. this
playbook fills those.

there are three ways to populate, and you'll use all three over time:

1. **conversational** — talk to the agent in cowork/claude code; it logs as you go.
2. **bulk pre-load** — a one-time reviewed seed so the dashboards aren't empty on day one.
3. **ongoing hygiene** — the habits that keep them current.

---

## 1 · Mo (CMO) — keep the decision log alive

Mo's memory is current; what's thin is the **decision log** (the audit trail of
strategy calls). every whirlpool or strategy chat should leave a trace.

### conversational scenarios

> **after a whirlpool:** "Mo, log today's strategy decisions: we're prioritising
> the WTG proposal this week over new outreach; we're holding cold outreach until
> the harbour campaign lands; payton owns the harbour social push. tag these
> pipeline + harbour."

> **when a number moves:** "Mo, update memory — pipeline-total is now $X of
> $500k; wtg-status moved from 'not submitted' to 'submitted june 9'."

> **weekly, on monday:** "Mo, here's what shipped last week and what's in focus
> this week — log it as a decision and refresh the relevant memory keys."

### bulk pre-load (proposed — review before I run it)

Seed ~6 recent strategy decisions so the log reflects the last two weeks
(harbour launch, WTG prioritisation, PPCS report scope, proposal pipeline
status). I'll draft them from the existing `docs/cmo/` brain + the memory keys
and show you the list before writing anything.

---

## 2 · PaM (PM) — turn the per-person summaries into a real board + Gantt

This is the biggest gap. PaM's memory already knows roughly who's doing what; we
turn that into **discrete, dated commitments** so the board has cards and the
timeline has bars (with dependencies).

### conversational scenarios

> **the whirlpool dump (fastest way to fill it):** "PaM, here's what everyone
> committed to in Wednesday's whirlpool — log each as a commitment with who,
> what, a start and due date, and note the dependencies:
> - garrett: draft & submit the WTG proposal, this week
> - jamie: finish the PPCS narrative arc review by next wednesday — maria's
>   interactive experience and the report both depend on it
> - maria: build the PPCS interactive experience once jamie's arc lands
> - payton: harbour social campaign, rolling through june
> - lamis: storytelling/comms pass on the PPCS report once there's a draft"

> **personal check-in:** "PaM, what's on my plate? move 'wire strategy dashboard'
> to done and add a new one: 'PPCS report architecture', starting monday, due the
> 18th."

> **from a Mo decision:** "PaM — Mo just decided we're prioritising WTG this week.
> create the commitment for garrett and set it as the week's top priority."

### bulk pre-load (proposed seed — review before I run it)

This turns the 5 `*-commitments` memory keys into ~12 dated commitments with a
few finish-to-start dependencies, so the board fills and the Gantt shows real
lanes + arrows. **Dates are my proposal from today (2026-06-05) — you set the
real ones.**

| who | what | start | due | depends on |
|-----|------|-------|-----|-----------|
| garrett | draft & submit WTG proposal | 06-05 | 06-12 | — |
| garrett | PPCS report architecture | 06-08 | 06-18 | jamie's narrative arc |
| garrett | wire strategy dashboard | 06-03 | 06-09 | — |
| jamie | PPCS narrative arc review | 06-05 | 06-11 | — |
| jamie | substack post — threshold concepts | 06-12 | 06-19 | — |
| maria | harbour QA framework | 06-05 | 06-13 | — |
| maria | PPCS interactive experience | 06-12 | 06-22 | jamie's arc + garrett's architecture |
| maria | threshold-concepts facilitation design | 06-15 | 06-25 | — |
| payton | harbour social campaign | 06-05 | 06-19 | — |
| payton | linkedin content series | 06-08 | 06-26 | — |
| lamis | storytelling/comms — PPCS report | 06-16 | 06-24 | PPCS report architecture |
| — | (a due-only item to show a diamond) PRME forum submission | — | 06-26 | — |

Once you bless the names/dates, I run it as POSTs to `/api/pam/commitments`
(with `depends_on` wired by id) — the board and Gantt populate immediately, and
PaM-the-agent reads the same rows.

### ongoing hygiene

- PaM logs new commitments **during** conversations, not after.
- mark things done as they finish ("PaM, that's shipped — mark it done").
- the timeline's drag-to-reschedule keeps dates honest without retyping.

---

## 3 · cARL (research) — seed the living library

cARL knows its **domains** (memory) but has logged **0 findings**. The library
becomes useful once it holds distilled, practice-connected findings.

### conversational scenarios

> **after reading something:** "cARL, log a finding — domain: threshold concepts;
> title: Meyer & Land on troublesome knowledge; summary: learners get stuck at
> 'portals' that are counter-intuitive and irreversible once crossed; relevance:
> this is exactly the moment rhythm.lab should design *for*; tag music, thresholds."

> **serving a builder:** "cARL, maria's designing bias.lens — what does the
> research say about teaching cognitive bias to adults, and log the useful bits
> as findings connected to bias.lens."

> **the weekly digest:** "cARL, give me 3 findings relevant to what the team is
> building this week, and add any that aren't already in the library."

### bulk pre-load (proposed seed — review before I run it)

~6 starter findings, one per active domain, each connected to a harbour app or
current proposal — drawn from the frameworks already in cARL's memory (Meyer &
Land, Kolb, Freire, McLuhan, upaya/embodied cognition). I'll draft the list for
your review, then POST to `/api/carl/findings`.

### ongoing hygiene

- cARL's scheduled study time should end with "…and log what you found."
- every finding should name its **relevance** — the bridge to practice is the point.

---

## running the seeds

When you've reviewed the proposed tables above, say the word and I'll execute the
bulk pre-loads (PaM commitments + cARL findings + Mo decisions) against the live
API, then confirm the dashboards are populated. Nothing gets written to standing,
people-attributed data until you approve the names and dates — that's deliberate.

A lighter alternative: skip the bulk seed entirely and just use the
**conversational** prompts above in your next whirlpool — the agents fill their
own dashboards as the collective talks. The bulk seed is only to avoid a
cold-start.
