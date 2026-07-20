# 2026-07-11 — cowork — context-sync

**session id:** scheduled context-sync (autonomous, ~21:09 pt)
**handed off from:** 2026-07-08-cowork-context-sync.md (3-day gap — no sync landed 9 or 10 jul)

## what changed since 8 jul

- **commit-hygiene blocker — root cause identified, still blocking.** Confirmed directly this run: it's not a stale git lock. `git add -f` works fine (staging succeeds), but any unlink inside `~/Projects/windedvertigo` fails with "Operation not permitted" — reproduced on a plain throwaway file at the repo root, not just `.git/index.lock`. This is the cowork sandbox's mount of the connected folder blocking unlink entirely. Tried the obvious workaround (clone to `/tmp`, which does allow unlink, then push from there) — also blocked, because this sandbox has no network route to github.com (`ssh -T git@github.com` fails DNS resolution outright). Conclusion: this cannot be fixed from any cowork sandbox session, full stop — needs a real desktop/Claude Code terminal. `_live-state.md` and this file are staged locally but not committed or pushed.
- **notion back online** — first clean notion read in three syncs (was unavailable 7 jul and 8 jul). No major project-status flips surfaced beyond what's already tracked in open threads, but it's no longer a blind spot.
- **nordic invoice — possible status change, unconfirmed** — invoice 31 ($50k phase 1) and addendum a milestone invoices 32/33/34 ($10k each) now exist as drafted docs in drive, dated issued 6 jul, due 17 jul. Every prior sync (through 8 jul) had this thread as "no invoice sent." Could not confirm from this session whether these were actually transmitted to sharon/finance — flagged as the next action.
- **amna — kickoff happened, wire still open** — the 9 jul 7:30am pt "amna at 10" kick-off meeting (lamis, jamie, hejer) took place per the gemini notes. The £6k wire confirmation from the 2 jul swift/bic fix is still unconfirmed.
- **idb el salvador — no new movement surfaced this run** beyond what 8 jul's whirlpool notes already captured (consortium poll + timezone fix sent). enmienda no.1 + aclaración no.2 still not folded into bid prep.
- **site engineering — coact ground truth 2026** — four commits in the last 24h: conference-experience redesign as an immersive demo (#353), an audit-fixes pass (#354), a public-path copy fix, and round-2 desktop/iOS bug fixes (#355). All merged to main. Deploy status to wv-site not verified this run.
- **new — uncommitted engineering work found in the working tree**, unrelated to this sync: `port/app/api/cron/sync-rfp-pilot/route.ts`, `port/lib/ai/rfp-ingest.ts`, `site/app/book/poll/[slug]/page.tsx`, `site/app/book/poll/[slug]/poll-respond-form.tsx` — all modified, none committed. Left untouched (out of scope for this sync) but flagged for review.
- **new — bankvod authorization request** (7 jul, unread) — asking for an e-signature to release account/financial info to a partner. Not actioned; flagged for garrett to verify legitimacy before signing.
- **garrett is OOO tomorrow** — a "graeagle holiday" block is on the calendar for 12 jul.
- **adp 401k form 5500** — due 14 jul, now **3 days out** (was 6 days out at last sync).
- **cash position** — still $34,026 (20 apr); no fresher figure surfaced this run either.

## sources

git log (windedvertigo repo, `--since='24 hours ago'`), `.brain/TASKS.md`, `.brain/memory/context/company.md`, `.brain/memory/projects/nordic-naturals.md`, `.brain/memory/projects/crm-roadmap.md`, `.brain/memory/handoff/_live-state.md` + sibling session files, notion search (ai_search mode), gmail (`is:unread newer_than:1d`), slack self-dm search (`in:@U06Q4UN4PKR after:2026-07-10`), gcal (12 jul — graeagle holiday, OOO).

## sources unavailable this run

- fresh cash figure — still $34,026 from 20 apr; no fresher number surfaced in gmail/slack.
- confirmation that nordic invoices 31–34 were actually sent (vs. just drafted) — could not verify send status from drive metadata alone.
