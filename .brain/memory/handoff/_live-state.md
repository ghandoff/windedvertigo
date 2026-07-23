# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-07-22 21:10 pt (context-sync autonomous run)

**where we are right now:** nordic's payment for invoice #31 landed monday and the project is expected to launch next week — cash refresh and invoices 32–34 are the unblocked follow-ons (the cash figure is still stale at $34,026 from 20 apr). engineering closed out the ambient-agent spine today: all six agents now have live behaviours (biz estimated-value proposer #418, cARL citation gate #419), and the reactive @-mention 401 was root-caused to a stale ANTHROPIC_BASE_URL and fixed (#415–#417). two external knocks arrived today: meredith (prme) confirmed **no additional 2026 spend** beyond what's budgeted, and the adidas foundation sent an application outcome (unread, likely a decline given "overwhelming number of applications"). the drags: form 5500 now **8 days overdue**, taxdome still locked out (2 nudges today), the winchester proofs deadline was **today** with no submission confirmation visible, and tomorrow is a three-commitment morning — amna call 7am, maria weekly 9am, chase ink payment due.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| nordic naturals — post-payment | payment received 21 jul; maria weekly notes "launching likely next week" | refresh cash position, send invoices 32–34, prep launch | [weekly notes](https://app.notion.com/p/3a4e4ee74ba481749996fa5c687424ab) |
| amna | meeting tomorrow **wed 23 jul, 07:00–08:00 pt** (hejer + cristal, fatima, gabriella) | prep before the call; confirm the £6k wire status in it | [meet](https://meet.google.com/gzi-qgzz-qjk) |
| winchester — book chapter proofs | hard deadline was **today (22 jul)**; ellen's 08 jul follow-up still unread; no submission visible (_partial source_) | confirm whether proofs went in; reply to ellen/marnie either way | [ellen's email](https://mail.google.com/mail/u/0/#inbox/19f419722f355864) |
| ppcs / prme — 2026 upsell | meredith replied 22 jul: no unbudgeted 2026 spend; appreciated the pricing | log the outcome in biz memory; keep warm for 2027 budgeting | [reply](https://mail.google.com/mail/u/0/#inbox/19f8b18fd5c75311) |
| adp 401k — form 5500 | verification was due 14 jul; now **8 days overdue** | complete the 5500 verification first thing | _adp / american century_ |
| straight talk cpas — taxdome + q2 review | session expired again (self-dm nudges 08:06 + 17:09) | re-auth via chrome, sign 2025 return forms, clear secure messages, book q2 review with abhi | [taxdome](https://straighttalkcpas.taxdome.com) |
| LTP consortium / idb el salvador | edgardo enthusiastic 20 jul; ball with garrett | follow up edgardo; reach out to dina re US charity status | [edgardo reply](https://mail.google.com/mail/u/0/#inbox/19f8073b150b7b37) |
| engineering — ambient-agent spine | all six agent behaviours shipped (#413–#419); studio-comms promotion verified live | verify port deploy state (merged ≠ live); reconnect agents connector if MCP tools changed | main @ `aa4554ff` |

### waiting on external

- **adp / american century — 401k plan #156733** — form 5500 verification overdue since 14 jul.
- **straight talk cpas (sabir, aakib, abhishek)** — secure messages unread behind the taxdome lockout; abhi still waiting on the q2 cfo review booking.
- **amna (hejer)** — £6k wire still unconfirmed since the 08 jul snapshot; meeting tomorrow is the natural place to close it.
- **gusto — sept-1 401k carrier window** — closed sun 19 jul with no visible decision; still unconfirmed either way.
- **unicef innocenti LTA** — submission was due 21–22 jul; no confirmation visible in this run's sources (_partial source_).

### environment handoffs

**cowork → claude code:**

- **weekly dependency review (self-dm 20 jul)** — nordic-sqr-rct: 1 critical + 14 high (bump workflow → 4.6.0, next → 16.2.10); windedvertigo: `npm update hono` (14 CVEs incl. CORS credentials leak). safe-tier bumps still pending.
- **commit the 6 untracked docs** — `docs/pam/handoff-2026-07-20.md`, `docs/prompts/cowork-handoff-2026-07-20.md`, plus older carl/cmo/opsy handoffs + `docs/cmo/friday-scorecard.md` sitting untracked on main.
- **ambient spine — next phase** — behaviours complete across all six agents; candidate next steps are deploy verification, agent-connector reconnect, and whatever the spine roadmap queues after the behaviour layer.

**claude code → cowork:**

- **refresh the cash position** (stale since 20 apr) now the nordic deposit is in; then send invoices 32–34.
- **form 5500** — 8 days overdue, do first.
- **taxdome re-auth + book the q2 cfo review** with abhi.
- **read + log the adidas foundation outcome email**, and log the prme no-additional-spend decision in biz memory.
- **confirm the unicef LTA submission** actually went out before the deadline.
- **gusto carrier-window check** — confirm whether the sept-1 decision was made before the cutoff.
- **follow up edgardo + reach out to dina** (US charity status for the william t. grant foundation angle).

### mobile bookmarks

- **08:06 + 17:09 — taxdome session-expired nudges** — standing re-auth ask; the only self-dm traffic in the last 24h.
