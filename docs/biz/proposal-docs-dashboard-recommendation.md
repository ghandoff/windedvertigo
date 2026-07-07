# Seeing proposal documents + status — current state, gaps, recommendation
_Prepared by Biz, 2026-06-21. Companion to the canonical hub + active pipeline index._

## What you already have (so we build on it, not beside it)
- **PaM ingests Biz commitments.** Every bid I promote already lands in PaM's tracker with a due date (and a `start_date` → Gantt bar). The Tiko/IOM/WESRP/NJ/ForAfrika/NTD/Azerbaijan commitments are all in PaM now. So Biz→PaM handoff works today.
- **PaM has a Gantt + overdue tracking** (the `/pam` momentum board). Overdue items surface automatically.
- **A Supabase-backed "strategy dashboard"** already exists — but it tracks revenue pipeline + marketing, *not* the RFP pipeline or proposal docs.
- **Proactive-reminder plumbing exists in pattern**: the scheduled `whirlpool-agenda-generator` (cron, auto-drafts + posts 24h ahead) proves we can run scheduled nudges; and the **Slack bot (CF Worker)** in progress is meant to push Mo/PaM/cARL messages to any device.
- **The Lighthouse board** shows each proposal's docs as per-tile links (`review draft → / cover letter → / team cvs →`) — but only one tile at a time, hidden behind the card. That's the exact pain you named.

## The gaps
1. **No consolidated documents view** — you can't see, in one place, every proposal's doc set, which version each is at (v1 auto-gen / v2 Biz / v3 human / approved), and which need your eyes.
2. **Human-review gates aren't time-boxed** — when a draft reaches "needs human review," nothing automatically creates a dated review task. (Fixed for Tiko just now, manually.)
3. **No proactive "review this" ping** — PaM tracks dates but doesn't yet say "Tiko draft-2 is waiting on you, due tomorrow."

## Recommendation

### A. A "Proposal Documents" tracker (the source of truth for doc status)
A lightweight table where **each row = one document** (not one deal): `Proposal · Doc type (proposal/cover letter/CV set) · Stage (v1 auto-gen → v2 Biz → v3 human → approved → exported) · Needs-human? · Owner · Due · Notion link`.
- **Interim:** build it as a **Notion database** (clickable straight into each doc, lives in your workspace, links from the deal + the canonical hub).
- **Phase 2:** move the *status fields* into **Supabase** (alongside the pipeline migration) so dashboards read one source; Notion keeps the doc bodies.

### B. The "make-and-look-and-see" view
On top of that tracker, a **board/dashboard grouped by Stage** — a column per stage (v1 / v2 / needs-human / approved), each card a document with a click-through that opens the Notion page in the browser. Two ways to render it:
- a **Notion board view** of the tracker (zero new infra), and/or
- a **`/proposals` tab in the port app** (reads Supabase post-migration) for the polished, always-on version,
- (optional) a **cowork live artifact** for an at-a-glance refreshable snapshot with the same click-through.

### C. Human gates become PaM commitments automatically
When Biz advances a doc to "needs human review," it **auto-creates a dated PaM commitment** ("review <proposal> draft-N"), backward-scheduled from the submission deadline — so it lands on the Gantt and in overdue-tracking. (Demonstrated for Tiko today; should be automatic, not manual.)

### D. Proactive reminders (so you're not just talking to Biz)
A **daily scheduled "review queue" digest** — same pattern as the whirlpool generator — that checks for docs in `needs-human` state and pushes you a short list (deadline-sorted) via the Slack bot / your morning brief: _"2 proposals waiting on your review: Tiko draft-2 (due tmrw), ForAfrika draft-1 (due Wed)."_ That's the proactive nudge you're missing.

### E. Standardise the lifecycle states
`v1 auto-gen (Lighthouse) → v2 Biz review → v3 human review → approved → exported (Google Doc → InDesign/Canva)` — one vocabulary that the tracker, the dashboard, and PaM all read.

## How the pieces talk
- **Notion** = document bodies (drafting home).
- **Supabase** (Phase 2) = pipeline + document *status* (one source of truth; dashboards + PaM read it).
- **PaM** = scheduling + overdue + the review-gate commitments.
- **Slack bot / morning brief** = the proactive nudge.
- **Biz** = advances doc states and writes the gates; you review and approve.

## Suggested build order
1. Notion "Proposal Documents" tracker + a board view grouped by Stage (immediate, no infra).
2. Auto-create the human-review-gate PaM commitment on every v1→v2 advance (small Biz change).
3. Daily review-queue digest via scheduled task → Slack bot (uses existing pattern).
4. Phase 2: fold doc-status into Supabase; add the `/proposals` port tab reading it.
