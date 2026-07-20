# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-07-19 21:10 pt (context-sync autonomous run)

**where we are right now:** the holiday weekend closes with a **fifth consecutive zero-sent-mail day** — the entire chase list rolls into monday intact. the **gusto sept-1 health-benefits first carrier window closed today (sunday 19 jul)** with no visible decision in sent mail — confirm whether it was made in-app, and the **adp form 5500 is now 5 days overdue**. monday is the pressure-release valve: nordic's **$50k (invoice #31) is expected to land** (ramp confirmation 17 jul), making it the cash-position refresh point (stale at $34,026 since 20 apr), and the calendar stacks ops stewardship 07:00, whirlpool 09:00, payton 11:00, mo 13:00. one small resolution: **canva pro renewed today** (invoice 13:58 pt) — the keep-or-cancel question answered itself by charging; cancel-and-refund is the remaining lever if unwanted. winchester proofs are due **wednesday 22 jul (3 days)**. repo unchanged: origin/main at 15 jul (#388–#392), desktop checkout still **41 commits behind** with the stale 11-jul `.git/index.lock` and uncommitted port/site changes. notion projects db: no status changes in the last 24h.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| adp 401k — plan #156733, form 5500 | was due 14 jul — **now 5 days overdue**; no 5500 activity in sent mail | complete the verification — top of monday's list | _adp / american century_ |
| gusto — health insurance window | first carrier window **closed today (sun 19 jul)**; no decision visible in sent mail | confirm whether the sept-1 decision was made in-app; if missed, ask gusto about the next window | [gusto email](https://mail.google.com/mail/u/0/#inbox/19f64f67df2826b5) |
| nordic naturals — invoices 31–34 | **#31 paid — $50k expected monday** (ramp, 17 jul) | confirm the deposit landed; refresh cash position; chase sharon/finance on 32–34 (3×$10k) | [ramp confirmation](https://mail.google.com/mail/u/0/#inbox/19f704f95b0c4267) |
| winchester — handbook of creativity chapter | ellen's publisher queries open; hard deadline **22 jul (3 days)** | review the proof + resolve queries | [proofs thread](https://mail.google.com/mail/u/0/#inbox/19f419722f355864) |
| sarah (lightbulb) — condolences | still unsent (no sent mail since lisa's 14 jul email) | send the condolence note; keep lightbulb on compassionate pause | [lisa's email](https://mail.google.com/mail/u/0/#inbox/19f60fede45fc77b) |
| LTP consortium — reconvening | 3 of 6 orgs replied + 3 poll responses (14 jul); no replies sent yet | reply warmly to michael, jan, kristin; schedule once quorum | [thread](https://mail.google.com/mail/u/0/#inbox/19f55668da591ab0) |
| amna — post-kickoff | invite for **thu 23 jul 07:00 pt**; rsvp still needsAction (all w.v attendees) | rsvp yes; confirm the £6k wire cleared before the call | [invite email](https://mail.google.com/mail/u/0/#inbox/19f65e3523b323ab) |
| 2025 tax return + q2 cfo review | taxdome still expired; 2 more self-dm nudges today (08:09 + 17:11 pt) | re-auth at straighttalkcpas.taxdome.com, sign, book q2 review | _taxdome_ |

### waiting on external

- **sharon / nordic finance** — #31 payment in flight (expected monday); still awaiting confirmation that invoices 32–34 were received/sent.
- **amna (hejer)** — £6k wire confirmation outstanding since the 2 jul swift/bic fix; meeting thu 23 jul.
- **LTP network** — 3 of 6 orgs in (careforED, press play, kristin); awaiting E4S + history colab; lightbulb on compassionate pause (sarah's bereavement).
- **straight talk cpas (sabir, aakib, abhishek)** — secure messages unread behind the expired taxdome session; abhi waiting on garrett to book the q2 cfo review.
- **ellen spencer (winchester)** — publisher queries open; hard deadline 22 jul, her availability very limited.
- lower-priority carry-forwards: adidas foundation proposal review (drive, since 12 jul), PRME PO2069 contractor invoice (finn), ppcs impact report final pass, attio keep-or-cancel (dylan followed up 17 jul), bankvod e-signature legitimacy check, notion "new device" login notice (likely the mcp connector), gusto 16 jul CA retirement mandate email (likely noise given the adp 401k — verify once), chase ink cc payment due 23 jul (calendar). ~~canva pro keep-or-cancel~~ — renewed 19 jul; cancel-and-refund if unwanted.

### environment handoffs

**Cowork → Claude Code:**

- **`git pull` the desktop checkout — still 41 commits behind origin/main** (remote head 15 jul: #388–#392). clear the stale 11-jul `.git/index.lock` first, then commit staged handoff files (`_live-state.md` + session files from 08, 11, and 16–19 jul — `git add -f` the new ones). (sandbox git fetch fails on host-key auth, so remote state is as of the last successful fetch — _partial source_.)
- **investigate the search console noindex warning (18 jul)** — "pages in a sitemap excluded by 'noindex'" on windedvertigo.com. likely a wv-site metadata regression; check which pages + whether intentional.
- **verify wv-site deployed** — coact ground truth 2026 (#353–#355) merged 10–11 jul; deploy still unconfirmed. `cd site && npm run deploy:cf` (don't skip the headers step) if it isn't live.
- **weekly dependency review follow-up (13 jul)** — CRITICAL: `@xhmikosr/decompress` path traversal in nordic-sqr-rct; 14 HIGH in nordic; anthropic sdk drift; ai sdk 6→7 in port; stripe 5 majors behind. nordic lockfile needs an `npm install` commit (ci failing). full report in the 13 jul 06:22 self-dm.
- **review the uncommitted working-tree changes** — `port/app/api/cron/sync-rfp-pilot/route.ts`, `port/lib/ai/rfp-ingest.ts`, `site/app/book/poll/[slug]/*`. the poll page is live-load-bearing (LTP poll at /book/poll/chmankyh) — review, commit, or discard with care.
- **surface `feat/caipb-audit-fixes` for review** — 38/38 green, untouched since 15 jun; **do not merge straight to main** (auto-deploys nordic).
- **branch cleanup sweep** — still well past claude.md's 3-day rule.

**Claude Code → Cowork:**

- **adp form 5500 — 5 days overdue**; complete the verification first thing monday.
- **confirm the gusto sept-1 decision** — window closed sunday; check in-app, ask about the next window if missed.
- **confirm the nordic $50k deposit + refresh cash position** — stale at $34,026 since 20 apr.
- **confirm nordic invoices 32–34 were sent** — chase the remaining $30k.
- **send condolences to sarah** (via lisa's thread) before any lightbulb/consortium follow-up.
- **rsvp to the amna 23 jul invite** + confirm the wire cleared.
- **reply to LTP responders + monitor the poll** (windedvertigo.com/book/poll/chmankyh).
- **re-auth taxdome**, clear secure messages, book the q2 cfo review.
- **review winchester proofs** before 22 jul; **review the adidas foundation drafts**.

### mobile bookmarks

- **taxdome re-auth nudge** — sent to self-dm twice again today (08:09 + 17:11 pt); underlying task still open. no other self-dms in the last 24h.
- **weekly dependency review (13 jul 06:22)** — carried forward; queued in cowork → claude code above.
