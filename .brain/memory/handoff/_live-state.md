# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-06-15 21:10 pt (context-sync autonomous run)

**where we are right now:** day 18 post-launch, and a transition day — garrett is moving from the desktop to the laptop and taking family time at the cabin tue–thu, so meetings are meant to be cancelled wed (and the calendar should be cleared tomorrow too). two wins to bank: the **amna contract is fully signed** (adobe sign marked it "completed" this morning, 15 jun) and **nordic is signing this week** (payment expected with it). the june 15 whirlpool was a deliberate "breather edition" — the collective is now anchoring on foundational alignment: everyone reads the games manifesto + the ttoc one-pager and leaves feedback in canon by end of friday, and the 24 jun whirlpool becomes a ttoc/manifesto workshop (maria + jamie designing, jamie picking an external game to play and evaluate). pam now owns the weekly agenda + a weekly team game. on the engineering side it was another heavy two days: aics broadcasting + backfill + provenance badges, the living-view ai-form picker, budget-c compliance matrix + ai research chat, password-first login + 30-day sessions, a sidebar nav durability fix, dkim set up for windedvertigo.com, and rls enabled on every table (17 on wv-port-pilot, 51 on wv-nordic). the caipb audit-fixes branch is committed locally but not pushed (38/38 tests green, awaiting garrett's review + push from the laptop). cash is still stale at $34k (last hard number 20 apr), less the $7,385.63 may payroll that debited 2 jun — no fresh figure pulled this run (_source unavailable_). a google cloud tls-cert change was flagged due **today (15 jun)** and the gusto july-1 health-benefits confirmation still never landed (deadline passed 6 jun); adp's 2025 form 5500 verification is due 14 jul.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| nordic naturals — contract | budget B + retainer reframe worked through; whirlpool notes nordic is "signing this week" with payment expected | sign the nordic contract + confirm first invoice once it lands | [v2 agreement draft](https://docs.google.com/document/d/1QpeZA9q8sxrnBCIjDG70lPRpJfHUDVG097seEIa03H0) · [gmail thread 19e990652858b3d1](https://mail.google.com/mail/u/0/#inbox/19e990652858b3d1) |
| foundational alignment — games manifesto + ttoc | new top priority set at the 15 jun whirlpool; 24 jun whirlpool becomes a ttoc/manifesto workshop (maria + jamie designing) | read the manifesto + ttoc one-pager and leave feedback (comments + voice) in canon by **end of friday** | [whirlpool 15 jun](https://www.notion.so/380e4ee74ba480699a04dae68e4b81fb) |
| caipb audit-fixes — nordic | `feat/caipb-audit-fixes` committed locally (audit vs §4.5/§4.6, 4 findings fixed, 38/38 tests); not pushed | from the laptop: clear the stale `.git/index.lock`, commit `apps/nordic-sqr-rct/`, push the branch, garrett reviews (do **not** push to main) | `.brain/memory/handoff/2026-06-15-nordic-caipb-audit-fixes.md` |
| amna — inception phase | contract fully signed/completed (adobe sign, 15 jun) | prepare amna's inception materials; awaiting amna's response on the next inception phase | [adobe sign thread 19eca3a823515ba2](https://mail.google.com/mail/u/0/#inbox/19eca3a823515ba2) |
| ppcs impact report + dashboard | garrett's final pass; payton on the ~36-page high-visual treatment | finalise + send the report and dashboard (overdue against the earlier mon/tue target — ship once payton's graphics land) | [drive /figures](https://drive.google.com/drive/folders/1flF0hvueKCcHl3sf1otcz-sb_0KqwV4d) |
| creaseworks-mini pilot | garrett building it live (collect & connect; kids co-design FIND first); jamie play-tested it well | garrett keeps editing + testing (do not edit in code); cARL runs the lit review aligning the mini to the transformative theory of change | [creaseworks-mini](https://windedvertigo.com/harbour/creaseworks-mini) |
| cARL — bibliography + creaseworks lit review | keys still not wired (no commit landed); whirlpool tasked cARL with the creaseworks/classroom-games lit review | wire `CORE_API_KEY` + `SEMANTIC_SCHOLAR_API_KEY` as wv-port secrets (federated coverage 5/7 → 7/7), then run the lit review | [bibliography](https://port.windedvertigo.com/bibliography) |
| opsy — infra-monitoring agent | phases 1–3 all shipped (#230/#231/#234 + the #232/#233/#235 fixes); `/ops` dashboard, pattern detection, weekly digest, slack alerting, cron auto-retry, email capture, and the cowork plugin are live | watch for false-positive noise before fully trusting critical-tier dm alerts; sanity-check the dashboard, digest, + pattern detection against real data | [ops dashboard](https://port.windedvertigo.com/ops) · `docs/opsy/posture.md` |

### waiting on external

- **nordic (sharon matheny + legal team)** — signing this week per the whirlpool; first invoice + payment gated on garrett's signature landing.
- **amna (walaa zaiter, hejer, natalia)** — contract done; now awaiting amna's response on the next inception phase before inception materials are finalised.
- **straight talk cpas (straight talk / taxdome)** — secure messages still piling up unanswered: abhishek sachdeva + sabir ghoghari both 15 jun, on top of the earlier aakib qureshi + abhishek messages (8–9 jun). need a reply.
- **adp / american century — 401k plan #156733** — 2025 form 5500 verification due **14 jul** to avoid late-filing penalties; also coordinate final 5500 + year-end testing with adp + cpa, and the plan-termination paperwork.
- **google cloud (CloudPlatform-noreply@google.com)** — tls-cert change flagged due **today, 15 jun**: review the email + ensure all google trust services root CAs are trusted (likely overdue now).
- **lightbulb learning lab + press play (sarah wolman, casper, jan)** — sarah enthusiastic about the "launching a fleet & rising tides" collaboration; awaiting next-step planning. note: the kickoff email bounced to `lisa@lightbulblearninglab.com` — resend to the right address.
- **dw akademie — ims evaluation** — decision email arrived 2 jun, still unconfirmed; no new mail since.
- **prme / ungc pedagogy** — check records on a 2025 certification-series participant's async completion (garrett + maria).
- **concern (amy dignam)** — icsp gce proposal submitted 25 may; review window open.
- **idb salvador / nadia nochez** — 50+ days silence since 24 apr; spanish follow-up draft (maria's voice) still unsent in gmail.
- **august kinloch — technical audit** — kickoff held 3 jun; confirm audit scope + go/no-go, write the overdue kickoff note.
- **lego foundation fellowship lead** — gina's 9 jun forward + the ssrc application link garrett self-bookmarked 10 jun; decide whether it's live.
- **attio crm trial** — 60-day inactivity / workspace-deletion window ticking; keep-or-cancel decision pending (export contacts first if cancelling).

### environment handoffs

**cowork → claude code (engineering queued up):**

- **push the caipb audit-fixes branch from the laptop** — on the laptop run garrett's transition checklist: `git checkout feat/caipb-audit-fixes`, `git add apps/nordic-sqr-rct/`, commit, `git push -u origin feat/caipb-audit-fixes`. there's a stale `.git/index.lock` (0 bytes) — `rm -f .git/index.lock` first if git complains. **do not push to main** (auto-deploys nordic).
- **leave creaseworks-mini alone for now** — garrett is still hand-editing + testing `windedvertigo.com/harbour/creaseworks-mini` and asked eng to stay out of the code. queue any structural work behind his pass.
- **opsy phases 1–3 are live** — watch the tier-1 through tier-4 monitors for false-positive noise before fully trusting critical-tier dm alerts; sanity-check the `/ops` dashboard, the weekly digest, and the failure-pattern detection against real data. (note: a stale daily-brief line said "build opsy phase 1" — disregard; commits #230–#235 confirm 1–3 shipped.)
- **qa the harbour ppcs companion gates** (lines-become-loops, values-companion, cuts-catalogue) against the ppcs flow.
- wire `CORE_API_KEY` + `SEMANTIC_SCHOLAR_API_KEY` as wv-port worker secrets (`cd port && npx wrangler secret put …`) — lifts bibliography federated search 5/7 → 7/7. still no commit showing the keys landed.
- apply the 15 jun dependency review: `next` → 16.2.9 (patches 2 HIGH CVEs across all 3 repos — highest-ROI, safe same-major bump), **critical** vitest → 4.1.9 in harbour `packages/security` + `launch-smoke` + `values-auction`, `wrangler` → 4.100.0 across all workspaces, `@anthropic-ai/sdk` ≥0.91.1 in nordic-sqr-rct. harbour-apps changes need a local session (sandbox install blocked).
- commit-or-ignore untracked sprawl, incl. the new `site/public/tools/whirlpool-wheel/index.html`, plus the older `site/.env`, prompts, and tool dirs flagged before.
- branch cleanup sweep — the local branch list is well past claude.md's 3-day rule; audit against main, delete merged ones, get unfinished work shippable then merge.

**claude code → cowork (ops queued up):**

- **sign the nordic contract** (signing this week; payment expected with it) and confirm the first invoice once it lands.
- **prepare amna's inception materials** for the next inception phase (contract now fully signed; awaiting amna's reply).
- **clear tomorrow's calendar** — despite the tue–thu family-time cancellation, 3 internal meetings still sit on 16 jun (bi-weekly strategy playdates 8am pt, lamis x garrett 9am pt, garrett x maria 11am pt). decline/cancel them.
- **review the google cloud tls-cert email (due today, 15 jun)** and trust the google trust services root CAs.
- **finalise + send the ppcs impact report + dashboard** once payton's ~36-page graphics land (overdue against the earlier target).
- read jamie's transformative-theory-of-change doc + games manifesto and leave feedback in canon by end of friday (whole-team action).
- verify the gusto july-1 health-benefits enrolment landed (deadline passed 6 jun) — or chase the lapse / next window.
- complete the adp 2025 form 5500 verification by 14 jul.
- reply to the straight talk cpas taxdome secure messages (now four-plus: 8, 9, and two on 15 jun).
- refresh cash position (last hard number $34k as of 20 apr; payroll $7,385.63 debited 2 jun; no fresh figure this run).
- lower-priority follow-ups still open: dw akademie decision, prme certification-series records, august kinloch audit kickoff note, lightbulb + press play next steps (resend to lisa's correct address), lego foundation fellowship decision, idb salvador spanish follow-up, attio keep-or-cancel.

### mobile bookmarks

- **screenshot self-bookmark, 15 jun 12:01 pt** — garrett dropped an uncaptioned `Screenshot 2026-06-15 at 12.00.45.png` into his self-dm; content not inspected, treat as an unresolved bookmark to action. [link](https://windedvertigogo.slack.com/archives/D06QGJ34H53/p1781550062484219)
- **laptop transition checklist, 15 jun 12:08 pt** — the device-handoff steps (caipb push commands, clone/setup on the laptop, what carries over) — keep handy until the laptop is fully set up. it also re-flags the google cloud tls-cert deadline (today) still pending. [link](https://windedvertigogo.slack.com/archives/D06QGJ34H53/p1781554128673399)
