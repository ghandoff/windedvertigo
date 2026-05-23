# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-05-22 21:08 pt (context-sync autonomous run)

**where we are right now:** t-6 days to the may 28 prime+ / harbour launch. nordic platform was the dominant engineering surface in the last 24 hours — 11 commits landed on main covering Part 7 living-view inline editing, Part 8 delete-request system + canonical claim overrides, ingredient auto-create, a role-aware command center dashboard, and welcome-redirect fixes. the kinloch technical audit kickoff happened today at 2:30pm pt (rescheduled from noon). proposal pipeline is quiet today — the 3 local-only files on main from yesterday's gdocs→notion revert remain uncommitted (now joined by port-jobs/src/index.ts and the modified ai/proposal-generator.ts), and main is even with origin/main (no longer 1 ahead). two new rejections came in this morning — ubongo (10-year impact RFP, auto-decline ~7 min after submission) and rmu asia-pacific (distilling lesson study). cash position unchanged from last sync (prme 2026 booked at $145k against the $500k target). tomorrow is a saturday — calendar is empty save the chase ink cc payment reminder.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| prime+ launch (may 28) | t-6 days; no engineering merges directly on prime+ in last 24h | wed 27 may whirlpool: 15-min per-app review block; ship co-rubric-companion polish remaining items | [TASKS.md whirlpool 2026-05-18](../../TASKS.md) |
| nordic platform — sharon follow-up wave | parts 7 + 8 shipped today (`444a1d2`, `a6002bf`), command center + ingredients + welcome-redirect fixes all merged | verify role-extraction accuracy + delete-request flow in prod; confirm magic-link path for non-team users | apps/nordic-sqr-rct |
| proposal pipeline output route | reverted gdocs → notion (`bedb0a2`, 21 may); gdocs per-org subfolders still landed (`f81041e`) | lock direction; commit-or-stash the 5 modified files locally (`port-jobs/src/index.ts`, `port/lib/ai/client.ts`, `port/lib/ai/proposal-generator.ts`, `port/lib/notion/client.ts`, plus this file) | _local working tree_ |
| kinloch technical audit | kickoff completed today 2:30pm pt (slot moved from noon) | capture his scope decision + agenda outputs into a session handoff file; queue follow-up actions for engineering | calendar event `e14a9fbcbf7f` |
| ubongo 10-year impact rfp | proposal sent 22 may 06:49 utc; auto-decline arrived 7 minutes later | post-mortem: was it a hard auto-filter, missing eligibility field, or human review? log learnings for the question-bank | gmail thread `19e4e6de36caf459` |
| rmu asia-pacific (distilling lesson study) | rejection received this morning re: 4 may submission | graceful close-out reply; tag opportunity as lost in pipeline | gmail thread `19df4c14823e9f83` |
| attio crm trial | 60-day inactivity notice today — workspace deletion imminent | decide keep-or-cancel; if cancelling, export any retained contacts before deletion | gmail thread `19e526183d2f0039` |
| stale draft prs sweep | unchanged since 21 may sync | ship / close / revive: #89 (rubric-co-builder proxy, now 7d), #60 (/api/version, 9d), #52 (wv-pr-pager, 9d), #44 (payton's first-commit, 11d) | github pr queue |

### waiting on external

- **august kinloch** — kickoff just landed; awaiting his written audit scope + go/no-go signal back.
- **idb salvador / nadia nochez** — 28 days of silence since the 24 apr "comisión actualmente realizando" confirmation; follow-up draft (in maria's voice, spanish) still unsent.
- **collective members (aet, eco966, solihull, nsit)** — idb project references still outstanding.
- **amna at 10 (jonelle + walaa)** — submitted 26 mar; ~57 days, no response.
- **sesame workshop close-out** — pass received 31 mar; graceful reply still undrafted.
- **paul ramchandani (pedal conference)** — sent over the holiday, no response yet.
- **kristin miller (smartersupplyworld)** — inbound cold outreach today re: "4–8 new contracts in 90 days"; awaiting garrett triage (probably ignore, but worth a glance).

### environment handoffs

**cowork → claude code (engineering queued up):**

- decide proposal-output direction (notion vs gdocs) and lock it in — pipeline has flip-flopped twice in the last 48 hours; the 5 modified files in the local working tree are blocking on this decision.
- commit-or-stash the locally-modified files on main: `port-jobs/src/index.ts`, `port/lib/ai/client.ts`, `port/lib/ai/proposal-generator.ts`, `port/lib/notion/client.ts`, plus this handoff file.
- stale draft prs sweep still queued — #89/#60/#52/#44; payton's #44 now at 11 days.
- nordic Part 7 + Part 8 verification in production: living-view inline edits round-trip cleanly, delete-request system fires correct events, canonical-claim overrides behave for tier-1 admins.

**claude code → cowork (ops queued up):**

- write up the kinloch kickoff into a `2026-05-22-cowork-kinloch-kickoff.md` handoff file — scope decisions, next-step actions, garrett's read on whether to proceed.
- ubongo auto-decline post-mortem: pull the form submission record, compare against what they accepted historically, decide if it's a process problem or a fit problem.
- attio trial decision — flip keep-or-cancel before the 60-day workspace deletion fires; if cancelling, ensure no live contacts depend on it.
- rmu asia-pacific graceful close-out reply (similar template to sesame when that goes out).
- idb salvador follow-up — draft still sits in gmail; needs garrett to forward to maria or send from his account.
- verify payton's may 13 "learning to fly" substack post — was it ever published? cross off or escalate.
- confirm wednesday whirlpool agenda includes the 15-min prime+ app review block per the may 18 action item.

### mobile bookmarks

_no slack self-DMs from u06q4un4pkr in the last 24 hours._
