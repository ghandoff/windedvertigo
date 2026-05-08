# operationalizing the pipeline-stage counts

> companion to `port/docs/social-media-integration-plan.md`. social-media-integration covers WHERE follower / subscriber numbers come from. this doc covers WHO updates the 5 pipeline-funnel counts (awareness → engagement → conversation → proposal → contract) and HOW they flow into the strategy page.

written 2026-05-05. reflects current state after the strategy playdate.

---

## the five counts in question

these are the bars rendered on the pipeline tab of port.windedvertigo.com/strategy, each with a target and a coloured progress bar:

| stage | metric | target | source today |
|---|---|---|---|
| awareness | outreach touches sent | 30/week | nothing — bar reads "awaiting first input" |
| engagement | content pieces published | 4/month | nothing — same |
| conversation | meaningful replies/conversations | 8/month | nothing — same |
| proposal | proposals in flight | 2–3 at any time | hardcoded `2` (oxfam + unicef) |
| contract | contracts signed this month | 2/month | hardcoded `1` (prme) |

today they live as constants in `port/lib/strategy-data.ts → PIPELINE_PROGRESS`. proposal + contract have real values; the top three are `null` and render an "awaiting first input" pill.

---

## the operationalization problem

each of these counts belongs to a different person and a different rhythm:

- **awareness** (30 outreach touches/week) — garrett owns the warm-network outreach. payton handles cold outreach. neither tracks "touches sent" anywhere centrally today; they just send messages and the artifacts live in gmail or linkedin sent folders. counting requires the sender to log it.
- **engagement** (4 content pieces/month) — payton schedules instagram + bluesky + linkedin posts. jamie writes substack. there's no shared content calendar that emits a count.
- **conversation** (8 meaningful conversations/month) — garrett's pipeline conversations live in port (rfp lighthouse + the campaigns kanban). conversations from inbound dms, conference follow-ups, etc. don't have a home.
- **proposal** (2–3 proposals in flight) — port already knows this. the rfp_opportunities table has `status = "pursuing"`. queryable today.
- **contract** (2 contracts signed/month) — port knows. `rfp_opportunities.status = "submitted"` filtered by month + win.

so two of the five are **already in port's database** and could be queried directly. the other three need a system.

---

## recommendation: three-tier operationalization

### tier 1 — already automatable from port (proposal + contract)

these two should NOT be hardcoded. wire them to supabase queries on the strategy page server component:

```sql
-- proposals in flight
select count(*) from rfp_opportunities
where status = 'pursuing' and proposal_status not in ('failed', 'complete');

-- contracts signed this month
select count(*) from rfp_opportunities
where status = 'submitted'
  and updated_at >= date_trunc('month', current_date);
```

ship this as `getPipelineProgress()` in `port/lib/marketing/pipeline-progress.ts`. strategy page reads it server-side, the funnel renders the live count instead of the hardcoded value. zero manual entry.

complexity: ~half a day of dev. no new ui. the "current" field on the strategy-data constants becomes derived rather than hardcoded.

### tier 2 — quick weekly form for the three manual ones (awareness + engagement + conversation)

build the same admin form pattern proposed in the social-media-integration-plan for substack + instagram. add a small "weekly numbers" form to `/strategy?tab=pipeline` (admin-only, behind a button). fields:

- outreach touches sent this week (number)
- content pieces published this month (number)
- meaningful conversations had this month (number)
- (auto-stamped: who entered it, when)

writes to a new supabase table:

```sql
create table pipeline_progress_entries (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,           -- 'outreach_touches' | 'content_pieces' | 'conversations'
  value integer not null,
  period_start date not null,         -- monday of the entry's week
  period_end date not null,           -- sunday
  entered_by_email text not null,
  entered_at timestamptz not null default now()
);
create index on pipeline_progress_entries (metric_key, period_end desc);
```

the strategy page reads the latest entry per metric. shows when it was last updated + by whom. if no entry in the last 14 days, the bar drops back to "awaiting first input" with a soft "stale — refresh me" pill.

complexity: ~1 day of dev. reusable form pattern (substack + instagram + linkedin will use the same shape). can be a single component parameterized by `metricKey`.

cadence: garrett or payton (whoever is doing the weekly cmo review on wednesdays) types in the three numbers in 60 seconds. takes 10 entries (52 weeks × 3 metrics ÷ 16 if monthly cadence on engagement+conversation) per quarter. low friction.

### tier 3 — automatic counters where possible (later)

a portion of the manual numbers can be automated incrementally:

- **outreach touches** — port already tracks email sends via `email_drafts`. if all of garrett's warm outreach + payton's cold outreach is sent through port (not gmail directly), the count is `select count(*) from email_drafts where created_at >= start_of_week and sender_id in (...)`. requires the team to send via port, which is a behavior change but a worthwhile one — port is supposed to be the system of record for outreach.
- **content pieces** — once an editorial calendar lives in port (post-phase-2 of social-media-integration-plan), each scheduled post is a row. count is automatic.
- **meaningful conversations** — harder to automate. could approximate via "rfp_opportunities created in the last 30 days where status = 'reviewing' or higher" plus inbound enquiries logged as port deals. probably requires a "conversation" entity to be added if it ever matters enough.

these are q3 work, not now.

---

## how to render the funnel after this lands

once tier 1 + tier 2 are shipped, the funnel progress bars become trustworthy and the bar colour math (red < 50 % / amber 50–75 % / green > 75 %) actually means something. the strategy page can also surface:

- the **last-updated timestamp** under each progress bar ("entered by garrett, may 5")
- a **"refresh now" link** next to stale bars
- a small **"entered by" leaderboard** in the team pulse (extra visibility on who's actually logging numbers)

---

## the one thing this doc does not solve

**should the team be tracking these numbers at all?** that's a strategic question, not an engineering one. if the team is going to ignore the funnel bars no matter how cleanly they're wired, the cleanest engineering work is wasted. recommend confirming buy-in at the next monday standup before tier 2's admin form is built. tier 1 is no-cost — proposals + contracts numbers should be wired regardless.

if the answer is "the wednesday cmo review will cover this," then tier 2's form should be a 60-second button on the strategy page that pre-fills last week's numbers as defaults, so the friction is essentially "review + nudge + save."

---

## next concrete actions for garrett

- [ ] **decide buy-in** — at next monday standup, get explicit "yes, we'll log these weekly" or "no, drop the manual three" from payton + lamis + maria
- [ ] if yes: **build tier 1** (auto-query proposal + contract counts from supabase) — half a day, no manual entry needed, immediate value
- [ ] then: **build tier 2** (the weekly form for awareness + engagement + conversation) — 1 day, ships a reusable form pattern that 4 other kpis later piggy-back on
- [ ] revisit tier 3 (automatic counters) in q3 once outreach + content workflows are stable
