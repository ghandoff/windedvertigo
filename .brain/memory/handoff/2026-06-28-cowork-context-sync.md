# context-sync — 2026-06-28 21:10 pt

autonomous run of the `context-sync` scheduled task. refreshed `_live-state.md`.

## notable this run

- **creaseworks camp is the new #2 thread.** maria sent a full week plan to garrett's dm (28 jun 13:00): "one game, upgrade only", the whole week running inside garrett's audit tool (three streams + coherence dashboard as the diverge-and-converge engine), with a minute-by-minute 90-min monday. she wants it locked tonight / first thing tomorrow and has 5 questions for garrett (does the tool save + can everyone log in, what the heatmap is scored on, build-load protection, roles, later-list). added as an open thread + ops handoff.
- **nordic still not signed.** sharon matheny dm'd today: finance meeting tuesday 30 jun, money "hopefully released at that point". flipped the nordic line from "signing this week" (15/18 jun) to "gated on tuesday's finance meeting". still the biggest near-term cash event.
- **amna moved from signed → build.** evidence-map visualisations shipped (#310/#311, 26 jun); finn flagged `WV-AMNA-001` for signature (27 jun); cARL amna reading sprint underway (untracked `docs/carl/amna/`).
- **big engineering week, all merged to main, deploy unverified.** pam dashboard redesign + timeline (#305–#309, 25 jun), amna evidence map (#310–#311, 26 jun), and the human + agent /brain knowledge graph + literature layer + fuzzy reconciliation (#312–#316, 27–28 jun). port deploy state not checked this run — owed a `npm run deploy:cf` + `/api/version` compare.
- **caipb audit-fixes still unpushed** — confirmed not on origin 13 days after the 15 jun commit (38/38 tests green). carried forward, now flagged as aging.
- **uncommitted security migration** — `supabase/migrations/0003_enable_rls_lockdown.sql` is untracked in the working tree, alongside the whirlpool-icebreaker tool, cARL amna docs, and a pam-amna prompt. commit-or-ignore.
- cash still stale at $34k (20 apr); no fresh figure (_source unavailable_). june payroll due ~1 jul via gusto (1 item needs review); adp invoice 27 jun; two finn contractor invoices (`PRME PO2069`, `WV-AMNA-001`).
- calendar monday 29 jun is full: ops stewardship 7am, whirlpool 9–10:30, payton 11am, mo 1pm pt.

## sources

- slack self-dm (D06QGJ34H53) + cross-person dms (sharon, maria), git log + working-tree status, gmail (unread newer_than:2d), gcal (29 jun), notion search, `.brain/TASKS.md` (note: TASKS.md is stale at the caipb era, 13–15 jun).
