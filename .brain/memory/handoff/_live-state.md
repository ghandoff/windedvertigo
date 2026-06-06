# live state

> single-writer file. owned by the `context-sync` scheduled task (daily 9pm pt).
> manual edits should only happen when explicitly taking the snapshot; otherwise let the schedule rewrite it.
>
> history and per-session notes live in sibling files in this directory. the archive of everything pre-split is `_archive-pre-split-2026-05-19.md`.

**last synced:** 2026-06-05 21:08 pt (context-sync autonomous run)

**where we are right now:** day 8 post-launch, and today was a heavy engineering day that closed a major build — the agent trio is now complete. claude code shipped pam + cARL (#188), editable pam tiles plus cARL's research engine — curriculum, study cron, and an annotated bibliography migrated notion → supabase (#190, #191) — then layered on cARL's bibliography tooling: a /bibliography page (#193), citation import (#194), doi auto-fill with crossref discovery (#195), and phase a of a federated multi-database scholarly search (#196); agent plugins are now installable from a clone too (#189). pam is in its trial fortnight (4–17 jun) on supabase. the one genuinely time-sensitive item is now right on top of us: the gusto july-1 health-benefits decision is due tomorrow, sat 6 jun. still open and unconfirmed are the dw akademie decision email (2 jun) and the prme records check (4 jun), with amna's revised scope + budget (2 jun) still awaiting their reply. on the personal ledger the chase [home] card payment cleared (scheduled $3,000, 5 jun). cash remains stale — last hard number $34k (apr 20), less the $7,385.63 may payroll that debited 2 jun — refresh at this week's meetings.

### open threads

| project | last action | next action | link |
|---|---|---|---|
| gusto — health benefits | reminder 2 jun: deadline to confirm july-1 coverage is sat 6 jun (now tomorrow) | decide + apply or decline before end of 6 jun | [gmail thread 19e8976f61815598](https://mail.google.com/mail/u/0/#inbox/19e8976f61815598) |
| amna at 10 | garrett replied 2 jun with revised scope + updated budget; hejer confirmed full scope stands + thanked us for budget openness | await amna's reply, then tee up next-step scheduling (garrett + team) | [gmail thread 19e4c116d65e43a2](https://mail.google.com/mail/u/0/#inbox/19e4c116d65e43a2) |
| august kinloch — technical audit | kickoff held 3 jun; august active in dm discussing stakeholder/network-mapping tooling (kumu, clickup) | confirm audit scope + go/no-go outcome, write the overdue `2026-05-22-cowork-kinloch-kickoff.md` | _slack dm D08MEKEDA9Y · [meet](https://meet.google.com/kyn-ensy-vzh)_ |
| dw akademie — ims evaluation | decision email arrived 2 jun 09:47, still unconfirmed; no new mail in 24h | read the dw decision + respond accordingly | [gmail thread 19e74f1a18f8a224](https://mail.google.com/mail/u/0/#inbox/19e74f1a18f8a224) |
| prme / ungc — certification | pedagogy team nudge 4 jun: check our records on a 2025 certification-series participant's async completion (to garrett + maria) | check records + reply to unprme pedagogy | [gmail thread 19e9436c2c6e24ad](https://mail.google.com/mail/u/0/#inbox/19e9436c2c6e24ad) |
| agent trio — pam + cARL | shipped today (#188–196): pam tiles, cARL research engine, bibliography notion → supabase, plugins installable | validate pam's supabase trial + cARL's bibliography / study-cron against real use over the 4–17 jun window | [port/strategy](https://port.windedvertigo.com/strategy) |
| harbour / prime+ — analytics | #181–183 (l2 metrics, observatory, access-code analytics) shipped 30 may, still unvalidated | validate dashboards against real launch-week traffic; confirm access-code numbers before reporting | [whirlpool hub](https://www.notion.so/whirlpool-hub-33ae4ee74ba481b1a391fed914baa05b) |
| nordic naturals — contract + platform | sow v3 in legal; magic-link-default login shipped 2 jun (`b9b1f2a`), gina jaeger onboarded to nordic | chase nordic legal on v3; confirm august's named-backup access lines up with data-security t&c | [nordic scope reconciliation v3](https://docs.google.com/document/d/1zvl0VrekxsmB9YqHDtjdhz1pjiSNFC0FIQU3Yq2lfyE) |

### waiting on external

- **amna (gabriella, hejer, walaa)** — garrett's revised scope + budget sent 2 jun; awaiting their next reply.
- **nordic legal team** — sow v3 in review; signature + first invoice gated on it.
- **concern (amy dignam)** — icsp gce proposal submitted 25 may; review window open.
- **idb salvador / nadia nochez** — 40+ days silence since 24 apr; spanish follow-up draft (maria's voice) still unsent in gmail.
- **sesame workshop close-out** — pass received 31 mar; graceful reply still undrafted.
- **attio crm trial** — 60-day inactivity / workspace-deletion window ticking; keep-or-cancel decision pending.
- **straight talk cpas / aakib qureshi** — taxdome chat unread; second automated reminder.

### environment handoffs

**cowork → claude code (engineering queued up):**

- branch cleanup sweep — the local branch list has grown well past claude.md's 3-day rule; audit against main, delete merged ones, get unfinished work shippable then merge.
- triage the supabase security-vulnerabilities email (2 jun) — 9 high vulns on nordic-sqr-rct (`next@16.2.6` + `workflow@4.2.5`) plus the `@anthropic-ai/sdk` moderate vuln across repos (bump to `^0.100.1`); the new `wv-ppcs` supabase project (4 jun) is folded into this item.
- commit-or-ignore the untracked sprawl: `site/.env`, `port/.env.local.bak.20260527T055218`, several `docs/prompts/*.md`, and two new tool dirs (`site/public/tools/upaya/`, `site/public/tools/whirlpool-2026-06-01/`).
- validate the new pam supabase trial + cARL bibliography / study-cron against real use before the 4–17 jun window closes.
- validate harbour analytics dashboards (#181–183) against real launch-week traffic before the numbers are used in reporting.
- nordic prod-smoke still open — roles, pcs labels/comments, applicability, metrics/revisions, canonical-claim matcher.
- retire (or formally orphan) the notion → `nordic.windedvertigo.com/api/webhooks/notion/page-updated` webhook now that nordic is fully postgres.

**claude code → cowork (ops queued up):**

- **confirm gusto july-1 health benefits — deadline is tomorrow, sat 6 jun.**
- read the dw akademie decision (2 jun) + respond accordingly.
- close out the august kinloch audit — confirm scope + go/no-go, then write the overdue `2026-05-22-cowork-kinloch-kickoff.md`.
- check our records on the prme 2025 certification-series participant + reply to unprme pedagogy (garrett + maria).
- chase nordic legal on sow v3 review.
- respond to taxdome unread chat (aakib qureshi / cpa).
- refresh cash position (payroll $7,385.63 debited 2 jun; last hard number $34k as of apr 20).
- idb salvador spanish follow-up — forward the gmail draft to maria or send directly.
- attio trial keep-or-cancel decision; export contacts first if cancelling.

### mobile bookmarks

- _none new in the last 24h._ (the self-channel surfaced only a social group dm with payton + fruit about amelia's showjumping win, not a true self-bookmark.)
