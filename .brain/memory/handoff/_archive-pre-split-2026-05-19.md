# Handoff Notes — Cross-Environment Context

When Cowork or Claude Code finishes a significant session, drop a note here so the other environment picks up with full context. Most recent first.

> **cross-device convention:** this file is the source of truth when resuming work. say "pick up [project]" or "where did we leave off?" at the start of any Cowork or Claude Code session to trigger a read. the `context-sync` scheduled task updates the **live state** block below daily at 9pm PT.

---

## 🟢 live state
<!-- updated by context-sync daily 9pm PT, and manually at end of significant sessions. only this block is auto-refreshed. everything below is append-only history. -->

**last synced:** wed 20 may 2026, ~05:05 PT (claude code, end-of-session)

**where we are right now:**
tuesday was the **single heaviest engineering day of the quarter** — **30+ commits** across the windedvertigo monorepo with the centrepiece being a full rebrand: **rubric-co-builder → co.rubric / rcb-companion → co.rubric companion** (`41add74`). on top of the rename, the co.rubric stack got hardened end-to-end (lazy-participant heartbeat + presence + auto-tally `800e48f`, TOCTOU vote-quota race closed with an advisory-lock transaction `8e5984d`, hydration crash fix `7b179db`, perf parallelisation `f4c8a6c`, host_token persisted client-side `d591b5d`, UDL audit fixes #1/#3/#4/#5 on the main tool `e8c4416` + #6 on the companion `b0a32e2`). new ground was broken on **AICS**: `/research/pcs/aics/new` page + CF env vars, batch import API + versions route + cover-tab versions fix, and three relational-integrity bugs caught + fixed. **port/strategy got wired bi-directionally to the PM project portfolio** (`7745fc2`), `/projects/[id]` detail page landed (`e096a45`), nav now redirects `/` → `/strategy` (`9f19fd5`), and **press play was added to the bookings layer** with a docent banner. on the commercial side, **jamie reviewed v2 of the ubongo proposal** at 1:22pm + 2:24pm PT today and left comments in the google doc — first one nudging the team size ("8–12 internal and 6–10 external"), second on an in-country research associate scope in dar es salaam. **amna at 10 confirmed invite finally landed** (sent 12 may, attendees added) — session lands **wed 20 may 8am PT (4pm UK)** with fatima/gabriella/hejer/jonelle on amna's side and maria/lamis/jamie on ours. new **PRME bibliography request** came in 6:13am PT from joseph satish (via pedagogy@unprme.org) asking for session-slide references — addressed to garrett + maria, starred + important. **CONTRIBUTING.md** was committed (`3fb0192`) codifying the draft-PR-at-start workflow that landed in CLAUDE.md yesterday. weekly-dependency bot did not run this morning — _source unavailable_ so the next 16.2.6 + opennextjs 1.19.10 bumps from yesterday still stand.

### open threads

| project | last action | next action | link |
|---------|-------------|-------------|------|
| amna at 10 (wed 20 may 8am PT / 4pm UK) | jonelle's confirmed invite landed with full attendee list (fatima, gabriella, hejer + maria, lamis, jamie) | session lands tomorrow morning — debrief slot on the whirlpool agenda right after | gcal `Video Call: Amna/ Winded Vertigo Collective` |
| ubongo RFP (due fri 22 may) | jamie left two comments on v2 google doc this afternoon (team size; in-country research associate) | respond to jamie's threads tue eve / wed; lock financial proposal + EOI by thu | google doc `1IEAZV8gkqWVWr4bZBMM_y9YY78mNj_A5fAoW2uD00JM` |
| nordic naturals (sharon matheny) | sharon's zoom invite stable for thu 21 may 11am PT | prep brief wed eve: budget a+b proposal, project map, retainer/contract framing | gmail `19e3bf71bf462294` |
| PRME bibliography request (joseph satish) | forwarded via charlotta levay / pedagogy@unprme.org 6:13am PT — addressed to garrett + maria, starred | pull session-slide references + reply (warm, brief) — likely co-owned with maria | gmail `19e405f478340561` |
| whirlpool x harbour play lab (wed 20 may, 9–10:30am PT) | 15-min team review of each prime+ app is the forcing function; omna debrief slot booked | strategy-app loading bug still on garrett to fix tonight / pre-whirlpool | TASKS.md |
| dry run PPCS with maria (wed 20 may, 1pm PT) | maria-organised, recurring slot, accepted | hold the time — pairs with the amna session that morning | gcal `dry run PPCS` |
| co.rubric rebrand fan-out | rename shipped at 15:35 PT; companion + UDL fixes + race conditions all hardened | update CLAUDE.md infra/tool references + any external links pointing at /rubric-co-builder paths | commit `41add74` |
| wv x press play / sparkshapebuild portfolio page | payton has the html locally; awaiting clone + opus prompt scaffold | hand-off still on garrett — carried from monday | slack DM `D08BWAFRSS3` |

### waiting on external

- **jonelle / amna at 10 team** — invite confirmed, session lands wed 20 may; passive until tomorrow
- **jamie galpin (ubongo v2)** — left two google-doc comments today (1:22 + 2:24pm PT); awaiting his next turn on team-size + in-country scope decisions
- **sharon matheny (nordic naturals)** — call booked thu 21 may 11am PT; prep brief is on garrett
- **meredith storey (PRME)** — still OOO through american memorial day weekend; passive
- **lauren bosio (nordic naturals)** — folded into sharon thread; passive
- **PRME capstone (keith)** — _status to verify_ (carried from yesterday)
- **jennifer rose / manchester (PRME)** — unsolicited praise from sat 9 may, now 10 days owed; flag as potential ppcs lead
- **paul ramchandani (pedal conference)** — proposal still unanswered since the holiday; passive
- **KiwiCo international partnerships** — no response since 17 apr; passive
- **IDB Salvador** — evaluation committee reviewing apr 10 docs; passive monitor
- **CPA (aakib qureshi)** — new taxdome notification at 6:34pm PT today ("please complete Q2 2026 Tax Amplifier Organizer") on top of the unresponded 27 apr thread

### environment handoffs

**Cowork → Claude Code:**
- **strategy-app loading bug** — debug + fix the loading issue in `/strategy` on port (whirlpool action on garrett, prerequisite for tomorrow's group walkthrough); the redirect `/` → `/strategy` shipped today makes this an even higher-traffic page
- **next 16.2.4 → 16.2.6 bump** (windedvertigo + harbour-apps monorepos) — SSRF cvss 8.6 + middleware bypass cvss 8.1; tier-1 safe, still pending pre-launch
- **`@opennextjs/cloudflare` 1.19.4 → 1.19.10** — harbour-apps lockfile resolves to vulnerable range; deploy-blocker for next CF Workers push
- **harbour-apps registry 403** — `Host not in allowlist` on install; auth token needed for private registry
- **co.rubric rebrand follow-through** — sweep CLAUDE.md infra table, docs, and any hard-coded paths still pointing at `rubric-co-builder` / `rcb-companion`; smoke the renamed routes in prod
- **wv-crm vercel deletion confirmation** — 14-day rollback window closed sun 17 may; confirm `wv-crm` project deleted + update CLAUDE.md infra table to "zero vercel projects"
- **nordic literature retrieval API keys** — set `SEMANTIC_SCHOLAR_API_KEY` + `CORE_API_KEY` on `wv-nordic` CF Workers
- **values-auction production alias merge** — preview on `claude/self-running-auction-game-7CbZz` still live at `claude-self-running-auction.values-auction-d9m.pages.dev`
- **Neon decommission** — clean window ended 2026-05-04; delete project + update TASKS.md
- **CF cleanup** — revoke temp CF API token, delete DNS-only token, close anotheroption CF account
- **creaseworks content + refactor** — notion covers for playdates/packs/collections; phase 1 read-time `cover_url` refactor; body-content inline image sync

**Claude Code → Cowork:**
- **respond to jamie's ubongo v2 comments** — team-size thread (8–12 internal + 6–10 external) and in-country research associate scope in dar es salaam; both need garrett's call before locking the financial proposal
- **nordic naturals thu 21 may prep brief** — budget a + b, project map, retainer framing into one doc by wed eve
- **PRME bibliography reply (joseph satish via charlotta)** — pull session-slide references; co-own with maria; warm + brief
- **technical audit ask to august** — request comprehensive evaluation of prime+ apps + harbour architecture before 28 may (carried from yesterday's whirlpool action)
- **amna at 10 session debrief** — capture takeaways for the whirlpool 9am slot immediately after
- **wv x press play / sparkshapebuild handoff to payton** — clone monorepo on her laptop, scaffold the opus prompt (plan mode); _carried_
- **upload webinar takeaway kits 3A + 3B to commons** — maria sent end of thu 14 may; still pending
- **PRME capstone keith decision** — verify status (meredith still OOO so this can wait)
- **jennifer rose reply** — warm response to PRME session 2 praise; now 10 days owed
- **CPA taxdome** — Q2 2026 organizer reminder added on top of the 27 apr thread; still unresponded
- **dropbox plus decision** — trial expires thu 21 may; decide keep / cancel before billing kicks in
- **samantha thompson (PRME) mention** — pinged garrett at 12:24pm PT in the Certificate Evidence tracking google doc; check + respond
- **circulate holistic skills framework** — share with collective + consider tile candidate for 28 may launch
- **routine admin** — ADP, QuickBooks, gusto expense reviews

### mobile bookmarks

- _no genuine garrett→garrett self-DMs in last 24h_ — slack search returned zero results for both `from:@garrett to:@garrett` and `in:@garrett`; consistent with a head-down coding day. weekly-dependency bot post did not appear in the self-DM channel this morning (_source unavailable_ — bot may have been skipped or fired outside the 24h window)

---

## history (most recent first)

---

## 2026-05-20 (early AM) — port proposal pipeline fixed, strategy data moved to Supabase (Claude Code)

**what happened:**
- **wv-port-jobs NOTION_TOKEN fixed** — stale/wrong token in the `wv-port-jobs` CF Worker secret store was causing all proposal generation to fail with HTTP 401. `wv-port` and `wv-port-jobs` have separate CF secret stores; the jobs worker token was never set correctly. Fixed by reading correct token from build output and running `wrangler secret put NOTION_TOKEN --name wv-port-jobs`. Ireland Civil Society RFP (`359e4ee7`) was also stuck at "generating" in both Notion and Supabase — reset both to "failed" so auto-retry could fire.
- **document upload Supabase sync** — `document/route.ts` was writing `rfpDocumentUrl` to Notion only; the detail page reads Supabase. Added `setRfpDocumentUrl()` to `rfp-opportunities.ts` and call it fire-and-forget on upload. PR #104 merged (`afccd7d`).
- **TED + ADB added to RFP feed sources** — both confirmed working public RSS. Added directly to Notion `RFP feed sources` DB; both enabled and will be picked up by next `poll-rss` cron. DevelopmentAid confirmed inaccessible (JS SPA, auth-gated).
- **strategy Gantt + distribution moved from hardcode to Supabase** — PR #105 merged (`4453399`). Two new tables: `strategy_campaign_timelines` (6 campaigns) + `strategy_distribution_items` (12 items). Components now accept props instead of importing constants. Falls back to hardcoded arrays on error. Deployed to `wv-port` via `wrangler deploy`. To update data without redeploy: edit rows directly in Supabase Table Editor (`wv-port-pilot` project).

**key deployed commits:**
- `afccd7d` — fix(proposal-pipeline): wire cron handler + fix Supabase env mismatch in consumer (PR #104)
- `4453399` — feat(strategy): move Gantt + distribution data from hardcode to Supabase (PR #105)

---

## 2026-05-19 (night) — context-sync: heaviest engineering day of the quarter (30+ commits), co.rubric rebrand shipped, amna at 10 confirmed for tomorrow (Cowork)

**what happened:**
- **30+ commits across the windedvertigo monorepo today** — the single heaviest engineering day of the quarter, all logged between 9:59am and 19:14 PT.
- **co.rubric rebrand shipped** (`41add74` at 15:35 PT) — `rubric-co-builder` → `co.rubric` and `rubric-co-builder-companion` → `co.rubric companion`. paired with a stack of hardening commits: lazy-participant resilience with heartbeats + presence + auto-tally (`800e48f`), TOCTOU vote-quota race closed with advisory-lock transaction (`8e5984d`), hydration crash fix moving all hooks above early returns (`7b179db`), perf parallelisation via `Promise.all` (`f4c8a6c`), host_token persisted client-side (`d591b5d`), and UDL audit fixes #1/#3/#4/#5 on the main tool + #6 on the companion (table-scope + landscape print).
- **AICS new ground** — `/research/pcs/aics/new` page + CF env vars (`0d33d59`), batch import API + versions route + Cover-tab versions fix (`a4b4236`), three relational-integrity bugs fixed (`3392bd2`).
- **port/strategy bi-directional wiring** — live pipeline + PM project portfolio (`7745fc2`), `/projects/[id]` detail page (`e096a45`), nav redirect `/` → `/strategy` + docent banner (`9f19fd5`), strategy pipeline data refreshed + press play added to bookings (`329356c`).
- **admin/users surface** — User Directory with role chips + in-app role editing + invite email (`9b33b3c`), super-user added to role editor with hierarchy collapse (`c868a63`), privilege-escalation prevention in role assignment (`1a65e2f`), companion single-user worksheet tool (`30706b5`).
- **RFP pipeline cleanup** — Supabase env mismatch fix in consumer + cron handler wired (`afccd7d`), all edit-form fields sync to Supabase on PATCH (`826fc38`), document URL syncs to Supabase on upload + Notion error codes surfaced (`5b6a1fb`), Notion proposalStatus syncs to failed in rfp_not_found path (`2b7b41e`).
- **site / vault fixes** — `/vertigo-vault` redirect order fixed so PRME legacy links work (`bbe695e` #102), 3 vault-specific smoke probes added to `wv-launch-smoke` (`7d35ca1` #103).
- **CONTRIBUTING.md added** (`3fb0192`) — codifies the draft-PR-at-start workflow that landed in CLAUDE.md yesterday. proof the convention is now living in the repo.
- **commercial — jamie reviewed ubongo v2** at 1:22pm + 2:24pm PT, two google-doc comments: one nudging team size to "8–12 internal and 6–10 external", one on an in-country research associate scope in dar es salaam. proposal still on track for fri 22 may submission.
- **amna at 10 confirmed invite landed** — `Video Call: Amna/ Winded Vertigo Collective` wed 20 may 8am PT / 4pm UK; organised by jonelle gyamfi with fatima ribeiro, gabriella brent, hejer dhahbi on amna's side and maria, lamis, jamie added on ours. teams meeting link in the invite.
- **PRME bibliography request** — joseph satish forwarded by pedagogy@unprme.org (charlotta levay's address) at 6:13am PT, asking garrett + maria to share the references from last week's session-3 slides. starred + important.
- **samantha thompson (PRME) mention** — pinged garrett at 12:24pm PT in the "Certificate Evidence tracking" google doc.
- **CPA taxdome — Q2 2026 Tax Amplifier Organizer** notification at 6:34pm PT today, on top of the unresolved 27 apr thread.
- **calendar — wed 20 may:** Amna/winded vertigo video call 8am PT, whirlpool x harbour play lab 9–10:30am PT (aaron tentative, marietta needsAction), FruitStand 11am PT (with aaron + payton), dry run PPCS with maria 1pm PT.
- **slack search:** zero self-DMs, zero outbound messages from garrett in last 24h — consistent with a head-down coding day. weekly-dependency bot did not post in the self-DM channel this morning; _source unavailable_, may have been skipped.
- **slack DM sent to garrett (U06Q4UN4PKR).**

---

## 2026-05-18 (night) — context-sync: PRME session 3 reply shipped, nordic naturals call booked thu, ubongo RFP surfaced (Cowork)

**what happened:**
- **whirlpool x harbour play lab ran 9–10:30am PT** — maria out sick (slack DM at 8:56am: "won't make it to the whirlpool i am sick"); aaron + marietta in the room; 10 new action items logged to TASKS.md, including a technical-audit ask to august, a strategy-app loading bug for garrett, lamis on top-20 edtech journals, and jamie on ubongo proposal + claude max upgrade + claw evaluation. **harbour review forms got reframed** from solo design into a 15-min team review of each prime+ app at wed's whirlpool — group walkthrough is now the forcing function.
- **PRME session 3 reply to charlotta levay (NMBU) shipped at 3:17pm PT** ([gmail thread](https://mail.google.com/mail/u/0/#inbox/19e2aa821394ac4a)) — warm and charitable, closes a friday-owed thread.
- **nordic naturals contract path broke open** — sharon matheny back from conference travel; garrett confirmed thu 21 may 11am PT in her DM sun night; sharon's zoom invite landed mon 4:41pm PT ([gmail](https://mail.google.com/mail/u/0/#inbox/19e3bf71bf462294)). this is the active commercial thread — prep brief needed before wed eve.
- **new RFP surfaced — ubongo 10-year impact learnings report (2015–2025), due fri 22 may** — [notion page](https://www.notion.so/Ubongo-10-Year-Impact-Learnings-Report-2015-2025-Consultant-RFP-bc2eef88b540462abfdd97802461f95e). jamie drafted v1; garrett ran v2 through claude vs the TOR at 6:17pm PT and shared the [google doc](https://docs.google.com/document/d/1IEAZV8gkqWVWr4bZBMM_y9YY78mNj_A5fAoW2uD00JM/edit?usp=sharing) for jamie's review.
- **payton briefed for wv x press play portfolio migration** — payton has the html locally and asked garrett to clone the monorepo onto her laptop + scaffold an opus prompt (plan mode) to migrate the page to `windedvertigo.com/portfolio/sparkshapebuild`.
- **engineering — 5 commits today on windedvertigo**, all on the `wv-port` harbour-launch-map route: `1da4436` serve from `public/` with rewrite → `f664345` embed as bundled ts constant → `3464895` inline html into route.ts → `e1d2c26` replace runtime=edge with dynamic=force-dynamic; plus `99b2eac` weekly auto-sync. four iterations on a single bundling problem.
- **weekly dependency review** (self-DM bot, 6:15am PT): tier-1 safe bump = **next 16.2.4 → 16.2.6** (SSRF cvss 8.6 + middleware bypass cvss 8.1) + **`@opennextjs/cloudflare` 1.19.4 → 1.19.10** (harbour-apps deploy-blocker). Also: anthropic-ai sdk drift across repos, workflow devkit v4.x has HIGH vulns in nordic-sqr-rct.
- **meredith storey OOO** through american memorial day weekend per auto-reply landed 3:03pm PT — PRME thread on pause until after the holiday.
- **kristin's delayed reply** to garrett's 16 apr feedback-thank-you email arrived 1:10pm PT ([gmail](https://mail.google.com/mail/u/0/#inbox/19e3b35a463da0f2)) — gracious, no action needed beyond a kind close.
- **CPA taxdome auto-reminder** landed today 8:12am PT, still unread; carries from 27 apr.
- **calendar — tue 19 may:** bi-weekly strategy playdates 8am PT (lamis + maria — maria's status TBD given sickness), weekly = lamis x garrett 9am PT, weekly = garrett x maria part i 11am PT (likely affected by maria's illness), PRME hold 12pm PT (meredith OOO, so likely just sam thompson).
- **slack DM sent to garrett (U06Q4UN4PKR).**

---

## 2026-05-17 (night) — context-sync: heavy claude-code sunday, rubric-co-builder migrated to CF Workers + 8 hardening tiers, nordic PCS literature retrieval shipped (Cowork)

**what happened:**
- **engineering completely flipped from yesterday's "dormant"** — 16 commits in the last 24h across the windedvertigo monorepo, all from a focused sun claude-code session after garrett got back from great wolf lodge.
- **rubric-co-builder migrated to CF Workers** (`67f156e`, sat 23:20) with site proxy rewrite restored; then 8 hardening commits landed in tiered pairs through sun morning: `7706071` (1A host_token + facilitator guard), `65ddfcc` (1B participantExists guard on all writable routes), `6950c0a` (2A alphabet dedup + TOCTOU fix + criterion ownership + pledge indexes), `6330a1f` (2B 60-participant cap + 300/24h room rate limit), `21d2c02` (3A SVG wordmark + branded 404 + watch bg), `031e735` (3B security to devDeps + ANTHROPIC_API_KEY startup warning), `1a4e3e9` (TS hoist alias fix). net-new live infra surface that wasn't here yesterday.
- **nordic PCS evidence platform got a major upgrade** — `e825e66` literature retrieval tool with zenodo + ORCID tiers and cost-savings analytics; `8ebdf24` clarified search vs. discovery distinction on the evidence library page; `d65bed7` extended backfill endpoint with opt-in platform-retrieved marking; `c342134` expandable rows + refined column design on the pcs-evidence table.
- **site `/do` gallery rebuilt** (`344b982`) to query the BD assets sub-collection directly rather than going through the parent surface.
- **middleware + perf work** — `b96c205` Fix A revised with valid JWT + await-gate for jose JIT pre-warm; `eae2325` eliminated cold-start JIT penalty + edge-cache login page + fixed ISR on API route; `8f092fa` suspense wrapping + drift-sync timeout resilience + lib import cleanup.
- **commercial side is quiet** — no movement on sharon matheny (nordic naturals) yet; gmail inbox shows zero unread in last 24h; PRME session 3 reply to charlotta levay still owed.
- **harbour review forms now 6 days past deadline** — claude-code session prioritised rubric-co-builder hardening and pcs-evidence over forms; tomorrow's whirlpool x harbour play lab (9–10:30am PT, aaron fruit + marietta monge again) is the forcing function.
- **calendar — mon 18 may:** weekly site check 7am PT, whirlpool x harbour play lab 9–10:30am PT (lamis + jamie + maria + marietta confirmed; aaron tentative; payton needsAction), weekly = payton x garrett 11am PT, ortho 11:30am PT (declined on w.v calendar; accepted on personal).
- **slack search:** zero self-DMs in last 48h (consistent with great wolf lodge weekend + coding session).
- **wv-crm vercel rollback window closes tonight** — port CF Workers held stable through the 14-day rollback window; mon morning is the clean delete moment.
- **dropbox plus trial reminder:** 4 days left, billing kicks in thu 21 may.
- **slack DM sent to garrett (U06Q4UN4PKR).**

---

## 2026-05-16 (night) — context-sync: true family weekend, nordic naturals contract email pre-emptively sent friday, harbour review forms now 5 days past deadline (Cowork)

**what happened:**
- **engineering completely dormant** — zero commits in last 24h across the windedvertigo monorepo. consistent with garrett at great wolf lodge with the girls; the family weekend is genuinely a weekend.
- **major commercial signal: nordic naturals contract move** — surfaced in this sync from sent-mail (was missed last night): garrett emailed sharon matheny on fri 15 may at 8:46am PT (gmail `19e2c50f94751e9a`) titled "nordic research platform — budget a + b, ready to move to contract." pre-emptively timed for sharon's monday return from conference travel. gina jaeger replied saturday morning (gmail `19e30b955342f08f`) endorsing the email as "very well crafted and tasteful." this folds the previously-passive "lauren bosio post-demo follow-up" into a clear commercial ask now sitting in sharon's inbox.
- **PRME session 3 reply to charlotta levay still owed** — friday's apology email remains starred + unread; carries into monday morning.
- **harbour review forms now 5 days past deadline** — no commits, no surfacing. monday 18 may whirlpool x harbour play lab becomes the natural forcing function (calendar already shows attendees aaron fruit + marietta monge in addition to the regular crew).
- **wv-crm vercel rollback project sunsets today (sun 17 may)** — port CF Workers stable through this window; cleanup is monday morning, then the vercel surface is officially zero.
- **calendar — sun 17 may:** empty (last day at great wolf lodge).
- **calendar — mon 18 may:** weekly site check 7am PT, whirlpool x harbour play lab 9–10:30am PT (with aaron fruit + marietta monge as new guests), weekly = payton x garrett 11am PT, ortho 11:30am PT (declined on w.v calendar; accepted on garrett's personal gmail).
- **gmail signal noise:** only fresh signal is gina's saturday reply on the nordic email; otherwise notion marketing newsletter (noise).
- **slack search:** zero self-DMs in last 24h (consistent with true family weekend, no work parked from the road).
- **dropbox plus trial reminder:** 5 days left, billing kicks in thu 21 may.
- **slack DM sent to garrett (U06Q4UN4PKR).**

---

## 2026-05-15 (night) — context-sync: quiet recovery day, nordic PCS perf + cache shipped, new PRME session 3 signal from charlotta levay (Cowork)

**what happened:**
- **engineering pivoted to nordic-sqr-rct PCS work** — 5 commits today: `dc0fa49` persistent supabase cache for backfill proposals (migration 009), `7ab17c8` wrangler bump to ^4.92.0, `6d549f9` may 2026 collaboration audit + 4 starter skills in handbook, `d8c7688` single-flight dedup + skip applied claims + early-exit levenshtein on backfill-review, `0af2db5` readable bucket labels replacing UUIDs in PCS table 3.
- **new PRME signal** — charlotta levay (NMBU) emailed an apology today (gmail `19e2aa821394ac4a`, starred + important) referencing "session 3 of the PRME pedagogy certification programme" yesterday where she "confronted [garrett] with a barrage of critique" in a breakout group. session 3 ran thu 14 may unprompted in last night's sync — the values-auction webinar drowned it out. flagged for warm reply post-great wolf lodge.
- **google search console milestone** — windedvertigo.com hit 50 clicks in the past 28 days (sc-noreply@google.com). small but a clean signal that organic surface is growing.
- **dropbox plus trial reminder** — 7 days left, billing kicks in thu 21 may. decide before then.
- **gmail signal noise:** stripe smart-disputes feature announcement (no action), no other live external threads in last 24h.
- **calendar:** sat 16 → mon 18 may window is empty in primary calendar; weekend is uninterrupted family time at great wolf lodge.
- **slack search:** no self-DMs in last 24h (both `from:@garrett to:@garrett` and `in:@garrett` returned zero results).
- **harbour review forms now 4 days past deadline** — still no commits surfacing the priority-app review forms.
- **wv-crm vercel rollback project sunsets sunday** (17 may) — port CF Workers stable through this window; safe to delete on monday.
- **slack DM sent to garrett (U06Q4UN4PKR).**

---

## 2026-05-14 (night) — context-sync: heaviest day of the month — values-auction 300-person webinar landed clean, nordic Postgres Path 3 shipped, amna at 10 finally scheduled (Cowork)

**what happened:**
- **values-auction v2 webinar ran today** — maria led, garrett + payton supported, ~300 participants, 20 companies in 8 teams. ran cleanly aside from a room-10 audio anomaly (room was getting plenary audio inside the breakout — workaround: spare-room moves). debrief reactions: "v2 was cleannnn", "much smoother". maria sent takeaway kits 3A + 3B to drive at end of day; garrett to upload to commons after great wolf lodge.
- **nordic Postgres migration Path 3 shipped end-to-end** in four sequential commits today: `c9151df` Phase 1 scaffold, `0d6a604` Phase 2 AICS read-path + backfill, `42e50e8` Phase 3 SQR-RCT read-path + backfill, `b04420a` Phases 4+5 dual-write + sqr-sync.js fix. Plus `4aff614` two nordic sync bugs fixed (evidence-packets + stale watermarks).
- **values-auction hardening continued** — Phase A.2 websocket reconnect (`#80`), A.3 broadcast actions only (`#82`), B-min DO snapshot authority (`#83`), heartbeat cut 12x with debounced localStorage (`#79`).
- **values-companion shipped as standalone tool** at `/tools/values-companion` (`#81`); two same-day mobile fixes (`#86` font scaling +20%, `#87` mobile overlap revert).
- **today's calendar:** moniker + more with august kinloch 9–10am PT (notion `360e4ee74ba480b2b23bf9a379405426`), nordic research platform demo with lauren bosio 10:30–11:30am PT (gemini notes `19e27f903d6b3e89`), values-auction webinar through the afternoon, miller creek MS family mixer 4–6pm PT.
- **amna at 10 status flipped overdue → scheduled** — jonelle replied 11 may with a revised slot of wed 20 may 4pm UK time; garrett accepted same evening and asked her to add maria, lamis, jamie, sam. Now waiting passively for the confirmed invite.
- **harbour review forms now 3 days past mon 11 may deadline** — no commits surfacing; carried into open threads + claude-code handoff.
- **PRME capstone (keith)** tue 12 may hold has passed; _status to verify_ — may have been resolved verbally.
- **gmail signal noise:** suspicious cold outreach from `erobinson@reintakersoffer.com` and `davidb@demo-zone.info` (san rafael "coffee talk" follow-up) — both look like sales prospecting, no action.
- **tomorrow (fri 15 may):** light — only R&D meeting with gina at 11am PT; family at great wolf lodge.
- **slack search:** no genuine self-DMs in last 24h (results were live webinar coordination + warm-down with maria).
- **slack DM sent to garrett (U06Q4UN4PKR).**

---

## 2026-05-10 (night) — context-sync: port strategy/analytics consolidation, session-encryption lib pinned, harbour review forms due tomorrow (Cowork)

**what happened:**
- **port marketing surfaces (2 commits today):** `d97936e` folded `/analytics` into the strategy page's pipeline + campaigns tabs (single consolidated marketing surface), `f072f42` added month navigation to the campaign calendar. quiet sunday otherwise.
- **port session-encryption lib bump deployed ~13:45 PT** — quietly invalidated existing sessions; lib now pinned. garrett sent identical heads-up DMs to maria (`D08BBE7KPEU`), lamis (`D08H6CRDG5A`), and payton (`D08BWAFRSS3`) with the signout-then-signin recovery path. no replies yet.
- **gmail (24h):** only fresh signal is jennifer rose / manchester continuation of the PRME session 2 thread from sat 9 may — already on the open-threads board.
- **calendar — tomorrow (mon 11 may):** wv site check 7am PT, whirlpool x press play 9–10:30am PT (with casper, jan), weekly = payton x garrett 11am PT. natural window for harbour review forms before whirlpool + amna slot reply after payton sync.
- **harbour review forms deadline lands tomorrow** — single biggest unfinished commitment of the week; carried 5 days from the 5/6 whirlpool action.
- **amna at 10 reply now ~74h overdue** (3 days). bumped to second slot on open threads.
- **vercel `windedvertigo` failed-deploy alarm:** no fresh sweep this run; _status to verify_ next sweep.
- **slack search:** no genuine self-DMs in last 24h (search returned only outbound heads-ups to collective members).
- **slack DM sent to garrett (U06Q4UN4PKR).**

---

## 2026-05-09 (night) — context-sync: homepage typewriter collaborators live, port conference intelligence on CF Workers, linkedin oauth migrated (Cowork)

**what happened:**
- **homepage typewriter collaborators feature shipped** in five rapid morning commits (`23cb152` typewriter + full-name cleanup, `6078911` scratch/EPFL/LEGO foundation back, `a74bd9f` white text + CCE name correction, `fb632fc` LEGO always caps, `d81015e` interleave current/past + lightbulb learning lab). active + past collaborators now rotate on the homepage with consistent full-name treatment.
- **port: phase 1-8 conference intelligence pipeline migrated to CF Workers** (`c88ade6`, includes AI hub fix). **linkedin oauth + token refresh migrated from vercel to CF Workers** (`728ad6d`) — continuity infra work, no user-facing change.
- **inbound positive signal:** jennifer rose (university of manchester) emailed unsolicited praise after listening to the recording of PRME pedagogy session 2 (gmail thread `19e0cf4e22c12937`); warm reply + flag as potential ppcs lead.
- **calendar:** sat 9 may was clear (no scheduled meetings). **tomorrow (sun 10 may):** clear — recovery day. **monday (11 may):** wv site check 7am PT, whirlpool x press play 9-10:30am PT (with casper, jan), weekly = payton x garrett 11am PT.
- **vercel `windedvertigo` failed-deploy alarm:** no new escalation in this sweep; _status to verify_ next sweep before claude-code action.
- **slack search:** no self-DMs in last 24h.
- **slack DM sent to garrett (U06Q4UN4PKR).**

---

## 2026-05-08 (night) — context-sync: holistic skills framework page shipped, port conference intelligence pipeline lands, 10k pageviews milestone (Cowork)

**what happened:**
- **holistic skills framework page shipped on portfolio** — `26df4b7` initial page + WCAG fixes; `5950d25` radial view added; `2f49024` anchored typographic labels in OECD compass pattern. garrett shared the URL with maria at 12:27 PT; she returned PPCS 1b/2a/2b as ready over the afternoon.
- **port: Phase 1-8 conference intelligence pipeline shipped** (`8804154`) — substantial new feature; competitors sync backstop + daily-schedule fix landed alongside (`28dfb71`).
- **lab playground refactored** down to two full-page mockups (typewriter + slow tide, `4a05f5e`); WCAG pause buttons added across all 5 auto-playing variants (`8c3016e`); museum + torn paper swapped for phosphor + breath (`60fe62e`).
- **read-the-room WCAG AA pass complete** (`a68f147`) — pos-tag contrast, taken-tile legibility, card-label gradient. plus back buttons + 2-6 player count + size-picker copy clarification.
- **today's calendar:** Sarah/Lightbulb 9-10am PT (connecting catch-up); R&D w/ gina 11-11:30am PT (recurring); PPCS biblio + post w/ maria 11am-1pm PT (gemini auto-notes filed at 13:08 PT). the friday calendar conflict flagged in last night's sync resolved naturally — both attended.
- **cloudflare 10,000 pageviews milestone** on windedvertigo.com (forwarded by maria 11:11 PT); positive launch-readiness signal.
- **payton claude-bot status 11:30 PT:** spending today on _learning to fly_ + jamie outreach + press play prep + miro; PPCS post if time permits.
- **whirlpool agenda for mon 11 may** already drafted in notion (`35ae4ee74ba481569d46d8cc6b68f601`).
- **vercel `windedvertigo` failed-deploy alarm:** no new escalation in this sweep; _status to verify_ next sweep before claude-code action.
- slack search: no self-DMs in last 24h.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-05-07 (night) — context-sync: amna unblocked after 42 days, nordic phase B write-path flip lands, vercel windedvertigo deploys failing (Cowork)

**what happened:**
- **amna at 10 unblocked** — jonelle replied today (may 7, 16:01 UTC) after a 42-day silence with a revised timeline and an invite to a call. status flips from "32 days overdue → silent" to "active, schedule it." promotes to top-priority next-action.
- **nordic CF Workers canary heavy commit day** — phase B write-path primitives + flip (`78003b5`, `aa5bc8e`), drift-sync parallelised across 13 tables (`e39f35f`), `maxDuration` Vercel-specific dead code removed (`9020e3e`), Path 2 architecture doc landed (#41), Notion webhooks runbook + wrangler post-migration cleanup (#38). Phase F.5 cutover is the next gate.
- **read-the-room rename shipped** — feel-cards renamed across harbour with admin wipe + escape hatches (`1b43c61`); deploy-site guard added (`bb3d457`); durable URL config (`1edc294`).
- **Vercel `windedvertigo` failed prod deploys** — 3 failures 21:24-21:27 UTC on team `ghandoffs-projects`; likely related to today's Vercel Blob → CF R2 storage migration (`cf2c4f5`). flagged for claude code investigation.
- **PRME thread still warm** — meredith's 6 may "PRME capstone project" note proposes keith engages "to the maximum" despite teaching scope; wv team owes a reply with a tier decision.
- **PRME pedagogy AM session ran this week** — costa manolchev replied 7 may with positive feedback ("such a great first session"); ekaterina ivanova reacted. signal that delivery is landing.
- tomorrow (fri may 8): R&D meeting 11am, sarah/lightbulblearninglab call 9-10am PT, PPCS biblio + post w/ maria 11am-12pm.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-05-08 — ported "holistic skills: a primer" to /portfolio/holistic-skills-a-primer/ (Claude Code)

**what happened:**
- ported the PRME PPCS holistic-skills primer (3,100 words, 5 skillsets, 21 individual skills, references) from the public Notion site (`superb-shrimp-129.notion.site/holistic-skills-a-primer-2c3e4ee74ba480598691f6d1e6c572fc`) into a native TSX page on `windedvertigo.com`.
- **canonical URL:** `https://windedvertigo.com/portfolio/holistic-skills-a-primer/`
- **files added:** `site/app/portfolio/holistic-skills-a-primer/{page.tsx,primer.tsx,primer.module.css}` + 2 images at `site/public/portfolio/holistic-skills-a-primer/img/{framework-map.png,divider.png}` (re-hosted from Notion's signed S3 URLs which expire).
- **content is static / inlined** — chosen over live Notion ISR fetch because the primer is evergreen reference content. future edits = edit `primer.tsx`, not Notion.
- **portfolio gallery card surfaced** by adding row to BD assets DB (`5e27b792adbb4a958779900fb59dd631` / data source `collection://6e8dbbd9-0a14-4342-9154-88fa379b0533`). Notion page: https://www.notion.so/35ae4ee74ba48157bf8cf037050ddeb5. set Show in Portfolio = YES, Quadrant = people × research. Card appears on `/do/` after 5-min ISR (or immediately via `/api/warm-cache`).
- **build verified** — `npm run build` green; the route is in the static prerender table at 5m revalidate.

**out of scope, flagged for follow-up:**
- the 13 "Codebook: …" links inside the primer still point to public Notion pages on `superb-shrimp-129.notion.site`. If those Notion pages move/unpublish, the links rot.
- `site/portfolio/GUIDE.md` is stale — describes a `/portfolio/index.html` landing page that doesn't exist.
- 18 decorative per-skill icons were `attachment://` block refs and were skipped.

---

## 2026-04-27 (night) — context-sync: PPCS week in motion, anthropic tier 4 landed, dev-collaboration handbook shipped (Cowork)

**what happened:**
- **whirlpool ran today** — fresh action set logged in TASKS.md: payton ↔ jamie on facilitation guides, each member writes a paragraph on maria for wed celebration, payton leads wed solo (garrett at UC-riverside), team drafts plain-language transformative-theory-of-change substack post, garrett + maria finalised thursday's PPCS session 1 anchor leg.
- **6 commits today on windedvertigo repo:** dev-collaboration handbook (3 commits — `696eb8a` add doc, `ec45c7a` render to /handbook/dev-collaboration, `b7c1108` section 8 IP & promotion when building for prme), site fix `30b5dfc` (static-assets incremental cache, drop R2 binding — likely the wv-site CF workers redeploy that gated the PPCS countdown tool), `dcceee3` safe-tier dep bumps, `0e58ab3` weekly auto-sync.
- **anthropic api tier 4 approved** — sales@mail.anthropic.com confirmed account on Build plan with Tier 4 limits; rate-limit increase request resolved. removed from waiting-on-external.
- **maria added a dry-run PPCS 1a** for wed apr 29 13:00-14:00 PT — slot between the UC-riverside panel and decompression.
- **gina declined** the cross-calendar UC-riverside PD panel invite; garrett still attends solo wed 9am-12pm PT.
- **PPCS launch tool prod verification blocked** — automated smoke probe hit 403 from the workspace allowlist (`X-Proxy-Error: blocked-by-allowlist`); need manual browser check or allowlist whitelist before thursday.
- **vercel harbour-apps preview** — two more preview deployment failures today at 16:04 UTC (continuing the post-CF-migration noise).
- **CPA active again** — aakib qureshi sent a fresh taxdome secure message; reply pending.
- **gusto added a new task** — review 1 employee expense, due mon may 4.
- **tomorrow stacks four meetings 9am-1pm PT**: lamis 9am, randall 10am, maria 11am, PRME hold (meredith + sam) 12pm — natural lock-in moment for survey + facilitation cadence decisions.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-26 (night) — context-sync: PPCS week begins, harbour launch path gated on three small actions (Cowork)

**what happened:**
- **PPCS launch is the week's centre of gravity** — session 1 goes live thursday apr 30; the countdown tool (commit `350c772`) is still queued for a CF workers `wv-site` redeploy; anchor-leg prep with maria locked in for monday 10:30-2pm PT straight after whirlpool.
- **harbour pre-launch path** is now ~6 weeks out and entirely gated by three small user actions (oauth redirect URI, deploy script, slack webhook). all phase 0-5a code complete from yesterday's claude-code session.
- **PRME comms** — metz @ UN GC is the most time-sensitive external thread; survey platform decision needed before kick-off comms go out.
- **vercel harbour-apps** continued to fail overnight; project should likely be retired now that traffic is on workers.
- **cash $28,208** — strongest position since formation; PRME revenue recognised cleanly.
- **calendar** — sunday clear; monday: 7am site check, 9am whirlpool, 10:30-2pm PPCS prep with maria; wed apr 29 has UC-Riverside PD panel @ 9am that collides with whirlpool.
- duplicate `### open threads` block in the live state (carried over from prior sync) cleaned up; live block now reflects single source of truth.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-25 (night) — context-sync: infra day complete, vercel failures flagged, PRME programme starting (Cowork)

**what happened:**
- **massive infra day closed out** — CF zone consolidation complete (zone at garrett account `097c92553b268f8360b74f625f6d980a`); site + harbour + depth-chart live on CF workers via opennext; port agent (`wv-claw`) live end-to-end in slack DM. R2 migration complete.
- **vercel production failures** — 4x overnight build failures (port x2, harbour-apps x2 at 5:33am + 6:19am) likely caused by CF domain migration. claude code needed to investigate.
- **CF KV free tier exceeded** — daily 1,000 put limit hit 12:31am apr 25; context-sync or dispatch writes likely culprit.
- **cash at $28,208** — strongest position since formation (+$26,136 since apr 1); PRME revenue landing well.
- **IDB Salvador resolved** — nadia.nochez confirmed receipt of apr 10 documentation; evaluation committee reviewing.
- **PRME programme start** — sam thompson + metz (UN GC) asked about feedback survey/qualtrics expiry apr 24; garrett replied. metz follow-up still unread.
- **ADP invoice** — week ending apr 25 arrived; needs payment.
- **health insurance deadline approaching** — gusto april 30 (5 days).
- **google security alert** — new sign-in on mac flagged overnight (likely legitimate post-migration session).
- tomorrow (sun apr 26): calendar clear — recovery day.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-25 — full-day infra push: CF zone consolidation finished, site + harbour + depth-chart on workers, port agent live, R2 image migration (Claude Code)

**what happened (~14 hour session):**

**infrastructure shipped:**
- **CF zone consolidation finished** at 2026-04-25T01:43 UTC — windedvertigo.com zone now lives at the garrett account (`097c92553b268f8360b74f625f6d980a`).
- **site → CF Workers**: windedvertigo.com migrated vercel → workers (`wv-site` via opennext). Vercel project `windedvertigo-site` deleted.
- **harbour → CF Workers**: migrated to `wv-harbour-harbour`; notion client v2 → v5 upgrade.
- **depth-chart fully provisioned on workers**: own CF routes (bypasses site router); auth flow works end-to-end; SSO via shared `.windedvertigo.com` cookie verified.
- **port agent (`wv-claw`) deployed end-to-end** — `@wv-claw what campaigns are active?` works in slack DM.
- **nordic.windedvertigo.com** custom domain attached to existing vercel project.
- **R2 image migration completed** across vault, harbour, creaseworks (creds repair), site.

**key fixes:**
- **vault cover image bucket access restored** after CF account migration: re-enabled `r2.dev` public access, updated `R2_PUBLIC_URL`, rewrote 72 DB rows via `fix-cover-urls.mjs` migration script. Vault refactored to compute `cover_url` from `cover_r2_key` at query time.
- **harbour tile sync** via admin endpoint `POST /harbour/api/admin/sync-tiles` (16 from notion + 3 fallback to repo statics).
- **creaseworks R2 access keys** synced from vault — was stuck on stale anotheroption keys, sync silently failed.
- **auth.js v5 redirects on workers**: fixed via `WORKERS_AUTH_PAGES_BASEPATH` env var on depth-chart, prefixes `pages.error` / `signIn` paths.

**known incomplete:** creaseworks notion sync runs but `cover_url` still NULL because notion source pages have no covers (content work pending).

**pending for next session:**
- add cover images in notion for creaseworks playdates/packs/collections
- apply phase 1 refactor to creaseworks (decouple cover_url from R2 URL hash, mirror vault pattern)
- body-content image sync (parse body_html for inline notion images)
- revoke temporary CF API token; delete DNS-only token; close anotheroption account

migration record: `~/.claude/plans/partitioned-painting-pascal.md`. infrastructure state table in `CLAUDE.md` already updated.

---

## 2026-04-24 (night) — context-sync: IDB receipt confirmed, cloudflare consolidation done, harbour → workers migration, port still failing (Cowork)

**what happened:**
- **IDB Salvador UNBLOCKED** — nadia.nochez@mined.gob.sv confirmed receipt of the apr 10 documentation (10:38pm apr 24); evaluation committee actively reviewing. 14-day silence resolved — no action needed until outcome.
- **cloudflare account consolidation**: windedvertigo.com zone successfully moved to `garrett@windedvertigo.com` account (cloudflare confirmation emails at 1:42am + 1:44am apr 25). R2 buckets, workers, KV/D1 bindings still need verification under new account.
- **harbour → cloudflare workers migration**: 4 commits today — opennext migration, worker routes for windedvertigo.com, portfolio assets routes (systems-thinking + values-auction), `/do` page fallback fix. significant infrastructure shift.
- **cloudflare workers KV free tier exceeded**: daily 1,000 put limit hit (alert received 12:31am apr 25). context-sync or dispatch writes are the likely culprit — need upgrade or throttling.
- **port deployment failures**: 6+ vercel failures across apr 24; 1 more at 2am apr 25. urgent claude code task.
- **PRME programme comms active**: sam thompson (UN GC) asked about feedback survey + follow-up email comms; garrett replied same day. alex brewer sent discussion post formatting notes; garrett forwarded to maria.
- **harbour/portfolio placement question**: garrett asked maria whether her games should live in harbour vs portfolio — awaiting her input.
- **gusto**: payton jaeger's bank account details updated (routine notification, no action needed).
- tomorrow (sat apr 25): terbinafine repeat LFT calendar reminder, NFL draft rounds 4-7 (9am-2pm). no work meetings.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-23 (night) — context-sync: harbour build failing, vercel account merge started, CPA escalating, health insurance deadline, supabase added (Cowork)

**what happened:**
- **harbour production deployment broken** — two failed builds at 1am apr 24 (emails from notifications@vercel.com). likely caused by three-intelligence-workbook PR (#4) or the vercel account consolidation now in progress. claude code needed urgently.
- **vercel account consolidation started** — `anotheroption@gmail.com` sent two vercel team invites to `garrett@windedvertigo.com` (12:40am + 12:44am apr 24): "ghandoff's projects" + "winded vertigo" teams. this is the TASKS.md consolidation work beginning. R2 / KV / workers bindings need verification.
- **engineering**: 1 commit — `9ba44ee feat(site): add three-intelligence-workbook at /harbour/three-intelligence-workbook (#4)` — new harbour tool live (or attempting to be).
- **CPA escalating**: abhishek sachdeva (2 messages) + aakib qureshi (2 messages) sent new taxdome secure messages on apr 23. now 4 unread messages in the portal — tax work is actively blocked on garrett's response.
- **health insurance**: gusto email flagged june 1 coverage deadline is **april 30** (7 days) — unactioned.
- **supabase added to stack**: welcome email arrived apr 23; garrett is onboarding maria to the engineering stack (github email + apps developed — stack migration in progress).
- **PRME**: maria resolved 4 suggestions on ppcs-2026-session-1a this morning. PPCS anchor prep meeting set for mon apr 27.
- **cash**: $3,924 (morning briefing). chase ink CC payment was due today — status unconfirmed.
- **save the children**: draft consultancy application spotted in gmail (climate resilience CCCRM) — unclear if garrett or maria started it; needs triage.
- **tomorrow (apr 24)**: laton appt (10:50am), R&D meeting with gina (11am), NFL draft rounds 2-3 (4pm).
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-22 (night) — context-sync: facilitation guide in production, nordic doc landed, press play tiers set, CRM 404 bug flagged (Cowork)

**what happened:**
- **PRME facilitation guides**: maria made active suggestions in ppcs-2026-session-1a-facilitation-guide.docx (8:26am). production underway. meredith's timeline response still outstanding (32h).
- **nordic naturals**: connect call with lauren bosio happened today (3pm). post-call, lauren shared "standardisations of substantiation data" google doc at 5:55pm — review + comments needed.
- **press play whirlpool** (apr 22): service tiers defined (playful injection as entry point), pedal conference (paul ramchandani) identified as primary target. payton leading co-branded landing page + first campaign draft for may 11.
- **engineering**: 2 commits — the-mashup whirlpool facilitation tool + clean URL redirects shipped.
- **CMO dispatch flagged**: CRM campaign 404 bug (POST /api/campaigns, payton reported apr 17) blocking all email sends — claude code urgent. harbour whisper campaign behind: 9 days to may 1, no teasers live yet.
- **cash confirmed**: $5,076 ($3,500 owner draw; operating burn -$496 MTD).
- **anthropic ZDR request** filed at 3:22am apr 23 to support@anthropic.com re: production API key.
- CPA TaxDome (fifth+ reminder) still unactioned. IDB MINEDUCYT receipt at 12 days — escalate with maria.
- tomorrow (thu apr 23): garrett × maria weekly (9am), personal appointment (12:30pm), NFL draft r1 (5pm w/ gina). chase CC payment due.
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-21 (night) — context-sync: PRME facilitation guide urgency, writing retreat underway, wire sent (Cowork)

**what happened:**
- **PRME urgency**: meredith's team requested facilitation guides by tue apr 22 (tomorrow). maria flagged this is the final webinar development phase. garrett proposed to meredith: preview tuesday + full guides thursday. awaiting response.
- writing retreat happened today — payton accepted garrett's suggestion in "first fold: seven drafts from unfolding v3". Substack piece on "play, aliveness, justice" taking shape.
- chase wire transfer confirmation received this morning — wire sent (likely second lamis payment or PRME-related).
- gina jaeger (nordic naturals) shared "WindedVertigoMaterials" dropbox folder with garrett — new collaboration asset for nordic naturals work.
- playdate intake flow tested: garrett self-booked a "general" playdate — form is working.
- carly ciarrocchi reference request via Happily freelancer platform landed — unactioned.
- CPA: fifth TaxDome reminder (tax extension organiser + missing docs) — remains unactioned.
- no git commits today — engineering quiet.
- tomorrow (wed apr 22): m&m&g (8:30am), whirlpool x press play (9am), payton sync (10am), fruitstand (11am), nordic naturals zoom with lauren (3pm).
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-20 (night) — context-sync: PRME payment received, API credits resolved, rubric-co-builder live (Cowork)

**what happened:**
- **PRME payment landed** — garrett confirmed to lamis via slack DM at ~6pm PT: "$1000 wired, more at month end." removes the longest-running external blocker (24 days outstanding).
- claude API credits topped up — anthropic receipt #2389-1698-5975 arrived; individual org outage from yesterday resolved.
- 7 commits today: dep bumps (notionhq/client v5, typescript 5→6, @types/node 22→25, resend 6.12.1, protobufjs security fix, ancestry deps aligned) + `feat(site): proxy /harbour/rubric-co-builder` — new tool live on site.
- new lead: maria applied to childfund américas consulting opportunity (solicitud de TDR), CC'd garrett.
- carly ciarrocchi replied to garrett's email — enthusiastic, asking about TED x LEGO playday NYC may.
- anthropic rate limit increase requested — added to queue, no timeline.
- miro renewal charged (receipt #2722-9307) — needs check at next stack audit.
- CPA: fourth TaxDome reminder still unactioned — remains #1 urgent admin item.
- tomorrow stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm).
- slack DM sent to garrett (U06Q4UN4PKR).

---

## 2026-04-19 (night) — context-sync: writer's room shipped, claude API credits depleted (Cowork)

**what happened:**
- 5 git commits today: writer's room whirlpool tool live at `/tools/` on the site, ancestry auth.js sign-in fallback link, next-env.d.ts regenerated after production build, brain memory updated.
- new urgent item: claude API credits depleted for garrett's individual org — action-needed email arrived apr 20 ~4am UTC. individual API access disabled until credits topped up.
- CPA: third TaxDome reminder for 2025 individual tax extension organiser landed apr 20 morning — still unactioned.
- PRME: payment now 23 days outstanding. "winded.vertigo & PRME" meeting confirmed on calendar for tue apr 21 12pm PT — key escalation moment.
- tomorrow's calendar: site check (7am), whirlpool (9am). tuesday stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm — new meeting added apr 18).
- notion: only world bank procurement alerts in last 24h — no project status changes.
- slack DM to garrett could not be sent — slack MCP tools not available in this session (recurring limitation).

---

## 2026-04-18 (night) — context-sync: second pass, state confirmed stable (Cowork)

**what happened:**
- second context-sync pass of the day — no material changes since 9pm run. no git commits, no new actionable emails beyond earlier TaxDome + KiwiCo.
- sunday calendar is empty. monday: weekly site check (7am), whirlpool (9am). tuesday stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm).
- notion: only World Bank procurement alerts in last 24h — no project status changes.
- gmail: TaxDome missing docs reminder (still unactioned), KiwiCo satisfaction survey (noise), ADP quarterly statement available.
- slack DM to garrett could not be sent — slack MCP tools not available in this session (recurring limitation).
- handoff live state refreshed and confirmed accurate.

---

## 2026-04-18 (evening) — context-sync: CPA reminders escalating, KiwiCo lead, quiet weekend (Cowork)

**what happened:**
- quiet weekend day — no git commits in last 48h.
- CPA tax situation escalating: two fresh TaxDome reminders landed (missing documents for tax return + 2025 individual tax extension organiser). this is now the #1 urgent item.
- KiwiCo replied to winded.vertigo partnership outreach (apr 17) — forwarded inquiry to their international partnerships team. genuine new lead to monitor.
- ADP quarterly retirement plan statement now available online.
- Torrance Festival of Ideas: CREATIVITY & AI — whova profile validation email received (apr 17).
- PRME payment now 22 days outstanding (was 20). tue PRME hold meeting with meredith is the escalation moment.
- Amna at 10 follow-up now 23 days overdue.
- IDB Salvador now 8 days past deadline.
- monday calendar: weekly site check (7am), whirlpool (9am). tuesday stacked: strategy playdates (8am), lamis (9am), maria (10am), PRME hold (12pm), leah (3:30pm).
- slack DM to garrett could not be sent — slack MCP tools not available in this session.

---

## 2026-04-16 (evening) — context-sync: nordic meeting done, PCS gap analysis shipped, invoice processor broken (Cowork)

**what happened:**
- nordic naturals meeting with lauren bosio completed (3:15pm). PCS gap analysis finished — 4 critical gaps, 4 important gaps, 4-phase roadmap. follow-up booked **wed apr 22 3pm**. lauren sent PCS template by email. project moved from "scoping" to active delivery.
- 11 git commits: website feedback improvements (phases 1–4), playdate intake form replacing external booking, systems-thinking simulator overhaul (reactive canvas, dark theme, burnout map), security fixes (4 npm vulns), monorepo dependency alignment.
- invoice processor dispatch broken — gmail MCP stale definitions + notion invoice tracker DB not found in search. needs cowork session reload.
- garrett discussed full-stack tooling access with maria (upstash, MCP integrations, notion brief for tech stack understanding).
- michael renvillard replied to website feedback email — gracious close, offered further help.
- cash: $5,076.19 ($3,500 owner contribution offset by -$496 operating MTD).

---

## 2026-04-15 (evening) — context-sync: whirlpool pivot, nordic call tomorrow, CPA urgent (Cowork)

**what happened:**
- whirlpool session produced harbour strategy pivot: depth over breadth (pilot 2–4 games per category), play therapists as beachhead audience. writing retreat booked mon apr 21.
- lauren bosio (nordic naturals) confirmed working call for thu apr 16 at 3pm PT — first real session since SOW approval.
- CPA: 3 unread emails from straight talk CPAs — tax extension organizer reminder, missing docs request, vivek ghelani secure chat. needs immediate attention.
- CMO weekly review flagged 21-day social silence; harbour phase 1 whisper campaign behind schedule for may 1 launch.
- git: 3 commits on systems-thinking simulator (lakeshore sync, dosage sliders, stacked trade-off charts).
- stripe unrecognised device sign-in alert — needs verification.
- invoice sweep: all quiet, nothing new logged.

---

## 2026-04-15 — engagement tracking shipped + email-draft backfill (Claude Code)

**what happened:**
- **Engagement tracking deployed** (commit 2bbeddd, deployed to production apr 15):
  - Engagement profile on org pages — shows email activity (sends, opens, clicks), campaign history, and engagement score per organisation.
  - Recipient transparency — email drafts now track `sentTo` (email address) and `contactId` (when sent to a contact vs org-level email).
  - Resend webhook activity logging — incoming webhook events (delivered, opened, clicked, bounced, complained) are logged and update draft metrics in real time.
  - UTM attribution — outbound email links are tagged with utm_source/medium/campaign/content for click-through tracking.
  - Campaign recipients page — view all recipients for a campaign with per-recipient open/click stats.
- **Backfill script created** (`port/app/api/admin/backfill-email-drafts/route.ts`): one-shot GET endpoint to populate `sentTo` on existing email drafts from the first campaign (`33be4ee7-4ba4-81be-b832-d045290c5a30`). Fetches org email for each draft that has an `organizationId` but empty `sentTo`, writes it back with 350ms rate-limit delay.
- Memory: updated handoff live state, cleaned up port rename thread.

---

## 2026-04-14 (evening) — context-sync: nordic SOW approved, port rename shipped, PRME inbound (Cowork)

**what happened:**
- nordic naturals SOW approved (garrett told payton via slack DM). contract signing expected this week or next — moves from "scoping" to "closing" in pipeline.
- crm/ → port/ monorepo rename shipped (3 commits: bf7bea7 refactor rename, bd66fba vercel.json fix, 5102e9b .vercelignore fix).
- garrett rescheduled maria sync from tue to wed after 1:30pm her time.
- payton forwarded an inbound from isabel rodríguez tejedo (universidad de navarra) re: "certificate of excellence" — likely PPCS/PRME-adjacent, needs triage.
- siyavula MEL and sesame workshop threads appear dormant — removed from open threads (siyavula soft pass, sesame received pass).
- gmail: only 2 unread (payton's fwd + notion 3.4 newsletter). no urgent external replies.
- no unresolved self-DMs in slack.

---

## 2026-04-14 — port restructure shipped + follow-on tasks (Claude Code)

**what happened:**
- **Port restructure complete** (commit d0eec54, deployed to production): sidebar 12→7, dashboard with pipeline kanban, merged pages (opportunities, projects, campaigns), audience filters simplified 7→4 (fit, relationship, source, segment), derived priority system (fit × relationship matrix), skeleton fallbacks, URL-synced tabs, staggered kanban animations. All old URLs preserved via 308 redirects.
- **Follow-on tasks shipped same session:**
  - Notion schema: added native "relationship" select property to organizations database (7 stages: stranger→champion), backfill script created, mapper updated to prefer native value with derivation fallback
  - Mobile tab bar: updated 5 tabs (pipeline, contacts, log, today, work), redirect → /m/pipeline
  - Dead code cleanup: deleted status-badge.tsx, org-edit-dialog.tsx; removed PriorityBadge from priority-badge.tsx (FitBadge kept)
  - Memory: fixed crm→port references in operational.md, added project row
- **Key architecture decision:** relationship is now a first-class Notion property. On create/update, the app computes relationship from connection/outreach/friendship and writes it. On read, it prefers the native value but falls back to derivation for any un-backfilled rows.

---

## 2026-04-13 (evening) — context-sync: nordic naturals engagement surface appeared (Cowork)

**what happened:**
- sharon matheny (nordic naturals) had lauren bosio grant garrett viewer access to three smartsheet workspaces: CAIPB Database, AI Details for Qualified RMs, CAIPB Database — MASTER DATA. framed as "insights" request — scope + cadence not yet defined.
- garrett shared SQR-RCT x PCS platform credentials with sharon + gina via slack group DM (nordic naturals workspace).
- tax extension organizer reminder from straight talk CPAs landed overnight — needs completion alongside the Q1 CFO review booking.
- whirlpool "the world prowl" was play-only; no business agenda; apr 8 press play actions remain the live list for wed apr 15.
- git: only housekeeping commits on windedvertigo repo (submodule / gitignore tidy).
- tomorrow's hot window: PRME bi-weekly at 12pm PT — natural moment to raise invoice payment and meredith's comms reset note from apr 7.

---

## 2026-04-13 — context-sync: first live-state refresh (Cowork)

**what happened:**
- first context-sync run — live state block fully populated from Gmail, Slack, git, Notion, and TASKS.md
- IDB Salvador: Maria submitted documentation on apr 10 (deadline met) — receipt confirmation still needed from MINEDUCYT
- Siyavula MEL proposal received a soft pass (prefers SA-based orgs) — Garrett replied
- ancestry app: significant Claude Code build activity this week (photo gallery, GEDCOM 7.0 export, AI research assistant, DNA/ethnicity, census timeline, collaborative comments, mobile redesign, merge wizard)
- PRME survey showing 94 responses; Meredith sent comms reset note apr 7
- CPA Q1 CFO review request from Abhishek — needs booking

---

## 2026-03-29 — ops dashboard redesigned, KV + Notion wired, auto-deploy enabled (Claude Code)

**What happened:**
- **Dashboard redesign:** Complete UX overhaul — financial strip at top with hero cash number, computed runway bar, auto-derived alerts (low runway, deadline countdown, blocked projects). Two-column layout: actions + projects (left), schedule + dispatch (right). Interactive task checkboxes with localStorage persistence. Collapsible sections. Expandable project rows.
- **Cloudflare KV integration:** All 6 API routes now try KV first (`ops:finance`, `ops:projects`, etc.), fall back to static data. KV read/write utilities in `ops/lib/kv.ts`.
- **KV write endpoint:** `POST /api/kv` accepts `{ key, data }` with bearer token auth (`KV_WRITE_TOKEN`). This is how Cowork dispatch tasks push data.
- **Notion integration:** `ops/lib/notion/projects.ts` fetches projects from the shared Notion projects DB. Falls back to static data if Notion unavailable. `page.tsx` calls `fetchProjects()` server-side.
- **GitHub auto-deploy:** wv-ops Vercel project connected to `ghandoff/windedvertigo` monorepo with `rootDirectory: ops` and `sourceFilesOutsideRootDirectory: true`. Pushes to main auto-deploy.

**Env vars needed on Vercel (not yet set):**
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with KV read access
- `KV_WRITE_TOKEN` — arbitrary secret for the POST /api/kv endpoint
- `NOTION_TOKEN` — Notion integration token (same one CRM uses)

**How Cowork dispatch should push data:**
```bash
curl -X POST https://ops.windedvertigo.com/api/kv \
  -H "Authorization: Bearer $KV_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key":"ops:finance","data":[...]}'
```
Keys: `ops:finance`, `ops:projects`, `ops:team`, `ops:calendar`, `ops:tasks`, `ops:dispatch`

**What needs doing next:**
- [ ] Set env vars on Vercel (CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, KV_WRITE_TOKEN, NOTION_TOKEN)
- [ ] Build Cowork dispatch task to push dashboard snapshots to KV after weekly-cfo-review
- [ ] Resolve Notion project lead person IDs → names (owner field currently undefined for Notion-sourced projects)

---

## 2026-03-28 — ops auth fixed, hardened, design system integrated (Claude Code)

**What happened:**
- **Auth fix (critical):** Root cause — `page.tsx` was a `'use client'` static component. Next.js prerendered it at build time (`○`). On Vercel, static pages bypass middleware entirely (served from CDN). The middleware was correct but never ran. Fixed by converting to server component calling `auth()` → forces dynamic rendering (`ƒ`) → middleware now executes.
- Added sign-out button + user email display in header
- Made header date dynamic (was hardcoded "mar 28")
- Imported `@windedvertigo/tokens/index.css` — shared brand palette, semantic colors, spacing, typography, accessibility primitives
- Replaced all hardcoded hex colors with ops-specific CSS custom properties via `@theme inline`
- Removed unnecessary `'use client'` from 7 presentational components (now server components, smaller JS bundle)
- Simplified `tailwind.config.ts` — moved colors to CSS-native `@theme` block (Tailwind v4 pattern)
- Created 6 API routes: `/api/finance`, `/api/projects`, `/api/team`, `/api/calendar`, `/api/tasks`, `/api/dispatch`
- Extracted TypeScript interfaces to `lib/types.ts` (shared by components + API routes)

**What's deployed:**
- Auth-protected dashboard at ops.windedvertigo.com — redirects to /login if no session
- Google SSO with @windedvertigo.com domain restriction + ALLOWED_EMAILS allowlist
- Sign-out button + user email in header
- Dynamic date in header
- 6 API endpoints returning static data (ready for live data integration)
- Shared design tokens from `@windedvertigo/tokens`

**Middleware deprecation note:**
Next.js 16 warns `middleware.ts` is deprecated in favor of `proxy.ts`. The middleware still works for dynamic routes. CRM uses the same pattern. Not migrating yet — `proxy` convention is too new and the CRM would need to migrate simultaneously.

**Data layer architecture recommendation:**

The ops dashboard needs live data from QuickBooks, Gusto, Notion, and Google Calendar. The ops Next.js app should NOT hold OAuth tokens for these services — that's Cowork's job via MCPs.

**Recommended: Cowork dispatch → Cloudflare KV → Ops reads**

1. Cowork dispatch tasks (weekly-cfo-review, invoice-processor, etc.) already run on schedule with MCP access to QuickBooks, Gusto, Notion, GCal.
2. After each run, dispatch pushes a pre-computed "dashboard snapshot" JSON blob to Cloudflare KV (one key per data domain: `ops:finance`, `ops:projects`, `ops:team`, etc.).
3. Ops API routes read from KV at request time (sub-10ms). If KV key is empty/missing, return the static fallback from `lib/data.ts`.
4. Optional: a manual "refresh" button in the dashboard triggers an on-demand KV update via a dispatch task.

**Why this approach:**
- Cowork already has the MCPs and runs on schedule — no new auth tokens needed
- KV reads are fast and cheap — dashboard stays snappy
- Data freshness matches business cadence (daily invoices, weekly CFO review)
- Ops never needs direct access to QuickBooks/Gusto APIs
- Static fallback means the dashboard always renders even if KV is empty

**What needs doing next:**
- [x] ~~Verify OAuth flow~~ — confirmed working in incognito (2026-03-28)
- [x] ~~Set up Cloudflare KV namespace~~ — `wv-ops-data` created (id: d740788337354d738e1be321d2c4b277)
- [ ] Build Cowork dispatch task to push dashboard snapshot to KV after weekly-cfo-review
- [ ] Update API routes to read from KV with static fallback
- [ ] Connect wv-ops Vercel project to GitHub for auto-deploy on push
- [ ] **Cash position alert**: $2,072 cash with ~$4,275/mo burn. PRME invoice outstanding — revenue needs to land.

**Brand alignment (2026-03-28):**
- Login: cadet bg, champagne text, branded SSO button
- Header: shared .wv-header chrome from tokens
- Footer: shared .wv-footer chrome
- Surface colors: cadet-derived darks (not generic grays)
- Section dividers: redwood gradient accent
- Financial data: live from QuickBooks + Gusto

---

## 2026-03-28 — ops dashboard deployed (Cowork → Claude Code)

**What happened:**
- Built ops command center as new monorepo workspace (`ops/`)
- Configured Vercel project `wv-ops` with custom domain `ops.windedvertigo.com`
- Set up Auth.js v5 Google OAuth (shared with CRM)
- Cloudflare DNS CNAME added for ops subdomain
- Three deploys to fix build issues:
  1. First deploy failed: PostCSS config used Tailwind v3 syntax (`tailwindcss` as plugin)
  2. Second deploy failed: `globals.css` used `@tailwind` directives + `@apply` — Tailwind v4 needs `@import "tailwindcss"` and chokes on `@apply` with certain utility classes
  3. Third deploy succeeded after converting to plain CSS values

**What's deployed:**
- Login page with Google SSO button at ops.windedvertigo.com
- Dashboard shell with placeholder "awaiting data" cards
- Edge middleware checking session cookie for auth

**What needs doing next (Claude Code):**
- [ ] Verify Google OAuth flow works end-to-end (Garrett needs to test in browser)
- [ ] Address Next.js 16 middleware deprecation warning (`middleware.ts` → `proxy.ts`)
- [ ] Wire QuickBooks data into financial dashboard cards (API routes)
- [ ] Wire Gusto payroll data into team/payroll cards (API routes)
- [ ] Connect Vercel project to GitHub repo for auto-deploy on push
- [ ] Consider: should ops share Auth.js config with CRM via `packages/auth`?

**Key files:**
- `ops/lib/auth.ts` — Auth.js v5 config
- `ops/middleware.ts` — edge auth (deprecated convention, works for now)
- `ops/app/globals.css` — Tailwind v4 with `@import "tailwindcss"`
- `ops/postcss.config.mjs` — uses `@tailwindcss/postcss`
- `scripts/deploy-ops.sh` — Vercel deploy script

**Vercel env vars (set in dashboard, not in repo):**
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, AUTH_TRUST_HOST, AUTH_URL, ALLOWED_EMAILS

**Commits:**
- `5da6b98` — feat(ops): add ops command center as monorepo workspace
- `f4db54e` — fix(ops): use @tailwindcss/postcss for Tailwind v4
- `37d14a2` — fix(ops): use Tailwind v4 CSS import and remove @apply directives
