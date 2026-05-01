# second-stock proposals — systems thinking simulator

phase 1 deliverable. for Maria's review before any code changes.

## overview

every scenario currently animates a single trajectory. the systems-thinking lesson "improving X sometimes breaks Y" is therefore invisible. this document proposes a secondary interacting stock per scenario, calibrated so the trade-off becomes legible without becoming a gotcha.

a pattern worth naming up front, because it shapes the proposals: **paradigm-level interventions tend to dissolve trade-offs rather than trade against them**. reframing purpose or identity often changes what "cost" even means. in scenarios where the paradigm shift wins (engagement, fitness, sleep, savings), the second chart rises or holds steady under intervention 5. where the winner is lower-tier (churn, burnout, supply-chain, plastic, capstone), the second chart shows what that win costs — which is precisely why those scenarios feel cheaper to pick and, often, are.

no secondary is a relabel of the primary. no intervention is uniformly punished. some interventions improve both stocks.

---

## 1. lakeshore college sustainability committee — anchor

- **primary**: total emissions (tons CO₂e/year, ↓ good, baseline 18,600)
- **proposed secondary**: political capital (0–2 index, 1.0 = neutral standing with committee, ↑ good, baseline 1.0)
- **pairing rationale**: every move toward net-zero costs the committee authority before it pays back; only one pays back more than it costs.
- **per-intervention secondary effects**:
  1. 40% parking permit price rise → **negative** (15% PC drop years 0–3 from commuter backlash, recovers to 1.0)
  2. 12-year heat-pump deployment → **negative** (20% PC drop during the ramp — disruption, capital controversy — recovers by year 8)
  3. living building challenge mandate → **mixed** (small 10% PC dip years 2–5 from construction-cost friction, steady thereafter)
  4. binding votes for student rep + town liaison → **negative** early (0.95 years 0–1 from chair pushback), then neutral
  5. re-charter institutional purpose → **mixed** (deep 0.70 drop in the first year as factions realign, recovers above baseline to ~1.30 as the new mandate attracts legitimacy)
- **lesson**: the only intervention that pays back *more* authority than it costs is the one that also bends emissions most. but for the first eighteen months, a re-charter looks like committee suicide.
- **note**: this replaces (or supplements) the existing horizontal political-capital meter. see phase 2 for the retirement decision.

## 2. curriculum review committee

- **primary**: faculty trust in the review process (0–100 trust index, ↑ good, baseline 62)
- **proposed secondary**: faculty workload per cycle (hours/faculty member/cycle, ↓ good, baseline 12)
- **pairing rationale**: trust rebuilds through work, not gestures. the interventions that close the broken feedback loop also draw on faculty time.
- **per-intervention secondary effects**:
  1. satisfaction survey after each cycle → **negative** (marginal: +1 hour of form-filling, signals attention without structure)
  2. publish transparent rubric → **neutral** (one-off authoring cost, then no ongoing load)
  3. rotate chair every two years via election → **negative** (election overhead + chair onboarding adds ~2 hours/cycle)
  4. require committee to implement its top recommendation → **negative** (biggest workload hit: faculty must now actually execute, +4 hours/cycle sustained)
  5. redefine mandate from "review" to "stewardship" → **mixed** (stewardship framing raises engagement willingly, but total hours climb ~3/cycle — the difference is that they feel voluntary)
- **lesson**: the interventions that rebuild trust are the same ones that ask faculty to carry more. the paradigm shift doesn't reduce the load — it changes whether the load feels like imposition or ownership.

## 3. student engagement

- **primary**: weekly active participation (% actively participating, ↑ good, baseline 34)
- **proposed secondary**: student participation anxiety (0–100 self-reported anxiety index, ↓ good, baseline 52)
- **pairing rationale**: the lever that raises visible participation most can be the one that terrifies the quietest students. engagement without anxiety is the real trade-off.
- **per-intervention secondary effects**:
  1. participation points in the rubric → **negative** (cold-call fear, rubric-driven performance; anxiety up ~8 points)
  2. weekly reminder emails with prompts → **negative** small (performance pressure without structural support)
  3. shorten lectures, add structured discussion → **mixed** (lower stakes per turn but more turns; net small negative early, neutral later)
  4. student-chosen assessment format → **positive** (autonomy lowers anxiety directly)
  5. reframe course purpose to "building capacity to act" → **positive** (changes what participation means so the stakes re-anchor; anxiety eases as performance pressure drops)
- **lesson**: the two lower-tier interventions raise participation and anxiety at the same time. the paradigm shift is the only move that raises one while lowering the other.

## 4. capstone quality

- **primary**: depth of capstone projects (0–100 quality index, ↑ good, baseline 45)
- **proposed secondary**: breadth of student topics (count of distinct topics across cohort of 60, ↑ good, baseline 18)
- **pairing rationale**: the intervention that raises quality most narrows what "capstone" can be about. depth and diversity pull against each other.
- **per-intervention secondary effects**:
  1. extend timeline by four weeks → **neutral** (more time, same distribution)
  2. publish rubric with exemplars → **negative** small (rubric-fit produces convergence toward worked examples)
  3. require midpoint draft + peer feedback → **neutral** (feedback structure is topic-agnostic)
  4. partner with external clients → **negative** (dominant intervention; students steered toward what clients need, topic count drops ~30%)
  5. reframe as public contribution to the discipline → **mixed** (publication pressure narrows topic selection early, broadens as students take larger swings in later cohorts)
