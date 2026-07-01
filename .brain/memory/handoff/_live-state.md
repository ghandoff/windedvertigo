# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-06-30 21:08 pt (context-sync autonomous run)

**where we are right now:** today was a pivot day, not just a status day — the strategy playdate (garrett × lamis) and garrett × maria part i reframed w.v around a **"studio of studios"** operating model: a yes/no TToC prioritisation rubric, a RACI / shepherd-per-project ownership model so work stops routing solely through garrett, and a relaunched **lean PaM**. the keystone is a new **learning-through-play (LTP) consortium** — reignite and lead a coalition of siblings (care for education, education for sharing, history co-lab, press play, lightbulb, sarah wolman), triggered by the **idb** proposal (w.v is 1 of 7 invited; we lack the PhD-level credentials to go alone, so we bid as a consortium — maria owns the credential strategy, prep for the 9th, physical FedEx submission). the nonprofit question is **resolved**: no own 501c3 — lean on a partner's existing US nonprofit as the qualifying entity. the two cash threads are unchanged in shape: **nordic still isn't signed** — its finance meeting was *today* (30 jun), where the money was "hopefully released", but no signature or release signal is visible in slack or gmail yet, so it stays gated and is now the canonical "keep-the-lights-on" survival exception encoded in the TToC filter; and **amna is signed at $25k and moving into build** — hejer sent the **kick-off meeting invite** (microsoft teams) this morning, though `WV-AMNA-001` still awaits garrett's signature, and amna is the one hard deadline (**30 sep**). sequencing for the next ~3 weeks is **creaseworks + mini-creaseworks + amna**, with conference deep-work pushed to the last week of july. engineering shipped a lot to main today (the /brain attribution adjudicator + phase-4 agent co-production tracking, the doodle-style group-availability booking poll #318, the wrangler → 4.105.0 security bump, a next@16.2.9 + aws-sdk fix, and the creaseworks why-cards infographic) — all merged, port deploy unverified this run (the `/api/version` endpoint wasn't reachable from the sandbox). the standing debt holds: the **CRITICAL vitest cve** is still open (harbour-apps launch-smoke, security, and values-auction remain on 2.1.x — the wrangler bump was a separate finding), a fresh **supabase "security vulnerabilities detected" email** landed today, `feat/caipb-audit-fixes` is now unpushed ~15 days, the uncommitted rls-lockdown migration plus a growing pile of untracked docs are confirmed still in the tree, cash is still stale at $34k (last hard number 20 apr — no fresh figure this run, _source unavailable_), and june payroll is due via gusto with one item to review.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| nordic naturals — contract | finance meeting was **today** (30 jun); money "hopefully released at that point". no signature or release signal in slack/gmail yet | watch for the release; sign + confirm the first invoice the moment the money lands. survival exception — keep it moving | [gmail thread 19e990652858b3d1](https://mail.google.com/mail/u/0/#inbox/19e990652858b3d1) |
| amna — signed $25k, build | contract signed ($25k, won); **kick-off meeting invite (teams) received 30 jun 08:24**; desk-review folders in hand; `WV-AMNA-001` awaiting garrett's signature | sign `WV-AMNA-001`; accept + schedule the kick-off; prep inception materials; run the cARL reading sprint. hard deadline 30 sep | [amna kick-off thread](https://mail.google.com/mail/u/0/#inbox/19f17a1422a383a5) |
| creaseworks + mini-creaseworks | near-term build priority; 29 jun whirlpool worked the "why"; miro board "creaseworks camp — the why + the work" now shared (30 jun) | confirm maria's "one game, upgrade only" week plan still holds under the why-first framing; answer her open questions; build mini-creaseworks homepage variants | [miro board invite](https://mail.google.com/mail/u/0/#inbox/19f1ae2b94009228) |
| idb el salvador → LTP consortium | reframed today from a solo bid into the **trigger for the LTP consortium**; w.v 1 of 7 invited, credentials gap → bid as a coalition | maria drives credential strategy; assemble consortium partners; prep for the 9th; physical FedEx submission | _gmail / biz pipeline_ |
| operating model — studio of studios | garrett × lamis + garrett × maria today: TToC prioritisation rubric, RACI/shepherd-per-project, lean PaM relaunch, nonprofit question resolved | cARL to research the role model (RACI/RASI/alt); PaM adopts + goes async-between-whirlpools; encode survival-vs-mission filter in the TToC | [decisions-log](https://port.windedvertigo.com/strategy) · `docs/cmo/decisions-log.md` |
| dependency + platform security | 29 jun review flagged a **CRITICAL vitest cve**; wrangler → 4.105.0 bump now **merged**; fresh supabase "vulnerabilities detected" email landed 30 jun | upgrade vitest → 4.x (harbour-apps launch-smoke/security/values-auction still on 2.1.x); action the supabase advisory; regenerate + commit stale lock files | [supabase security email](https://mail.google.com/mail/u/0/#inbox/19f1a2c7425a32f2) |
| /brain graph + port deploy | attribution adjudicator tab + phase-4 agent co-production tracking merged to main today, on top of #312–#318 | confirm port was actually **deployed** (`cd port && npm run deploy:cf`; check `/api/version` `built`) — merged ≠ live | [/brain](https://port.windedvertigo.com/brain) |
| caipb audit-fixes — nordic | `feat/caipb-audit-fixes` still local-only, ~15 days, 38/38 tests green | push the branch for garrett's review (do **not** push to main — auto-deploys nordic); or fold/close if superseded | `.brain/memory/handoff/2026-06-15-nordic-caipb-audit-fixes.md` |

### waiting on external

- **nordic (sharon matheny + legal/finance)** — finance meeting was today (30 jun); money "hopefully released". signature + first invoice gated on it; no confirmation seen yet.
- **amna (hejer ben jaballah, jonelle gyamfi, walaa zaiter)** — kick-off meeting invite (teams) received; `WV-AMNA-001` invoice awaiting garrett's signature; inception phase to be scheduled. deadline 30 sep.
- **straight talk cpas (taxdome)** — sabir ghoghari's secure messages still unread; the agent keeps hitting "taxdome session expired" — garrett needs to open straighttalkcpas.taxdome.com in chrome and log in with google so the chats can be read + answered.
- **gusto** — june payroll (1 jun–30 jun) due, one item still needs review.
- **adp / american century — 401k plan #156733** — 2025 form 5500 verification due **14 jul**; plus a new 30 jun "indirect compensation" plan notice to read.
- **john balash (cmu)** — replied 30 jun offering to connect "tomorrow" (1 jul); a `garrett <> john` zoom is now on the calendar — confirm it holds.
- lower-priority carry-forwards still open: dw akademie (now confirmed *not* awarded — removed from pipeline), prme certification-series records, august kinloch audit kickoff, lightbulb + press play next steps (now folded into the consortium), lego foundation fellowship decision, and attio keep-or-cancel.

### environment handoffs

**cowork → claude code (engineering queued up):**

- **CRITICAL vitest cve (top item, still open)** — harbour-apps `launch-smoke`, `security`, and `values-auction` are still on vitest 2.1.x; upgrade to 4.x. also action the fresh supabase security advisory (email 30 jun), regenerate + commit the stale lock files (`npm ci` fails across all three repos), and review the remaining majors (`@ai-sdk/anthropic` 3→4, `ai` 6→7 in port; stripe 17→22; `@anthropic-ai/sdk` drift). the wrangler → 4.105.0 bump is **done** (merged today).
- **confirm port was deployed** — today's /brain attribution adjudicator + phase-4 co-production, plus #312–#318, the pam dashboard, and the booking poll are all merged to main, but port only goes live via `cd port && npm run deploy:cf`. `/api/version` wasn't reachable from the sandbox this run — verify + deploy from the desktop.
- **push `feat/caipb-audit-fixes`** — unpushed ~15 days (38/38 tests green). push for garrett's review; **do not push to main** (auto-deploys nordic).
- **commit-or-ignore the growing untracked sprawl** — confirmed still in the tree: `supabase/migrations/0003_enable_rls_lockdown.sql` (uncommitted security migration), `docs/carl/amna/`, `docs/carl/posture-plain-language.md`, `docs/opsy/dependency-majors-and-credentials.md`, `docs/opsy/meeting-notes-pipe-spec.md`, `docs/prompts/2026-06-25-pam-amna-reading-sprint.md`, `docs/prompts/strategy-brief-tab-port-build.md`, and `site/public/tools/whirlpool-icebreaker/`.
- **branch cleanup sweep** — the local branch list is far past claude.md's 3-day rule (a large stack of `feat/*`, `chore/*`, `claude/*`, and worktree branches). audit against main, delete merged ones, get unfinished work shippable.
- carry-forwards: wire `CORE_API_KEY` + `SEMANTIC_SCHOLAR_API_KEY` as wv-port secrets (federated coverage 5/7 → 7/7); resolve the opsy service-account scopes garrett owns (also unblocks the meeting-notes pipe).

**claude code → cowork (ops queued up):**

- **nordic** — track the finance-meeting outcome; sign + confirm the first invoice the moment the money releases.
- **amna** — sign `WV-AMNA-001`, accept + schedule the kick-off meeting, and prep the inception materials.
- **re-auth taxdome + reply to sabir ghoghari's secure messages** — the session keeps expiring; open straighttalkcpas.taxdome.com in chrome, log in with google, then read + respond.
- **run june payroll in gusto** (one item needs review); action finn's `PRME PO2069` contractor invoice + the 30 jun adp notice.
- **refresh cash position** — stale at $34k since 20 apr; pull a fresh figure ahead of payroll + the nordic/amna inflows.
- **ppcs impact report + dashboard** — garrett's final pass; payton on the high-visual graphics; survey holding at 209 responses. finalise + send once payton's figures land.
- **operating-model follow-through** — stand up the TToC prioritisation rubric, hand holiday/time-off collection + shared-calendar visibility to **PaM** (a role correction from mo→pam made today), and let mo keep only the oct-2027 strategy draft; complete the adp form 5500 verification by 14 jul.

### mobile bookmarks

- **strategy brain-dump cluster (self-dm 30 jun 08:10–09:17)** — a stream of planning notes from this morning, mostly folded into today's decisions-log but worth keeping visible: "systems game: levels the playing field of adults v kids", "have PaM reverse-engineer + plan play, fair october 2027", "PaM slacks everyone to get holiday dates + current deadlines", "conference: lamis, maria, payton", "games: garrett & jamie", "next 3 weeks: amna + mini-creaseworks", and "conferences site, campaign; lean into amna → conference pathway". [thread](https://windedvertigogo.slack.com/archives/D06QGJ34H53/p1782835348159719)
- **standing "taxdome session expired" nudge** (self-dm 30 jun 08:10) — a re-auth prompt with unread cpa messages behind it (see waiting-on-external).
- carry from last week (older than 24h, partly actioned): **"mo needs to be more strategic and far less sychophantic"** — today's mo→pam role correction narrows mo's scope to the oct-2027 strategy draft, which addresses part of this; the posture/memory tune is still worth doing. plus the substack "how to create loops with claude" and the notion "curious child / traceful game" lit review.
