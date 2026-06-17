# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-06-16 21:10 pt (context-sync autonomous run)

**where we are right now:** day 19 post-launch, and a family week — garrett is ooo through 19 jun (cabin time tue–thu), working from the laptop with internal meetings cleared. two wins are banked from the 15 jun whirlpool: amna's contract is signed, and nordic is signing this week (the agreement is with sharon's legal, the retainer reframed as described activities plus a number through dec 2026, and the first payment is expected alongside it). the whirlpool also set a new north star — foundational alignment is now the priority, anchoring the collective on the games manifesto plus the theory-of-change one-pager before more product work runs ahead of it (the 24 jun whirlpool becomes a ttoc/manifesto workshop, and pam now owns the weekly agenda plus a team game). on the build side, claude code spent 16 jun reconstructing and redesigning the ppcs impact dashboard (worker recovered from cloudflare, data-wired redesign deployed), and the caipb audit-fixes branch is now pushed for review. fresh inbound today: a formal idb / el salvador rfp landed (mineducyt-bid, to maria and garrett), breaking 45+ days of silence. cash is still stale at $34k (last hard number 20 apr), less the $7,385.63 may payroll that debited 2 jun, and now with new payables arriving (a.fruit $577.50, maria's prme invoice) — no fresh figure pulled this run (_source unavailable_). the gusto july-1 health-benefits confirmation still never landed (deadline passed 6 jun), and the adp 2025 form 5500 verification is due 14 jul.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| idb / el salvador rfp | formal invitation to present proposals (sdp no. 01/2026 mineducyt-bid 7521) arrived today to maria + garrett, ending 45+ days of silence since 24 apr | open the rfp, capture the submission deadline + scope, and decide go/no-go with maria | [gmail thread 19ed29a60ef3751c](https://mail.google.com/mail/u/0/#inbox/19ed29a60ef3751c) |
| nordic naturals — contract + budget B | agreement with sharon's legal; retainer reframed as described activities + a number through dec 2026; scope reconciliation v3 drafted 15 may | sign this week (first payment expected with it); answer any legal-dept wording questions | [scope reconciliation v3](https://docs.google.com/document/d/1zvl0VrekxsmB9YqHDtjdhz1pjiSNFC0FIQU3Yq2lfyE) · [v2 agreement draft](https://docs.google.com/document/d/1QpeZA9q8sxrnBCIjDG70lPRpJfHUDVG097seEIa03H0) |
| ppcs impact report + dashboard | dashboard worker reconstructed + data-wired redesign deployed 16 jun; garrett's corrected baseline figures (148 responses, confidence 3.64, familiarity 2.61) pasted for canva 15 jun | apply the corrected figures, finalise + send the report once payton's ~36-page graphics land; certificate outcomes still "forthcoming" pending the secretariat | [drive /figures](https://drive.google.com/drive/folders/1flF0hvueKCcHl3sf1otcz-sb_0KqwV4d) |
| foundational alignment — manifesto + ttoc | named the priority at the 15 jun whirlpool; 24 jun whirlpool becomes a ttoc/manifesto workshop (maria + jamie designing); pam now owns the weekly agenda + a weekly team game | read jamie's games manifesto + theory-of-change one-pager and leave feedback in canon by end of friday | [whirlpool agenda 15 jun](https://app.notion.com/p/380e4ee74ba481f28ba8d79cf5b6cf78) |
| nordic — caipb audit-fixes | branch `feat/caipb-audit-fixes` committed + pushed to origin (role checks, audited authority_regions edit, dashboard gaps, 38 verify tests); `feat/caipb-viz` carries the follow-on visual packages | garrett reviews + merges (do **not** push to main — auto-deploys nordic.windedvertigo.com) | `git checkout feat/caipb-audit-fixes` · `.brain/memory/handoff/2026-06-15-nordic-caipb-audit-fixes.md` |
| creaseworks-mini pilot | playtested well at the whirlpool (collect & connect framing; kids co-design find first); garrett hand-editing live | garrett keeps editing + testing (do not edit in code); cARL aligns the lit review to the transformative theory of change | [creaseworks-mini](https://windedvertigo.com/harbour/creaseworks-mini) |
| straight talk cpas — taxdome | a third secure message arrived 16 jun (helen passariello), on top of the two unread from aakib qureshi + abhishek sachdeva (8 + 9 jun) | reply to the taxdome messages (3+ now unread) | [taxdome](https://app.taxdome.com) |
| cowork agent unlock — mo / pam / cARL / opsy | remote-mcp connector live; team introduced at the 10 jun whirlpool; pam now driving the weekly agenda | confirm payton, maria, lamis, + jamie actually connect and the agents load real shared memory | [strategy](https://port.windedvertigo.com/strategy) · _connector: port.windedvertigo.com/api/mcp/agents/all_ |

### waiting on external

- **nordic (sharon matheny + legal team)** — agreement at legal; signature + first invoice gated on their review, expected this week.
- **idb / el salvador (nadia nochez, maria cc'd)** — formal rfp (sdp no. 01/2026 mineducyt-bid 7521) arrived 16 jun; open it for the deadline and decide go/no-go with maria. supersedes the long-stalled spanish follow-up.
- **straight talk cpas (aakib qureshi, abhishek sachdeva, helen passariello)** — three taxdome secure messages now unread (8, 9, + 16 jun); need a reply.
- **a.fruit design** — invoice #111074 for $577.50 arrived 16 jun (paypal/card); pay or log it.
- **maria altamirano** — april + may invoice (mostly prme) arrived 16 jun; process + pay.
- **adp / american century 401k plan** — 2025 form 5500 verification due **14 jul** to avoid late-filing penalties; also coordinate final 5500 + year-end testing and the plan-termination paperwork.
- **gusto** — july-1 health-benefits enrolment confirmation still never landed (deadline passed 6 jun); verify the enrolment or chase the lapse.
- **google cloud** — tls-cert root-CA trust change was due 15 jun; confirm the google trust services root CAs are trusted.
- **supabase** — "security vulnerabilities detected" advisory re-sent 16 jun; still open.
- **lightbulb learning lab + press play (sarah wolman, casper, jan)** — "launching a fleet & rising tides" collaboration warm since sarah's 10 jun reply; the kickoff email bounced to `lisa@lightbulblearninglab.com` (likely a typo) — resend to the correct address.
- **dw akademie — ims evaluation** — decision email 2 jun, still unconfirmed.
- **concern (amy dignam)** — icsp gce proposal submitted 25 may; review window open.
- **lego foundation fellowship lead** — gina's 9 jun forward + the ssrc application link garrett self-bookmarked; decide whether it's live.
- **attio crm trial** — 60-day inactivity / workspace-deletion window ticking; keep-or-cancel decision pending (export contacts first if cancelling).

### environment handoffs

**cowork → claude code (engineering queued up):**

- **caipb audit-fixes is pushed** (`feat/caipb-audit-fixes`, on origin) — awaiting garrett's review + merge. do **not** push to main (auto-deploys nordic.windedvertigo.com); the follow-on `feat/caipb-viz` carries the visual packages.
- **ppcs impact dashboard** — worker recovered from cloudflare and the data-wired redesign is deployed; verify it renders, wire in garrett's corrected baseline figures (148 responses, confidence 3.64, familiarity 2.61), and surface certificate outcomes once the secretariat confirms.
- **leave creaseworks-mini alone** — garrett is still hand-editing + testing `windedvertigo.com/harbour/creaseworks-mini` and asked eng to stay out of the code.
- apply the 15 jun dependency review: `next` → 16.2.9 (2 high CVEs, all 3 repos, safe same-major bump), **critical** `vitest` → 4.1.9 in harbour security / launch-smoke / values-auction, `wrangler` → 4.100.0 across all workspaces, `@anthropic-ai/sdk` ≥ 0.91.1 in nordic-sqr-rct. supabase re-sent its advisory 16 jun.
- branch cleanup sweep — the local branch list is well past claude.md's 3-day rule; audit against main, delete merged ones, get unfinished work shippable then merge.
- commit the untracked whirlpool-wheel tool (`site/public/tools/whirlpool-wheel/index.html`) and clear the recurring stale `.git/index.lock` that blocked the weekly auto-sync.

**claude code → cowork (ops queued up):**

- **sign the nordic agreement this week** (first payment expected with it); field any legal-dept wording questions.
- **respond to the idb / el salvador rfp** (nadia nochez, sdp 01/2026) with maria — open it for the deadline + scope, decide go/no-go.
- **finalise + send the ppcs impact report + dashboard** once the corrected figures + payton's ~36-page graphics land.
- read jamie's games manifesto + theory-of-change one-pager and leave feedback in canon by friday (the foundational-alignment priority + a 15 jun whirlpool action).
- process maria's april+may prme invoice and pay the a.fruit design invoice (#111074, $577.50).
- reply to the straight talk cpas taxdome messages (3+ unread: aakib qureshi, abhishek sachdeva, helen passariello).
- verify the gusto july-1 health-benefits enrolment landed (deadline passed 6 jun) — or chase the lapse.
- complete the adp 2025 form 5500 verification by 14 jul.
- confirm the google cloud tls-cert root-CA trust change (was due 15 jun).
- refresh cash position (last hard number $34k as of 20 apr; payroll $7,385.63 debited 2 jun; new payables arriving; no fresh figure this run).
- clear any stale internal meetings still on tomorrow's calendar (whirlpool 9am) given the ooo / family week.
- confirm the team (payton, maria, lamis, jamie) connected to the cowork agent connector and the agents load shared memory.

### mobile bookmarks

- **ppcs 2026 impact report — paste-ready canva edits** (self-dm, 15 jun 22:26): corrected baseline figures + the "not remedial / specificational" §5 reframe for the report. still live — feeds the report's final pass. [link](https://windedvertigo.com/archives/D06QGJ34H53/p1781587592221669)
- no other genuine self-bookmarks in the last 24h — the only other posts to the self-channel (D06QGJ34H53) were the automated 09:10 invoice sweep ("all quiet today") and the daily resume briefings.
