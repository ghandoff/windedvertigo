# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-07-20 21:15 pt (context-sync autonomous run)

**where we are right now:** the nordic payment for invoice #31 is in flight — ramp confirms nordic naturals sent it 17 jul with estimated arrival **tomorrow, tue 21 jul** (yesterday's "expected monday" was the send-side view; ramp's own estimate is the 21st). today was a four-meeting day (ops stewardship, whirlpool, payton, mo) and produced real forward motion: the whirlpool sharpened the conference-experience angle ("we help conferences create movements and connections that last beyond a single day"), edgardo (education for sharing) replied enthusiastically to the LTP consortium reconvening and the availability poll hit 4 responses, and an intro sync with august kinloch landed for fri 24 jul. engineering shipped the ambient-agent spine phase 1 (#393) plus a slack bot-token fix (#394), conference-demo mobile polish (#395), and booking poll form updates — and the macbook → mac mini machine handoff completed (windedvertigo checkout now clean and even with origin, no index.lock). the drag: **sixth consecutive zero-sent-mail day**, form 5500 is now 6 days overdue, taxdome is still locked out (2 nudges today), and the gusto sept-1 carrier window closed sunday with no visible decision. cash figure still stale at $34,026 (20 apr) — refresh queued for when the nordic deposit lands.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| nordic naturals — invoice #31 | ramp: payment sent 17 jul, est arrival **21 jul** | confirm the deposit lands tomorrow; refresh cash position; then send invoices 32–34 | [ramp email](https://mail.google.com/mail/u/0/#inbox/19f704f95b0c4267) |
| LTP consortium / idb el salvador | edgardo (education for sharing) replied enthusiastic 20 jul; poll at 4 responses; MINEDUCYT technical proposal v8 in drive | follow up with edgardo; reach out to dina re US charity status (william t. grant foundation); convert poll into a consortium call | [edgardo reply](https://mail.google.com/mail/u/0/#inbox/19f8073b150b7b37) |
| adp 401k — form 5500 | verification was due **14 jul**; now 6 days overdue | complete the 5500 verification first thing | _adp / american century_ |
| gusto — sept-1 401k carrier window | window closed sun 19 jul with no decision visible in sent mail or inbox | check in-app whether the decision was made; if missed, ask gusto about the next window | _gusto app_ |
| straight talk cpas — taxdome + q2 cfo review | session expired again (self-dm nudges 08:03 + 17:09); q2 review still unbooked | re-auth via chrome at straighttalkcpas.taxdome.com, sign 2025 return forms, clear secure messages, book q2 review | [taxdome](https://straighttalkcpas.taxdome.com) |
| winchester — book chapter proofs | hard deadline **22 jul (2 days)**; no reply visible in sent mail, so presumed still open (_partial source_) | resolve ellen spencer's outstanding publisher queries before the 22nd | see 07-08 note |
| august kinloch intro | intro sync scheduled + accepted — fri 24 jul, 11:00–11:30 pt | prep context before friday | [cal.com email](https://mail.google.com/mail/u/0/#inbox/19f814d62bc1162c) |
| engineering — ambient-agent spine | phase 1 merged (#393) with mo/pam pilots; resume note + 2 open bugs in `docs/prompts/cowork-handoff-2026-07-20.md`; #394/#395 + booking poll also merged | resume from the handoff note; verify port deploy (merged ≠ live) | main @ `2e3b5957` |

### waiting on external

- **nordic naturals** — invoice #31 payment in transit via ramp since 17 jul; est arrival 21 jul.
- **adp / american century — 401k plan #156733** — form 5500 verification overdue since 14 jul; 30 jun indirect-compensation notice still unread.
- **straight talk cpas (sabir, aakib, abhishek)** — secure messages unread behind the taxdome lockout; abhi still waiting on the q2 cfo review booking.
- **amna (hejer)** — £6k wire was still unconfirmed at the 08 jul snapshot; no fresh signal since (_partial source this run_).
- **edgardo (education for sharing)** — replied 20 jul; ball is now with garrett to follow up.

### environment handoffs

**cowork → claude code (engineering queued up):**

- **resume ambient-spine phase 1** — resume point + 2 open bugs documented in `docs/prompts/cowork-handoff-2026-07-20.md` (untracked — commit it).
- **weekly dependency review (self-dm 06:27)** — nordic-sqr-rct: 1 critical + 14 high (bump workflow → 4.6.0, next → 16.2.10); windedvertigo: `npm update hono` (14 CVEs incl. CORS credentials leak). safe-tier bumps ready to apply.
- **commit the 5 untracked agent docs** — `docs/pam/handoff-2026-07-20.md`, `docs/prompts/cowork-handoff-2026-07-20.md`, plus older carl/cmo/opsy handoffs sitting untracked.
- **mac mini first sit-down** — run the push-first-then-pull ritual from the 00:47 self-dm; verify wv-brain `82bd6b7` got pushed (windedvertigo side is confirmed synced).

**claude code → cowork (ops queued up):**

- **confirm the nordic deposit lands 21 jul** + refresh the cash position (stale since 20 apr); then invoices 32–34.
- **form 5500** — 6 days overdue, do first.
- **taxdome re-auth + book the q2 cfo review** with abhi.
- **gusto carrier-window check** — confirm whether the sept-1 decision was made before sunday's cutoff.
- **follow up edgardo + reach out to dina** (US charity status for the william t. grant foundation angle).
- **winchester proofs** — 22 jul hard deadline.
- **synthesize today's meeting notes into TASKS.md** — gemini notes landed for both the whirlpool and the payton weekly (conference-experience angle, edgardo/dina follow-ups).

### mobile bookmarks

- **00:47 — macbook → mac mini finish-up instructions** — windedvertigo push confirmed done (checkout even with origin); wv-brain push + mini ritual still to verify.
- **06:27 — weekly dependency review** — safe-tier bumps pending (see engineering queue).
- **08:03 + 17:09 — taxdome session-expired nudges** — standing re-auth ask, see open threads.
