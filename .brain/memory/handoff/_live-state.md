# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-05-25 21:05 pt (context-sync autonomous run)

**where we are right now:** t-3 days to the thursday 28 may prime+ / harbour launch. memorial-day monday with the whirlpool cancelled, but engineering quietly shipped three nordic-feedback plumbing prs on main (#131, #132, #133) — feedback button now mounted on every nordic page, slack feedback routes via `chat.postMessage` to `#nordic-updates` with a webhook fallback, and `port/.env.example` rewritten to document the post-tidy unified-bot architecture (one general "winded.vertigo" notification bot, one "wv-claw" agent app). the big ops win of the day: garrett **submitted the concern icsp gce financial proposal to amy dignam at 06:10 pdt** and amy confirmed receipt 08:50 pdt — yesterday's "address the insurance-line comment and decide submission" thread is now closed; we're in await-review. on the working tree (`chore/wv-slack-env-example-tidy`, no upstream): two unmerged changes worth knowing about — `port/app/components/nav-config.ts` adds new `/council` and `/designs` nav items, and `port/lib/agent/audit.ts` is mid-w0.1 upgrade adding supabase as the primary audit sink (notion drops to legacy safety net + cost-economics columns: input/output tokens, cost usd, model id, cache reads). cash unchanged from prior sync (prme 2026 booked at $145k against the $500k target). tomorrow returns to the full tuesday cadence — 7am site check, 9am lamis 1:1, 10am randall, 11am maria part i, 12pm prme — so the harbour launch-week clock effectively starts at tomorrow's 7am.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| prime+ / harbour launch (thu 28 may) | monday whirlpool absorbed into wednesday; weekend playtest brief still pinned in #whirlpool with the six prime+ app links | wednesday 27 may whirlpool agenda is now live in notion (`36be4ee74ba481adb1fac616e2a6dc30`) — confirm it includes the 15-min per-app review block; finalise harbour map artwork with `@fruit` + payton ahead of thursday | [whirlpool agenda 2026-05-27](https://www.notion.so/36be4ee74ba481adb1fac616e2a6dc30) |
| concern icsp gce financial proposal | _submitted today 06:10 pdt to amy.dignam@concern.net (jamie cc'd); receipt acknowledged 08:50 pdt_ | passive — track for response window; nothing required of garrett until concern's review team replies | [gmail thread `19e5e53ff72b6ee7`](https://mail.google.com/mail/u/0/#inbox/19e5e53ff72b6ee7) |
| nordic feedback plumbing (shipped today) | prs #131 (mount feedbackbutton globally), #132 (bot-token routing to `#nordic-updates`), #133 (`.env.example` rewrite) all merged to main on `wv-port` | invite the `winded.vertigo` bot into `#nordic-updates` (currently only garrett is in there) so `chat.postMessage` succeeds — until then feedback falls through to the legacy webhook in `#harbour-feedback` | apps/nordic-sqr-rct |
| port agent audit — supabase primary (w0.1) | uncommitted on `chore/wv-slack-env-example-tidy`: `port/lib/agent/audit.ts` now writes to supabase first, notion second; adds input/output token + cost-usd + model-id + cache-token columns to `agentaction` | commit and open a pr; plan a ~1-week parallel-write trial before retiring the notion sink | port/lib/agent/audit.ts |
| port nav — `/council` + `/designs` | uncommitted on same branch: two new nav items added under the "build" section in `nav-config.ts` (icons `MessagesSquare` + `FileText`) | confirm the matching routes exist (or are landing imminently); decide whether these ship with the audit pr or get their own | port/app/components/nav-config.ts |
| nordic platform — postgres cutover verify | yesterday's queued retire-the-stale-notion-webhook + weekend smoke checklist still open; no new commits today touched the cutover surface itself | retire (or formally orphan) the notion → `nordic.windedvertigo.com/api/webhooks/notion/page-updated` endpoint; finish the weekend prod-smoke pass (roles, pcs labels, applicability, metrics, label-intake-queue, pcs-pdf-import rollback, canonical-claim matcher, avg-sqr score division) | apps/nordic-sqr-rct |
| august kinloch technical audit | no new movement today; rsvp acceptance landed yesterday, scope still pending from august's side | drop the long-overdue `2026-05-22-cowork-kinloch-kickoff.md` handoff file with scope decision + agenda outputs; chase august for written scope this week | _pending_ |
| stale draft prs sweep | unchanged again; payton's #44 now ~15 days old | ship / close / revive: #89 (rubric-co-builder proxy, ~12d), #60 (/api/version, ~14d), #52 (wv-pr-pager, ~14d), #44 (payton's first-commit, ~15d) | github pr queue |

### waiting on external

- **concern (amy dignam)** — icsp gce gse-stream proposal submitted 25 may 06:10 pdt; receipt confirmed; review team window opens now.
- **august kinloch** — kickoff done; still awaiting his written audit scope + go/no-go.
- **idb salvador / nadia nochez** — ~31 days of silence since the 24 apr "comisión actualmente realizando" confirmation; spanish follow-up draft (maria's voice) still sits in gmail unsent.
- **collective members (aet, eco966, solihull, nsit)** — idb project references still outstanding.
- **amna at 10 (jonelle + walaa)** — submitted 26 mar; ~60 days, no response.
- **sesame workshop close-out** — pass received 31 mar; graceful reply still undrafted.
- **paul ramchandani (pedal conference)** — sent over the holiday, no response yet.
- **attio crm trial** — 60-day inactivity / workspace-deletion window still ticking; keep-or-cancel decision before contacts vanish.
- **straight talk cpas (aakib qureshi)** — taxdome reminder fired today; unread chat awaiting garrett's reply.

### environment handoffs

**cowork → claude code (engineering queued up):**

- commit the working-tree changes on `chore/wv-slack-env-example-tidy` — `audit.ts` supabase primary + `nav-config.ts` `/council` + `/designs` additions — and open a pr (likely two prs given they're independent concerns).
- invite the `winded.vertigo` bot into `#nordic-updates` so #132's `chat.postMessage` path actually succeeds; until then the three-tier fallback lands feedback in `#harbour-feedback` rather than nordic's own channel.
- retire (or formally document as orphaned) the notion → `nordic.windedvertigo.com/api/webhooks/notion/page-updated` webhook now that nordic is fully postgres; notion's still auto-pausing it.
- weekend smoke on nordic still open — roles, pcs labels/comments, applicability, metrics/revisions, label-intake-queue, pcs-pdf-import rollback, canonical-claim matcher, avg-sqr score division (which moved from /answer-count to /review-count in `b5038cd`).
- confirm the proposal pipeline fix end-to-end now that icsp gce has been submitted via the new path — supabase status flips cleanly off `generating`, dlq resets both stores.
- act on the 9 high vulns flagged in this morning's weekly dep review — `next@16.2.6` + `workflow@4.2.5` on nordic-sqr-rct are the critical bumps.
- stale draft prs sweep still queued — #89/#60/#52/#44; payton's #44 now ~15 days.
- populate the new deals columns (`revenue_tier`, `received_amount`, `contracted_amount`) so the strategyhero bar reads accurate numbers against the $145k / $500k target.

**claude code → cowork (ops queued up):**

- write up the kinloch kickoff into `2026-05-22-cowork-kinloch-kickoff.md` — still missing from the handoff dir four days later.
- review the substack outline garrett dm'd himself overnight (`we're doing it again`, 2,000-word draft built from the may 11–20 whirlpool transcripts); decide whether jamie picks it up or it joins the substack split queue.
- ubongo auto-decline post-mortem still outstanding; pull the form submission record and decide process vs fit.
- rmu asia-pacific graceful close-out reply (same template family as sesame, when that one finally goes out).
- attio trial decision — flip keep-or-cancel before workspace deletion; export retained contacts first if cancelling.
- idb salvador follow-up — draft still sits in gmail; forward to maria or send.
- respond to the taxdome unread chat from aakib qureshi (likely 401k / year-end coordination).
- confirm wednesday's whirlpool agenda (notion `36be4ee7…`) includes the 15-min per-prime-app review block; if it doesn't, add it.

### mobile bookmarks

- **weekly dependency review — 2026-05-25** (self-dm 06:16 pdt): 9 high vulns in `nordic-sqr-rct`, safe-tier bumps `next@16.2.6` + `workflow@4.2.5`; `@opennextjs/cloudflare` 1.19.4→1.19.11 across 19 harbour-apps cf workers; `@anthropic-ai/sdk` 3-way drift in harbour-apps to standardise before 1.0; stripe 17→22 + neon 0.10→1.x still pending; typescript 5→6 + wrangler 3.x lingering. [full report](https://claude.ai/code/scheduled/trig_01FBGX39dkqQ8M8Gqeyri168).
- **substack outline — "we're doing it again"** (self-dm 00:30 pdt, 6-reply thread): 2,000-word working outline built from the may 11–20 whirlpool transcripts; richest source material is the 18 may garrett↔jamie exchange (~02:03:45) on shallow vs deep ai use + the "criticism of hypocrisy" line. caveat: windedvertigo.com fetch was blocked, voice was proxied off `depth.chart` + the prme + ai-enhanced design docs. needs garrett to decide whether jamie picks it up or it shelves until post-launch.
