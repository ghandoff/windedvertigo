# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-06-12 21:10 pt (context-sync autonomous run)

**where we are right now:** day 15 post-launch, and another heavy build day. claude code shipped **opsy phases 2 and 3** back-to-back — phase 2 added slack alerting, cron auto-retry, email capture, and tiers 2–4 monitoring; phase 3 added the `/ops` dashboard, failure-pattern detection, a weekly digest, and the cowork plugin — plus a handful of fixes (gmail-secret resolution, slack channel-join for human-created channels + an rls lockdown, cron middleware exemption, and a creaseworks `/api/health` probe). on the harbour side, the ppcs companion gates landed (lines-become-loops, values-companion, and cuts-catalogue — phases 1c/1d). on the ops side the nordic / sharon zoom was held today at noon pt to work the budget B pushback and the retainer reframe, but no written outcome has landed yet — confirm it in writing before legal can review. the ppcs impact report + dashboard is still in its final pass (garrett polishing, payton on the ~36-page graphics treatment) and amna's contract is still sitting in adobe sign awaiting garrett's signature. cash is still stale at $34k (last hard number 20 apr), less the $7,385.63 may payroll that debited 2 jun — no fresh figure pulled this run (_source unavailable_). the gusto july-1 health-benefits confirmation still never landed (deadline passed 6 jun), and adp has now emailed a 2025 form 5500 verification due 14 jul.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| ppcs impact report + dashboard | garrett giving a final pass; payton treating the report (~36 pages, high-visual magazine feel); triple-helix figure updated with per-session tools | finalise + send the report and dashboard (overdue against the tue/mon target — ship once payton's graphics land) | [drive /figures](https://drive.google.com/drive/folders/1flF0hvueKCcHl3sf1otcz-sb_0KqwV4d) |
| nordic naturals — contract + budget B | sharon's zoom held today (fri 12 jun noon pt) re: the budget B pushback + reframing the retainer as described activities + a number through dec 2026; v2 platform services agreement draft (budget A/B exhibits) created 11 jun | capture the call outcome in writing, finalise the agreement wording, and send it to sharon for her legal dept | [v2 agreement draft](https://docs.google.com/document/d/1QpeZA9q8sxrnBCIjDG70lPRpJfHUDVG097seEIa03H0) · [gmail thread 19e990652858b3d1](https://mail.google.com/mail/u/0/#inbox/19e990652858b3d1) |
| amna — contract | adobe sign signature request arrived 10 jun from walaa zaiter; no movement since; revised scope + budget already confirmed | review + sign the contract | [gmail thread 19eb0898fa36bc14](https://mail.google.com/mail/u/0/#inbox/19eb0898fa36bc14) |
| opsy — infra-monitoring agent | phases 1–3 all shipped (phase 2 #231, phase 3 #234 + the #232/#233/#235 fixes today); `/ops` dashboard, pattern detection, weekly digest, slack alerting, cron auto-retry, email capture, and the cowork plugin are live | watch for false-positive noise before fully trusting critical-tier dm alerts; sanity-check the `/ops` dashboard, weekly digest, + pattern detection against real data | [ops dashboard](https://port.windedvertigo.com/ops) · `docs/opsy/posture.md` |
| harbour — ppcs companion gates | phases 1c/1d shipped today: lines-become-loops, values-companion, and cuts-catalogue gates | continue the gate rollout + qa the new companions against the ppcs flow | [harbour](https://windedvertigo.com/harbour) |
| creaseworks-mini pilot | garrett building it live (collect & connect framing; kids co-design FIND first); jamie play-tested it and called it "very cool" | garrett keeps editing + testing (do not edit in code); cARL runs the lit review aligning the mini to the transformative theory of change | [creaseworks-mini](https://windedvertigo.com/harbour/creaseworks-mini) · [whirlpool notes](https://app.notion.com/p/37be4ee74ba4805cbb78f67921ad1cfb) |
| cARL — bibliography + creaseworks lit review | keys still aren't wired (no commit in 24h); whirlpool tasked cARL with the creaseworks/classroom-games lit review | wire `CORE_API_KEY` + `SEMANTIC_SCHOLAR_API_KEY` as wv-port secrets (federated coverage 5/7 → 7/7), then run the lit review | [bibliography](https://port.windedvertigo.com/bibliography) |
| cowork agent unlock — mo / pam / cARL / opsy | introduced to the team at the 10 jun whirlpool; enablement docs shipped 9 jun; opsy plugin now added too | confirm payton, maria, lamis, + jamie actually connect and the agents load real shared memory | [strategy](https://port.windedvertigo.com/strategy) · _connector: port.windedvertigo.com/api/mcp/agents/all_ |

### waiting on external

- **nordic (sharon matheny + legal team)** — budget B + retainer worked on today's call; first invoice + signature gated on finalising the wording and sharon's legal review.
- **straight talk cpas (aakib qureshi, abhishek sachdeva)** — two taxdome secure messages still unread (8 jun + 9 jun); need a reply.
- **adp / american century — 401k plan #156733** — 2025 form 5500 verification email arrived 12 jun, complete by **14 jul** to avoid late-filing penalties; also coordinate final 5500 + year-end testing with adp + cpa, and the plan-termination paperwork.
- **lightbulb learning lab + press play (sarah wolman, casper, jan)** — sarah replied 10 jun, enthusiastic about the "launching a fleet & rising tides" collaboration; awaiting next-step planning. note: the kickoff email bounced to `lisa@lightbulblearninglab.com` (likely a `.org`/address typo) — resend to the right address.
- **dw akademie — ims evaluation** — decision email arrived 2 jun, still unconfirmed; no new mail since.
- **prme / ungc pedagogy** — check records on a 2025 certification-series participant's async completion (garrett + maria); anne storey also forwarded an open-access transversal-skills activity-guide book 11 jun (relationship, low-action).
- **concern (amy dignam)** — icsp gce proposal submitted 25 may; review window open.
- **idb salvador / nadia nochez** — 45+ days silence since 24 apr; spanish follow-up draft (maria's voice) still unsent in gmail.
- **august kinloch — technical audit** — kickoff held 3 jun; confirm audit scope + go/no-go, write the overdue kickoff note.
- **lego foundation fellowship lead** — gina's 9 jun forward + the ssrc application-details link garrett self-bookmarked 10 jun; decide whether it's live.
- **michael renvillard 360 (via michael @ carefored)** — feedback request 11 jun (low-priority personal favour).
- **katie @ twotomatoes** — virtual-coffee redux request 10 jun (low-priority networking).
- **attio crm trial** — 60-day inactivity / workspace-deletion window ticking; keep-or-cancel decision pending (export contacts first if cancelling).

### environment handoffs

**cowork → claude code (engineering queued up):**

- **leave creaseworks-mini alone for now** — garrett is still hand-editing + testing `windedvertigo.com/harbour/creaseworks-mini` and explicitly asked not to edit it in code yet. queue any structural work behind his pass.
- **opsy phases 1–3 all shipped** — watch the tier-1 through tier-4 monitors for false-positive noise before fully trusting critical-tier dm alerts; sanity-check the `/ops` dashboard, the weekly digest, and the failure-pattern detection against real data; confirm the cowork plugin loads opsy's shared memory.
- **qa the new harbour ppcs companion gates** (lines-become-loops, values-companion, cuts-catalogue) against the ppcs flow now that phases 1c/1d are in.
- wire `CORE_API_KEY` + `SEMANTIC_SCHOLAR_API_KEY` as wv-port worker secrets (`cd port && npx wrangler secret put …`) — lifts the bibliography federated search 5/7 → 7/7 and adds core as a 6th provider + pdf source. still no commit showing the keys landed.
- apply the dependency review: bump `@anthropic-ai/sdk` across all 3 repos, **critical** vitest in harbour launch-smoke + values-auction (→ 4.1.8), 9 high in nordic-sqr-rct workflow devkit, wrangler → 4.98.0. supabase re-sent its "security vulnerabilities detected" advisory 9 jun. harbour-apps changes need a local session (sandbox install blocked).
- branch cleanup sweep — the local branch list is past claude.md's 3-day rule; audit against main, delete merged ones, get unfinished work shippable then merge.
- commit-or-ignore the untracked sprawl: `site/.env`, `port/.env.local.bak.20260527T055218`, `setup-mcp-servers.py`, eight+ `docs/prompts/*.md`, `docs/cmo/play-conference-strategy.md`, `docs/testimonials-lightbulb-learning-lab.md`, `docs/whirlpool-agendas/`, and three tool dirs (`a11y-icon-preview`, `upaya`, `whirlpool-2026-06-01`). (unchanged since 9 jun.)
- nordic prod-smoke still open — roles, pcs labels/comments, applicability, metrics/revisions, canonical-claim matcher.

**claude code → cowork (ops queued up):**

- **capture today's nordic / sharon call outcome in writing**, finalise the budget B + retainer wording (described activities + a number through dec 2026), and send the agreement to sharon for legal review.
- **review + sign the amna contract (adobe sign, from walaa zaiter, arrived 10 jun).**
- **finalise + send the ppcs impact report + dashboard** (overdue against the mon/tue target — ship once payton's ~36-page graphics treatment lands).
- read jamie's transformative-theory-of-change doc + games manifesto/playbook draft and feed back (the creaseworks bits flow from it; also a 10 jun whirlpool action).
- verify the gusto july-1 health-benefits enrolment landed (deadline passed 6 jun) — or chase the lapse / next enrolment window.
- complete the adp 2025 form 5500 verification by 14 jul.
- reply to the straight talk cpas taxdome secure messages (aakib qureshi 9 jun, abhishek sachdeva 8 jun).
- read the dw akademie decision (2 jun) + respond accordingly.
- check our records on the prme 2025 certification-series participant + reply to unprme pedagogy (garrett + maria).
- close out the august kinloch audit — confirm scope + go/no-go, then write the overdue kickoff note.
- refresh cash position (last hard number $34k as of 20 apr; payroll $7,385.63 debited 2 jun; no fresh figure this run).
- reply to sarah / lightbulb + press play on next steps, and resend the kickoff email to lisa's correct address (the 10 jun send bounced).
- decide on the lego foundation fellowship lead (gina's forward + the ssrc link).
- idb salvador spanish follow-up — forward the gmail draft to maria or send directly.
- attio trial keep-or-cancel decision; export contacts first if cancelling.
- low-priority: katie @ twotomatoes coffee; michael renvillard 360 feedback favour.
- confirm the team (payton, maria, lamis, jamie) connected to the cowork agent connector and the agents load shared memory.

### mobile bookmarks

- **no new self-bookmarks in the last 24h.** the only post to garrett's self-channel (D06QGJ34H53) since the last sync was the automated 09:09 invoice sweep — "all quiet today, nothing new logged."
- still carried from 8 jun: **"cowork setup — winded.vertigo agents (one connector, sign in)"** — the distributable connector instructions; the team was introduced to the agents at the 10 jun whirlpool but connection is still unconfirmed, so worth posting to a shared channel / pinning rather than leaving it in a dm. [link](https://windedvertigogo.slack.com/archives/D06QGJ34H53/p1780976902532479)
