# context-sync — 2026-06-29 21:08 pt

autonomous run of the `context-sync` scheduled task. refreshed `_live-state.md`.

## notable this run

- **creaseworks camp slipped to overdue.** maria's "one game, upgrade only" week plan (sent 28 jun 13:00) wanted garrett's sign-off + answers to her 5 questions "tonight / first thing tomorrow" — no reply from garrett is visible in slack as of tonight, so the line moved from "wanted by this morning" to overdue / most time-sensitive ops item.
- **new CRITICAL vitest CVE.** the 29 jun weekly dependency review (self-dm 06:16) flagged a CRITICAL vitest cve in harbour-apps (launch-smoke, security, values-auction still on vitest 2.1.x), plus stale lock files breaking `npm ci` in all three repos, a safe wrangler bump (→ 4.105.0), and majors to review (ai-sdk, stripe, anthropic-sdk). added as its own open thread + the top cowork→claude-code handoff.
- **two new taxdome messages, still unreadable.** sabir ghoghari (straight talk cpas) sent secure messages at 14:44 and 18:44 today; the agent keeps hitting "taxdome session expired". elevated from a standing nudge to "two unread cpa messages waiting on re-auth".
- **/brain graph another polish pass.** #317 + four commits (semantic zoom labels, label collision avoidance, halved node radii, hover tooltip, auto-fit on mount), all 29 jun, on top of #312–#316. still merged-not-deployed — port deploy still owed a `npm run deploy:cf` + `/api/version` check.
- **amna desk-review materials now in hand.** hejer + jonelle shared all three folders via keeper / intergence (microsoft drive); garrett confirmed receipt 24 jun. the cARL amna reading sprint now has its source data.
- **monday whirlpool ran** (9–10:30; gemini auto-notes 12:07 pt). tuesday 30 jun is fully internal (strategy playdates 8am, lamis 1:1 9am, maria part i 11am pt) — nordic's finance meeting is nordic-internal, not on garrett's calendar.
- **garrett self-note:** "mo needs to be more strategic and far less sychophantic" (13:02) — captured as a mobile bookmark + a cmo-agent posture-tuning ops item.
- carry-forwards unchanged: nordic unsigned (gated on tue finance meeting), caipb audit-fixes unpushed 14 days, uncommitted rls migration + untracked sprawl confirmed in tree, cash stale at $34k (20 apr, _source unavailable_), june payroll due ~1 jul, open invoices (WV-AMNA-001, finn PRME PO2069, adp 27 jun), idb el salvador go/no-go, ppcs report finalisation, adp form 5500 due 14 jul.

## sources

- slack self-dm (D06QGJ34H53; 4 messages last 24h), slack search for nordic/amna/creaseworks (no new movement since 28 jun), gmail (`is:unread newer_than:1d`), gcal (30 jun), notion search (no fresh project-db status changes in the window), git log + working-tree status, `.brain/TASKS.md` (note: still stale at the caipb era, 13–15 jun). cash figure unavailable this run.
