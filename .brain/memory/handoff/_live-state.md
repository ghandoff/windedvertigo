# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-07-08 21:15 pt (context-sync autonomous run)

**where we are right now:** a lighter news day than yesterday's cleanup marathon, but two new time-sensitive items landed. the nordic $50k invoice still hasn't gone out despite the contract being signed since 2 jul, and amna's £6k wire confirmation is still silent — but amna does have a fresh **kick-off meeting tomorrow (9 jul, 7:30am pt)** for the "amna at 10" impact paper, with lamis, jamie, and hejer. the idb el salvador LTP consortium is now actively scheduling: a group availability poll went out and garrett, maria, and lamis have all responded. new and notable: **ellen spencer (winchester) is chasing outstanding publisher queries** on garrett's book chapter proofs — today (8 jul) was the original review deadline, hard cutoff is 22 jul, and she flagged she's "very limited" availability after today. also new: today's whirlpool happened (gemini notes landed, not yet read/synthesized into `TASKS.md`), straight talk cpas wants to book a **q2 cfo review**, and a handful more taxdome secure messages piled up (aakib qureshi, abhishek sachdeva) on top of the still-unread sabir thread. engineering kept moving on nordic's platform — a `NOTION_ENABLED` kill-switch shipped (notion-writes cutover stage 1), the dead `wv-nordic-pcs` poc scaffold was retired, plus a ~201mb image de-dup and a safe reorg batch/estate-structure plan — all merged, port deploy unverified again this run (recurring bot-waf sandbox limitation). cash is still stale at $34,026 (20 apr, _source unavailable_ this run); the adp 401k form 5500 verification is now due in **6 days** (14 jul). notion source was unavailable again this run — recurring gap, worth a real fix (see handoffs below).

### open threads

