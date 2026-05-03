# Wave 6.1 — In-App Feedback Button (Operator Runbook)

> **Audience:** Lauren Bosio + RES team + RA team — anyone using the platform day-to-day who notices something off (a bug, a redundant claim, a confusing UI, an idea for what's missing).
> **Where:** Floating chat-bubble button, bottom-right corner of every authenticated PCS page (`/pcs/*`, `/pcs/aics/*`, `/pcs/documents/*`, `/pcs/claims/new`, etc.).
> **Capability gate:** `pcs.evidence:read` — every PCS-role user has it.

---

## What it's for

The platform has three categories of feedback we genuinely want to capture in the moment, while you're looking at the thing:

1. **🐛 Bug** — something is broken or wrong (clicked save, nothing happened; revision history shows wrong user; a claim chip renders with the wrong category).
2. **❓ Confusion** — the UI is unclear or you can't find what you need (where do I link an AICS reference? why is this dropdown empty?).
3. **💡 Idea** — feature request or suggestion (would love a "duplicate" filter on the claims library, would love benefit-category filter chips, etc.).
4. **💬 Other** — anything else.

Think of this as a **direct line to Garrett** for things you'd otherwise email or Slack about. It's faster (one click, type, send), it's scoped to the page you're on (the URL goes along automatically), and Garrett sees them in real-time in Slack `#nordic-platform-feedback`.

---

## How to use it (the mechanics)

1. Click the **chat-bubble button** in the bottom-right corner.
2. Modal opens. Pick a category (Bug / Confusion / Idea / Other).
3. Type your message. Be concrete:
   - *Bad:* "this is confusing"
   - *Good:* "On the AICS detail page, I can't tell which claims have been reviewed by RA. The Regulatory tab shows status but the Claims tab doesn't."
4. Click **Send**. You'll see a confirmation toast.

That's it. Rate-limited to 5 submissions per 10 minutes per IP — generous, you won't hit it.

---

## What gets sent automatically (you don't have to type these)

- The page URL you were on
- Your alias / role
- Browser + viewport size
- Commit SHA the platform was running (so Garrett can reproduce against the same build)
- Timestamp

Privacy: no screenshots, no DOM scraping. Just the metadata + your message.

---

## Best uses for the **PCS preview week** (and after)

### Vocab redundancies

If you're browsing the Claims Library and you spot duplicates ("this is the same as Claim 247 with a different word"), **flag it via the Idea category** with a short note:

> *Idea: claim "Required for/Plays a critical role in/Supports cellular energy production*" looks like a duplicate of "Supports cellular energy production*". Possibly merge or treat as a strength variant.*

These feed directly into the **Phase 4.6 claim-vocab-tier work** (see `docs/reviews/claim-vocab-redundancy-2026-05-03.md`). The more concrete examples Lauren and the RES team flag, the better the auto-classification heuristic gets.

### AICS template gaps

If you're entering an AICS doc and find a field the form doesn't capture (a regulatory monograph not in the dropdown, a demographic not in the controlled vocab), use **Confusion** or **Idea**.

### Anything that breaks

`Bug` category. Garrett gets pinged in Slack within seconds; most bugs get fixed in 24h.

---

## What this is NOT

- **Not a ticket tracker.** Use it for one-shot reports, not back-and-forth threads. If a bug needs a conversation, Garrett opens a Slack thread or email reply once he sees the feedback.
- **Not a claim-edit tool.** If a claim is wrong, edit it inline (Living-PCS panel) — that goes through the audit trail. Use feedback for things the platform itself isn't doing right.
- **Not anonymous.** Your alias is on every submission. If you'd rather flag something privately, Slack-DM Garrett.

---

## v2 roadmap (Wave 6.2+, on the retainer track)

- **Notion "Feedback Inbox" DB** — submissions land in a queryable Notion DB at `/admin/feedback`, not just Slack. Lets us close the loop ("flagged 2 weeks ago, fixed in commit X").
- **Image paste from clipboard** — paste a screenshot into the textarea, it auto-uploads to Vercel Blob and attaches.
- **Pre-populated context** — on a claim detail page, the modal pre-fills "Claim ID: c123 / Family: …" so you don't have to copy-paste it.

---

## Related

- `src/components/FeedbackButton.js` — UI source
- `src/app/api/feedback/route.js` — handler
- `src/lib/slack-notifier.js` — Slack fan-out
- `docs/reviews/claim-vocab-redundancy-2026-05-03.md` — the redundancy work this feature feeds into
