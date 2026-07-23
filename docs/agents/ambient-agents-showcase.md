# the night shift — what the ambient agents actually do
_the canonical plain-English explainer of winded.vertigo's six executive agents · written 2026-07-23 from a live smoke-test run · companion to `executive-ambient-agents-status.md` (engineering state) and `executive-charters.md` (Garrett-only governance)_

**Visual one-pager (shareable with the collective):** https://claude.ai/code/artifact/12c31e3b-b0a6-4ef0-b62a-3fe224525eae

> Every figure, quote, and flag in this document is **real output** from a live run on 2026-07-23.
> Nothing here is illustrative or staged.

---

## the short version

Six executive agents — Mo, PaM, cARL, Fin, Biz, Opsy — no longer wait to be asked. They **watch,
evaluate, and then act, ask, or stay quiet** on their own. Each has a beat it watches and a small set
of things it's allowed to do. Nothing external, financial, or client-facing happens without a human
yes, and hard caps (≤3 nudges per agent per day, ≤5 per person per day) mean nobody gets buried.

---

## the smoke test — 6/6 healthy

All eleven spine endpoints were fired once against real data. Every one returned cleanly; nothing is
broken. What each agent did in that single run:

| agent | what it did | outcome |
|---|---|---|
| **Fin** | found **8 overdue money items** — payroll 22 days late, a $443.83 ADP fee, and a catch: *a $50K invoice not in QuickBooks (AR shows $0)* | posted a digest |
| **Mo** | posted the **Friday pipeline scorecard** ($260,200 across 8 deals); noticed the content queue was empty and **drafted a filler post** | 2 cards |
| **PaM** | **DMed 14 people** their open commitments; correctly found 0 new meeting actions and 0 absences | 14 sent |
| **cARL** | **reviewed 4 drafts** — cleared 3 as "opinion, no research claims", **flagged 1** for "sweeping strategic claims without empirical support" | 1 flag (held) |
| **Biz** | proposed values for **4 RFPs**: FCA DICE $120k, two UNESCO Jordan $15k, UNICEF LTA $150k — each with a rationale | 4 proposals (held) |
| **Opsy** | analysed every agent's track record, found nothing over threshold, and **correctly stayed silent** | silent, by design |

"Held" means budget-suppressed — see *how they work together*, below. Held work is recorded in
`/inbox`, never lost.

---

## the six agents

### Mo — marketing
- **watches:** the content queue, the sales pipeline, brand claims in drafts.
- **does:** drafts posts when the queue runs dry, reports the pipeline number on Fridays, flags
  off-brand or overreaching copy.

### PaM — projects
- **watches:** meetings, promises ("I'll do X by Friday"), deadlines, who's away.
- **does:** turns meeting talk into tracked commitments, DMs owners to confirm (that confirmation
  *is* the human gate — PaM never commits anyone to work), sends each person their weekly list,
  proposes redistribution when an absence collides with deadlines.

### cARL — research integrity
- **watches:** everything queued to publish, strategic claims made anywhere.
- **does:** checks claims against the findings evidence base, flags overreach, suggests better
  sources — and stays quiet on pure opinion.

### Fin — finance
- **watches:** bills, invoices, tax deadlines, recurring obligations.
- **does:** surfaces what's overdue or coming due before it slips. Only speaks when there's something.

### Biz — business development
- **watches:** the RFP pipeline, go/no-go fit, submission deadlines.
- **does:** scores opportunities, and proposes the missing dollar values so the pipeline can actually
  be weighed. On approve, the value is written to Notion (the source of truth).

### Opsy — chief of staff
- **watches:** the other five agents' track records, and platform health.
- **does:** grades each behaviour and proposes when one has earned more autonomy — or has gone noisy,
  mis-targeted, or suspiciously quiet. Opsy only ever *proposes*; granting autonomy is Garrett
  editing the charter.

---

## how they work together

The honest picture: they coordinate through **shared tables, not conversations**. That's already
real, and it's more than it sounds.

**What is wired today:**
1. **One message, many minds.** A single Slack post in a watched channel is evaluated by Mo *and*
   PaM independently — each decides via its own charter whether it's worth a word.
2. **A shared sense of your attention.** All six draw from one budget (≤5 nudges per person per day).
   When it's spent, later agents defer and queue instead of pinging. This is the closest thing to
   real coordination in the system.