| project | last action | next action | link |
|---|---|---|---|
| nordic naturals — contract | signed (box, 2 jul); still **no invoice sent** | send the $50k budget A invoice now that the contract is executed | [box completion email](https://mail.google.com/mail/u/0/#inbox/19f238edbcddf847) |
| amna — signed $25k, build | wire still unconfirmed since the 2 jul swift/bic fix; **new kick-off meeting tomorrow 9 jul 7:30am pt** (lamis, jamie, hejer) for the "amna at 10" impact paper | confirm the wire landed; prep for tomorrow's kick-off | [amna payment thread](https://mail.google.com/mail/u/0/#inbox/19f02b04b1892648) |
| idb el salvador → LTP consortium | scheduling poll live — garrett, maria, lamis responded (3 so far); enmienda no.1 + aclaración no.2 landed 7→8 jul | confirm remaining consortium responses; read + fold the new amendment into bid prep (credential strategy, 9th deadline, fedex submission) | [amendment thread](https://mail.google.com/mail/u/0/#inbox/19f3f0b8f632bdc9) |
| 2025 tax return + q2 cfo review — straight talk cpas | taxdome pending signature forms + unread secure messages (sabir, aakib, abhishek) pile up; abhi separately asked to **book the q2 cfo review** | re-auth via chrome (google login) at straighttalkcpas.taxdome.com, sign the 2025 return forms, read the secure messages, and get the q2 cfo review on the calendar | [taxdome reminder](https://mail.google.com/mail/u/0/#inbox/19f3d6debffb49f0) |
| winchester — handbook of creativity book chapter | ellen spencer chasing outstanding publisher queries; today (8 jul) was the review ask, hard deadline **22 jul**, ellen has very limited availability after today | garrett to review the proof + resolve any outstanding queries before 22 jul | [proofs thread](https://mail.google.com/mail/u/0/#inbox/19f419722f355864) |
| caipb audit-fixes — nordic | `feat/caipb-audit-fixes` pushed to origin (38/38 tests green) | surface for garrett's review/merge decision; do **not** merge straight to main (auto-deploys nordic) | `.brain/memory/handoff/2026-06-15-nordic-caipb-audit-fixes.md` |
| engineering cleanup (7–8 jul) | today: `NOTION_ENABLED` kill-switch (nordic notion-writes cutover stage 1), dead `wv-nordic-pcs` poc scaffold retired, ~201mb image de-dup, safe reorg batch + estate-structure plan — all merged (#341–#345) | verify port actually deployed (`cd port && npm run deploy:cf`; check `/api/version` `built`) — merged ≠ live, unreachable from the sandbox again this run | [git log](https://github.com) · main @ `e322f8f4` |
| adp 401k — plan #156733 | 2025 form 5500 verification still outstanding; 30 jun "indirect compensation" notice unread | complete the 5500 verification before **14 jul** (6 days out); read the indirect-comp notice | _adp / american century_ |

### waiting on external

- **amna (hejer ben jaballah)** — corrected swift/bic sent 2 jul for the £6k signature payment; no confirmation the wire actually processed since; kick-off meeting tomorrow regardless.
- **straight talk cpas (sabir ghoghari, aakib qureshi, abhishek sachdeva)** — multiple secure messages unread; taxdome session keeps expiring; abhi is also waiting on garrett to book the q2 cfo review.
- **adp / american century — 401k plan #156733** — 2025 form 5500 verification due **14 jul**; 30 jun "indirect compensation" plan notice still unread.
- **mined.gob.sv (nadia nochez, IDB SDP process)** — new amendment + clarification sent overnight; on us to read and fold into the LTP consortium bid.
- **ellen spencer (winchester)** — chasing garrett on outstanding book-chapter publisher queries; she has very limited availability past today.
- lower-priority carry-forwards: PRME PO2069 contractor invoice (finn), ppcs impact report final pass (garrett + payton's graphics, survey holding ~209 responses), attio keep-or-cancel decision, peace track initiative confirmed receipt of garrett's consultant application (no action needed yet, just an ack).

### environment handoffs

**cowork → claude code (engineering queued up):**

- **confirm port deployed** — today's `NOTION_ENABLED` kill-switch, dead-scaffold retirement, image de-dup, and reorg batch are all merged (#341–#345), but `/api/version` was unreachable from the sandbox this run. Verify + `cd port && npm run deploy:cf` from the desktop if not already live.
- **surface `feat/caipb-audit-fixes` for review** — still pushed to origin (38/38 tests green), still awaiting garrett's review/merge call; **do not merge straight to main** (auto-deploys nordic).
- **branch cleanup sweep** — local branch list is still well past claude.md's 3-day rule. Audit against main, delete merged ones.
- **fix the handoff-file commit hygiene gap for real** — checked directly this run: none of the dated session files from `2026-06-18` through `2026-07-07` were ever actually committed, despite the 7 jul sync's note claiming they were. Committed all of them (plus today's) as part of this run — worth a root-cause look at why the scheduled task's `git add -f` + commit step isn't sticking.

**claude code → cowork (ops queued up):**

- **send nordic's $50k budget A invoice** — contract signed (box, 2 jul), nothing invoiced yet.
- **confirm amna's wire cleared** — chase hejer for confirmation on the corrected swift/bic payment; prep for tomorrow's 7:30am pt kick-off meeting.
- **respond to the IDB SDP amendment** — read enmienda no.1 + aclaración no.2, fold into LTP consortium bid prep; confirm remaining poll responses for the consortium call.
- **re-auth taxdome, clear the secure-message backlog, and book the q2 cfo review** — open straighttalkcpas.taxdome.com in chrome, log in with google, sign the 2025 return forms, read all pending secure messages, reply to abhi to schedule q2 cfo review.
- **review winchester book chapter proofs** — resolve ellen spencer's outstanding publisher queries before the 22 jul hard deadline; she's hard to reach after today.
- **read today's whirlpool notes + log action items** — gemini notes for the 8 jul whirlpool landed but haven't been synthesized into `TASKS.md` yet.
- **reconnect notion mcp** — unavailable for the second run in a row (non-interactive session can't complete oauth); re-authorize via claude.ai connector settings so notion project-status changes stop being a blind spot in this sync.
- **refresh cash position** — stale at $34,026 since 20 apr; pull a current figure ahead of the nordic invoice + amna inflow.
- **complete ADP form 5500 verification** — due 14 jul (6 days out); read the 30 jun indirect-compensation notice.

### mobile bookmarks

- no new content bookmarks in the last 24h — only the standing **"taxdome session expired"** re-auth nudge, sent to self-dm twice today (08:10 and 17:08 pt). see waiting-on-external / open threads for the underlying task.
