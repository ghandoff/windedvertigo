# context-sync — 2026-06-30 21:08 pt

autonomous run of the `context-sync` scheduled task. refreshed `_live-state.md`.

## notable this run

- **pivot day, not just a status day.** the strategy playdate (garrett × lamis) + garrett × maria part i reframed w.v around a **"studio of studios"** operating model: a yes/no TToC prioritisation rubric, a RACI / shepherd-per-project ownership model, and a relaunched **lean PaM** (async between whirlpools). survival-vs-mission filter to be encoded in the TToC, with nordic as the canonical keep-the-lights-on exception. full visual log in cowork "strategy-log-2026-06-30"; source: `docs/cmo/decisions-log.md` (updated today).
- **LTP consortium is the new keystone.** reignite + lead a coalition of siblings (care for education, education for sharing, history co-lab, press play, lightbulb, sarah wolman). trigger = the **idb** proposal (1 of 7 invited, credentials gap → bid as a consortium; maria owns credential strategy, prep for the 9th, physical FedEx submission). **nonprofit question resolved:** no own 501c3 — lean on a partner's US nonprofit as the qualifying entity.
- **amna signed $25k + kick-off scheduling.** hejer sent the microsoft-teams **kick-off meeting invite** this morning (30 jun 08:24). contract is signed/won at $25k; `WV-AMNA-001` still awaits garrett's signature. amna is the one hard deadline: **30 sep**. next ~3 weeks = creaseworks + mini-creaseworks + amna; conference deep-work pushed to last week of july.
- **nordic finance meeting was today (30 jun).** money "hopefully released" — but no signature or release signal in slack/gmail as of this sync. still gated; watch for it.
- **wrangler cve bump done; vitest cve still open.** wrangler → 4.105.0 merged today (commit `e0e28b9d`). the CRITICAL vitest cve is unchanged — harbour-apps launch-smoke/security/values-auction still on 2.1.x. a fresh supabase "security vulnerabilities detected" email landed 30 jun; ties to the still-uncommitted rls-lockdown migration.
- **engineering shipped to main today:** /brain attribution adjudicator tab + phase-4 agent co-production tracking, the doodle-style group-availability booking poll (#318), next@16.2.9 + aws-sdk v3.1037 S3Client fix, and the creaseworks why-cards infographic. all merged; **port deploy unverified** (`/api/version` not reachable from the sandbox — bot WAF likely).
- **untracked sprawl has grown** — now also `docs/opsy/dependency-majors-and-credentials.md`, `docs/opsy/meeting-notes-pipe-spec.md`, `docs/prompts/strategy-brief-tab-port-build.md`, and `site/public/tools/whirlpool-icebreaker/`, on top of the rls migration + carl/amna docs.
- **mo→pam role correction:** holiday/time-off collection + slack outreach + shared-calendar visibility is PaM's, not mo's; mo keeps only the oct-2027 strategy draft. partly addresses garrett's earlier "mo more strategic, less sycophantic" note.
- carry-forwards unchanged: caipb audit-fixes unpushed ~15 days, cash stale at $34k (20 apr, _source unavailable_), june payroll due (gusto), open invoices (WV-AMNA-001, finn PRME PO2069, adp), taxdome re-auth, adp form 5500 due 14 jul, ppcs report finalisation. dw akademie now confirmed *not* awarded (removed from pipeline).

## sources

- slack self-dm (D06QGJ34H53; 8 messages last 24h — a 30 jun morning strategy cluster + the standing taxdome nudge), slack search for nordic/sharon/creaseworks (no results in-window), gmail (`is:unread newer_than:1d` — amna kick-off, taxdome, supabase security, miro creaseworks board, adp notice, john balash, gemini meeting notes), gcal (1 jul — whirlpool, fruitstand, garrett↔john), notion search, `docs/cmo/decisions-log.md` (updated today), git log + working-tree status, `.brain/TASKS.md`. cash figure + port `/api/version` unavailable this run.