3. **A real research loop.** Mo or Biz can request a research topic; cARL studies the live literature
   and the finding is delivered back into the asker's own memory/dashboard. (Note: the return leg is
   implemented for Mo and PaM; Biz can request but has no return path yet.)
4. **A watcher over all of them.** Opsy reads every agent's interventions and reports patterns to
   Garrett — the mechanism by which behaviours earn independence.
5. **A daily convergence.** The collective digest aggregates all six agents' outputs into one
   `#daily-brief`.

**What is NOT real yet** (designed in the charters, not built): agents handing tasks off to each
other in chains, the charter's generic agent→agent "task table" and its 2-hop rule, and cARL's
binding "block this from publishing" veto. The escalation ladder exists and works, but every level
terminates at a human — no rung routes to another agent.

### two moments from the live run
- **Mo wrote, cARL checked it — unprompted.** Mo drafted a post during the run; cARL then read the
  draft queue and flagged *that same draft* for unsupported claims. Nobody connected them; they met
  on the shared draft table.
- **They protected Garrett's attention, together.** Biz's 4 proposals and cARL's 1 flag were held
  back — not because they failed, but because Fin and PaM had already spent the daily attention
  budget. The later agents took a number and waited.

---

## how your workflow changes

Every proactive nudge arrives as a card with four responses:

| button | meaning |
|---|---|
| **approve** | yes — the agent carries it out |
| **edit** | you'll take it from here; nothing auto-runs |
| **redirect** | wrong person or wrong call |
| **ignore** | not needed |

- **Ignoring is a message, not rudeness.** Agents are scored on how often their nudges get acted on;
  a clean ignore teaches an agent to pipe up less about that kind of thing. Using the buttons *is*
  how you train them.
- **Silence is success.** An agent that says nothing on a quiet day is working correctly. Opsy will
  separately flag an agent that's *too* quiet when it should be firing.
- **Trust is earned visibly.** Nothing external, financial, or client-facing happens without your
  yes. As a behaviour accumulates clean, acted-on instances (~100), Opsy proposes graduating it to
  more autonomy — always your call.

---

## verification criteria — how to confirm each agent is doing its job

| agent | the promise | the signal to watch for | where to look |
|---|---|---|---|
| **Mo** | keeps the content engine fed + reports pipeline | a "drafted a filler post" note when the queue drops below ~2 weeks; a Friday scorecard | `/compose`, `#studio-comms` |
| **PaM** | nothing said in a meeting gets lost | within ~an hour of a meeting, the owner gets a "confirm you're taking this on?" card; a Monday DM of your list | your DMs, `/pam` |
| **cARL** | catches overreaching claims, ignores opinion | a 🔬 flag on a draft that overclaims — and silence on a pure opinion piece | `/inbox`, `/compose` |
| **Fin** | no money item slips | a 💷 digest listing real overdue items (spot-check against QuickBooks) | your DMs, `/finn` |
| **Biz** | the pipeline becomes weighable | a value-proposal card per valueless RFP; approve one → the value appears on that RFP's Notion page and the pipeline total grows | `/inbox` → Notion → `/opportunities` |
| **Opsy** | the collective stays honest | after ~2 weeks, a Monday digest naming a graduation candidate or a noisy agent — and nothing before there's a real pattern | your DMs, `/ops` |

**Best overall gauge:** `/inbox` (the live queue) and the acted-upon rate at
`GET /api/agent/interventions/metrics` — that ratio is how you feel whether they're earning their keep.

---

## the safety rails, in one place
- **Caps:** ≤3 proactive nudges per agent per day; ≤5 per person per day (shared across all six).
  Over-cap work is queued in `/inbox`, never dropped.
- **Risk tiers:** LOW = act, no gate · MEDIUM = act + notify, reversible · HIGH = preview card +
  explicit approval, and **default-deny on timeout** (no answer = it does not happen).
- **Never autonomous:** external publication, anything client-facing, anything financial or
  irreversible. No agent adjusts pricing or offers discounts, ever.
- **Staged rollout:** `AMBIENT_ROLLOUT_STAGE` (`sandbox` → `studio-comms` → `full`). Emergency stop
  is a one-value change back to `sandbox`.