- **lesson**: the move that changes the room (external clients) changes what gets asked in it. the quality gain is real; the breadth cost is also real. watching both charts lets students name the narrowing without losing the diagnosis.

## 5. saas churn — the load-bearing scenario

- **primary**: active paying customers (count, ↑ good, baseline 2,400)
- **proposed secondary**: revenue per customer (USD/month, ↑ good, baseline $80)
- **pairing rationale**: discounting retains customers but erodes margin per head. counting heads can disguise a bleeding ledger.
- **per-intervention secondary effects**:
  1. 20% discount on annual renewals → **negative** (the dominant intervention on primary; direct ~20% margin hit on retained accounts, sustained for the retention horizon)
  2. loyalty email sequence with usage tips → **neutral** (no pricing change)
  3. hire three support reps → **negative** small (fully-loaded support cost per customer rises ~5%)
  4. redesign onboarding so new users reach value in the first session → **positive** (higher activation raises perceived value, supports price stability; also the clean-trade-off rules-level winner — see teacher's-guide note below)
  5. reposition the product → **mixed** (short-term margin erosion as mismatched accounts churn; long-term margin lift as the newly-fit base arrives at higher willingness to pay)
- **lesson**: the move that saves customers isn't always the move that saves the business. the intervention with the cleanest secondary-stock profile (#4, onboarding redesign) is also the rules-level intervention — so the deeper lesson is not merely "paradigm doesn't win here" but "the winner is also the move that protects the other ledger." two structural virtues compounded.

## 6. team burnout

- **primary**: sustainable team energy (0–100 energy index, ↑ good, baseline 68)
- **proposed secondary**: sprint velocity (story points/sprint, ↑ good, baseline 40)
- **pairing rationale**: the intervention that saves the team appears to slow it down. watching both charts shows what "faster" was actually costing.
- **per-intervention secondary effects**:
  1. $500 quarterly wellness stipend → **neutral** (no velocity change, modest energy lift)
  2. no-meeting fridays → **positive** small (focus time lifts velocity ~5%)
  3. hire contractors → **positive** (direct velocity lift of ~15% while contracts hold)
  4. scope cap at 80% of capacity → **negative** in year 1 (visible velocity drop to ~32), recovering to ~38 sustained as defect rates fall and planning accuracy rises — the structural trade-off
  5. redefine success from "shipping features" to "sustainable delivery of value" → **mixed** (raw story-point velocity drops; by year 2, shipped value per sprint rises, but the metric changes shape)
- **lesson**: a scope cap looks like a velocity cut until you notice what was being counted as speed. the paradigm shift redefines the denominator, which is why it reads as confusing on the chart — and that confusion is the teaching moment.

## 7. supply chain transparency

- **primary**: share of verified tier-2 suppliers (% verified, ↑ good, baseline 12)
- **proposed secondary**: procurement cost index (1.00 = baseline unit cost, ↓ good, baseline 1.00)
- **pairing rationale**: transparency isn't free. the interventions that verify most aggressively change what supply costs — and who can afford to supply you.
- **per-intervention secondary effects**:
  1. three questions on the vendor intake form → **neutral** (no meaningful cost change)
  2. audit budget +30% → **negative** small (audit cost pass-through of ~2%)
  3. publish the full supplier list → **mixed** (dominant intervention on primary; brief exposed-supplier premiums, then normalisation as public pressure also surfaces cheaper verified options; net approx +1% by year 25)
  4. require tier-2 disclosure for preferred-supplier status → **negative** (compliant suppliers command a premium; sustained ~4% cost lift)
  5. redefine "preferred supplier" to include verified practices at every tier → **negative** initially, **mixed** later (first three years: ~6% lift; by year 10: a new market of compliant suppliers emerges, cost returns to approx 1.02)
- **lesson**: the dominant intervention (publishing) is cheap *because* it compresses the delay; the heavier-handed rules intervention is structurally correct but genuinely more expensive. the pairing shows that "higher tier" is not synonymous with "cheaper."

## 8. fitness

- **primary**: weekly workout consistency (sessions/week, ↑ good, baseline 1.2)
- **proposed secondary**: enjoyment of exercise (1–10 intrinsic-motivation scale, ↑ good, baseline 6.0)
- **pairing rationale**: rules-level structure gets you moving but can hollow out the why. the paradigm move does both.
- **per-intervention secondary effects**:
  1. better running shoes → **positive** small (comfort lift)
  2. gym membership → **neutral** (access change without habit change)
  3. personal trainer two sessions a week → **mixed** (accountability works; intrinsic motivation can erode as the behaviour becomes externally driven — sustained, this reads as mild negative)
  4. redesign your week → **negative** small (scheduling rigidity reduces play; ~0.5 points off enjoyment sustained)
  5. clarify why fitness matters to you → **positive** (intrinsic motivation *is* the intervention; enjoyment climbs to ~8.5 sustained)
- **lesson**: the interventions that force consistency via structure often buy it at the cost of the thing that makes exercise durable in the first place. the identity shift is the one that raises both.

## 9. sleep debt

- **primary**: average nightly sleep (hours, ↑ good, baseline 5.8)
- **proposed secondary**: self-reported daytime productivity (hours of focused work/day, ↑ short-term good, baseline 9.0)
- **pairing rationale**: the intervention that rebuilds sleep feels, for weeks, like it costs productivity — until the paradigm shift redefines what "productive" means.
- **per-intervention secondary effects**:
  1. blackout curtains → **neutral**
  2. bedtime reminder on phone → **neutral** (small positive, decays)
  3. melatonin before target bedtime → **positive** small (easier onset, mild morning sharpness lift)
  4. consistent 10:30 p.m. bedtime rule → **negative** (sustained drop of ~1.5 hours of self-reported focused work for ~6 months as evening output collapses; stabilises around year 1 to baseline)
  5. redefine productivity as "quality of decisions made when rested" → **positive** (self-reported "focused work" hours drop numerically, but the metric re-anchors: decision quality climbs; in this scenario, the curve rises because the measure is self-report of the new definition)
- **lesson**: the rules-level fix (bedtime rule) creates a visible six-month dip on the productivity chart — and the student can watch it recover. the paradigm shift dissolves the trade-off by redefining what the second chart is counting.

## 10. personal savings

- **primary**: months of expenses in buffer (months, ↑ good, baseline 0.8)
- **proposed secondary**: monthly discretionary spend (USD/month, ↓ short-term, baseline 400)
- **pairing rationale**: saving is literally a transfer from present self to future self. the charts make visible who paid what, so the "freedom fund" reframing has something concrete to land against.
- **per-intervention secondary effects**:
  1. high-yield savings account → **neutral** (container optimisation, no lifestyle change)
  2. monthly $200 auto-transfer → **negative** (direct $200/month cut to discretionary, sustained)
  3. cancel three unused subscriptions → **positive** small (frees ~$40/month of cash)
  4. split paycheque at source → **negative** (same $200 magnitude as auto-transfer, slightly less psychologically painful because unseen)
  5. reframe savings as a "freedom fund" → **mixed** (discretionary spend falls modestly as spending is filtered through new question, but what remains is spent more intentionally; the numerical cut is smaller than intervention 2 or 4, and the lived quality rises)
- **lesson**: the structural interventions buy the buffer by cutting discretionary. the paradigm shift buys a smaller buffer more slowly, but doesn't feel like deprivation — which is why it holds.

## 11. office plastic

- **primary**: weekly single-use plastic discarded (kg/week, ↓ good, baseline 24)
- **proposed secondary**: staff time spent administering the programme (hours/week, ↓ good, baseline 2)
- **pairing rationale**: the parameter interventions don't just fail to reduce plastic — they quietly add operational load. rules-level procurement discharges the programme.
- **per-intervention secondary effects**:
  1. more recycling bins in common areas → **negative** small (collection and sorting overhead, +1 hour/week sustained)
  2. awareness signage → **negative** small (campaign maintenance, re-postering; +0.5 hours/week)
  3. free reusable mugs and bottles → **negative** (replacement programme, distribution, lost-and-found; +1.5 hours/week)
  4. prohibit single-use plastic in all office procurement → **positive** (one-off procurement negotiation, then admin drops to ~0.5 hours/week — lower than baseline, because the ongoing programme has been discharged)
  5. redefine sustainability goal to "zero disposable culture" → **mixed** (scope expands across departments, initial admin lift, consolidates to ~1.5 hours/week by year 3)
- **lesson**: every parameter intervention adds a programme. the rules-level intervention removes the need for a programme. watching both charts makes visible why "more initiatives" is often the enemy of "less work, less plastic."

---

## notes for phase 2

- **Lakeshore meter retirement**: the horizontal political-capital meter becomes redundant when the secondary chart animates live with year-by-year data. recommended action: retire the meter in favour of the chart; preserve the year-by-year PC values in `state.politicalCapitalHistory` and feed them to the new secondary-chart pipeline. if the meter is to be kept for continuity, render it as a small sparkline next to the chart rather than the current bar. decision to confirm in the PR.
- **units and y-axis scales**: each secondary stock gets its own y-axis. no forced shared scale with the primary; the x-axis (2025–2050) stays shared.
- **no net-zero target line on secondaries** except potentially for office plastic (where 0 staff hours is aspirational but not set as a target). omit dashed target lines on all secondaries by default.
- **calibration principle**: secondary trajectories follow the same structural idioms as the primary — parameter changes sag and recover, rules changes produce structural shifts. no scenario's secondary should be a straight line; the pairing teaches nothing if the second chart doesn't move.
- **copy voice**: trade-off lines in the "why" block will be written in the existing dry literary tone. no moralising about "costs" or "sacrifice." a fact, stated plainly.

---

## awaiting Maria's review

holding on implementation until these pairings are approved, modified, or replaced. flag any scenario where the proposed secondary feels forced — I'll propose an alternative.
