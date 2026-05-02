# Wave 7.0.4 — Slack Channel Configuration

> **Status:** Planning artifact — no application code.
> **Author:** Claude (planning), Garrett (direction)
> **Date:** 2026-04-21 (revised 2026-04-22)
> **Dependencies:** Wave 2/3 (PCS import), Wave 4.5.2 (weekly digest), Wave 4.5.3 (nightly re-ping), Wave 5.2 (label drift), Wave 5.3 (label extract), Wave 5.4 (ingredient safety), Wave 6.1 (feedback FAB)
> **Downstream consumers:** any future operator-facing automation with a Slack surface

> **Pre-condition reality (2026-04-22):** Garrett is NOT yet inside Nordic's
> Slack workspace. He has external DMs with Nordic team members only. Until
> Nordic adds him (or vice-versa), **all PCS automation notifications live in
> a single channel in Garrett's own Slack workspace** — a solo ops inbox,
> not a shared Nordic surface. The multi-channel Nordic layout described
> below is the eventual endpoint (likely 3-6 months out, post Nordic team
> adoption). Treat §2's 5-channel layout as **Phase 2-3**; Phase 0 today is
> one channel (`#nordic-pcs` or `#nordic-updates`) in Garrett's workspace,
> single webhook. The router in §3 still lands now — it just has one
> destination until the Nordic-workspace migration happens. When that
> happens, the migration is additive: add a Nordic-workspace webhook under
> a new env var, repoint a couple flows, done.

---

## §1. Problem statement

Five distinct automated Slack flows have shipped across Waves 2–6, and every one of them posts through the same `SLACK_WEBHOOK_URL`. That webhook was not provisioned in production until this week, so every notification has silently no-op'd since Wave 2 — `notifyBatchComplete()` and `notifyFeedback()` both short-circuit on `if (!webhook) return { sent: false }`, which is correct defensive behaviour but produces zero observability when the variable is missing.

The webhook is being provisioned now as a **firehose** — a single `#pcs-automation` channel that catches everything. That is the right Phase 1 move (immediate signal, one config change), but it is not the right steady state. Research, RA, Garrett, and future operators all care about different subsets of the traffic. Import-batch noise (many per day) and ingredient-safety escalations (rare, urgent) sharing a single channel will train everyone to mute it.

This wave plans the split: enumerate the flows, propose a channel layout, design an env-var-driven routing scheme that degrades gracefully back to the firehose, and describe a three-phase migration so we can land channels one at a time without a cutover weekend.

---

## §2. Every notification type in the system

Enumerated by reading `src/lib/slack-notifier.js`, `src/workflows/*.js`, `src/app/api/feedback/route.js`, `src/app/api/admin/imports/{stage,register}/route.js`, and `src/lib/pcs-import-runner.js`.

| # | Notification | Source (file · function) | Cadence | Audience | Volume (msgs/week) | Current env var | Recommended channel |
|---|---|---|---|---|---|---|---|
| 1 | PCS import batch complete | `src/lib/slack-notifier.js` · `notifyBatchComplete()` — called from `pcs-import-runner.js:145`, `api/admin/imports/stage/route.js:305`, `api/admin/imports/register/route.js:304` | On every terminal batch (all peers committed/failed/skipped) | Garrett, Research leads | 5–20 | `SLACK_WEBHOOK_URL` | `#pcs-imports` |
| 2 | Research Requests weekly digest (Mode A, consolidated) | `src/workflows/weekly-digest.js` · `sendModeADigest()` | Weekly (Mondays) | Research team (Sharon/Gina/Adin/Lauren) | 1 | `SLACK_WEBHOOK_URL` | `#pcs-requests` |
| 3 | Research Requests weekly digest (Mode B, per-assignee DM) | `src/workflows/weekly-digest.js` (when `SLACK_BOT_TOKEN` set) | Weekly, fan-out | Each assignee individually | ~4 DMs | `SLACK_BOT_TOKEN` + `NOTION_SLACK_USER_MAP` | DMs (unchanged) |
| 4 | Nightly re-ping — tier 1 (7-day gentle nudge) | `src/workflows/nightly-reping.js` · `postModeAConsolidated()` / `sendModeBDm()` | Nightly | Assignee | 5–15 | `SLACK_WEBHOOK_URL` or bot DM | `#pcs-requests` (Mode A) / DM (Mode B) |
| 5 | Nightly re-ping — tier 2 (14-day firmer) | same | Nightly | Assignee + lead CC | 2–8 | same | `#pcs-requests` / DM |
| 6 | Nightly re-ping — tier 3 (30-day escalation) | same, uses `SLACK_REQUESTS_CHANNEL` when bot mode | Nightly | Lead + channel | 0–3 | `SLACK_REQUESTS_CHANNEL` (Mode B) or `SLACK_WEBHOOK_URL` (Mode A) | `#pcs-requests` |
| 7 | Ingredient-safety fan-out digest | `src/workflows/ingredient-safety.js` · `notifyRaDigest()` | On sweep trigger (event-driven) | RA team | 0–2 | `SLACK_SAFETY_CHANNEL` / `SLACK_REQUESTS_CHANNEL` / `SLACK_WEBHOOK_URL` | `#ra-safety` |
| 8 | Ingredient-safety sweep complete | `src/workflows/ingredient-safety.js` · `notifyComplete()` | On sweep trigger (event-driven) | RA team + Garrett | 0–2 | same | `#ra-safety` |
| 9 | In-app Feedback FAB submission | `src/lib/slack-notifier.js` · `notifyFeedback()` — called from `src/app/api/feedback/route.js` | On user action | Garrett (+ whoever triages UX) | 2–10 | `SLACK_WEBHOOK_URL` | `#pcs-feedback` |
| 10 | Label drift findings (Wave 5.2) | `src/app/api/cron/sweep-label-drift/route.js` · **planned, not yet implemented** | Daily cron | RA team | TBD | — | `#ra-safety` |
| 11 | Label extract complete (Wave 5.3) | Label import completion hook · **planned, not yet implemented** | On label import | Garrett, Research | TBD | — | `#pcs-imports` |
| 12 | Deploy / runtime error alerts | **Not shipped; tracked for future** | On Vercel deploy / error event | Garrett | TBD | — | `#pcs-alerts` |

**Confirmed volume today (live callsites):** items 1–9 are active. Items 10–11 have skeletons in `src/lib/label-drift.js` and `src/app/api/cron/sweep-label-drift/route.js` with no Slack wiring yet. Item 12 is placeholder for Vercel Agent / error-alert integration.

---

## §3. Recommended channel structure

Five channels is the right ceiling — fewer and we re-create the firehose problem; more and each channel is too sparse to sustain attention.

| Channel | Purpose | Volume | Audience |
|---|---|---|---|
| `#pcs-imports` | Batch-complete summaries, per-job status, label extract completion | Highest (operational noise) | Garrett, Research leads |
| `#pcs-requests` | Weekly Research digest + nightly tier-1/2/3 re-pings (Mode A) | Moderate | Research team |
| `#ra-safety` | Ingredient-safety escalations + label drift critical findings | Low, high urgency | RA team (deferred until onboarded) |
| `#pcs-feedback` | FAB submissions (bug / confusion / idea / other) | Moderate, actionable | Garrett |
| `#pcs-alerts` | System errors, deploy failures, env-var misconfigs | Low, critical | Garrett |

**Why not collapse `#ra-safety` into `#pcs-requests`?** Because the escalation pattern differs. Requests are a queue — miss one today, catch it tomorrow. Safety is an event — miss one and a customer may ingest the wrong ingredient. Different alert discipline warrants different channels, even at low volume. That said, see §7 — we can **defer** creating `#ra-safety` until RA members are in the workspace; in the interim, the `SLACK_WEBHOOK_SAFETY` env var simply isn't set and safety flows fall back to the firehose.

**Why `#pcs-feedback` separate from `#pcs-alerts`?** Feedback is user-voice, asynchronous, triaged. Alerts are system-voice, synchronous, actioned. Mixing them trains the reader to skim past both.

**Alternative considered: threading inside one channel.** Rejected because Slack thread hygiene is poor on mobile and thread-mutes don't survive catch-up reading. Channel-level mute controls are the right primitive for signal-to-noise.

---

## §4. Env var strategy

**Current (Phase 1 / firehose):**

```
SLACK_WEBHOOK_URL                  # everything, one channel
SLACK_BOT_TOKEN                    # (optional) enables Mode B DMs
SLACK_REQUESTS_CHANNEL             # used by Mode B (nightly tier-3, weekly digest fallback)
SLACK_SAFETY_CHANNEL               # used by Mode B (ingredient-safety)
NOTION_SLACK_USER_MAP              # JSON map for DM fan-out
```

**Proposed (Phase 3 / per-channel):**

```
SLACK_WEBHOOK_URL                  # firehose fallback (keep as last resort)
SLACK_WEBHOOK_PCS_IMPORTS          # #pcs-imports
SLACK_WEBHOOK_PCS_REQUESTS         # #pcs-requests (Mode A consolidated)
SLACK_WEBHOOK_RA_SAFETY            # #ra-safety
SLACK_WEBHOOK_PCS_FEEDBACK         # #pcs-feedback
SLACK_WEBHOOK_PCS_ALERTS           # #pcs-alerts

# Mode B (bot) channel names unchanged:
SLACK_BOT_TOKEN
SLACK_REQUESTS_CHANNEL
SLACK_SAFETY_CHANNEL
NOTION_SLACK_USER_MAP
```

**Fallback rule:** if a per-channel webhook is unset, fall back to `SLACK_WEBHOOK_URL`. That means an operator can provision one channel at a time — the rest keeps flowing to the firehose until its specific webhook is added. No big-bang.

---

## §5. Mode A vs Mode B — how they layer

Wave 4.5.3 uses webhooks for Mode A and the Slack `chat.postMessage` bot API for Mode B (true DMs). These two modes are orthogonal to channel routing:

- **Mode A (webhooks):** one webhook per channel. Channel key selects the webhook. No Slack API call.
- **Mode B (bot):** one token, many channels. The code chooses a channel by passing a channel ID/name to `chat.postMessage`. `SLACK_REQUESTS_CHANNEL` and `SLACK_SAFETY_CHANNEL` are already doing this.

When `SLACK_BOT_TOKEN` is present, Mode B wins for flows that opt into it (weekly digest, nightly re-ping, ingredient-safety). Mode A webhooks remain the authoritative path for flows that don't (batch-complete, feedback, drift, alerts).

**No conflict between the two.** `SLACK_WEBHOOK_PCS_REQUESTS` and `SLACK_REQUESTS_CHANNEL` coexist: the former is the webhook URL for Mode A consolidated posts, the latter is the channel name the bot posts to in Mode B. They should both resolve to the same human channel (`#pcs-requests`) but they are different Slack primitives.

---

## §6. Implementation sketch (not code)

1. In `src/lib/slack-notifier.js`, add `getSlackWebhookForChannel(channelKey)`:
   - Read `SLACK_WEBHOOK_${channelKey.toUpperCase()}` first.
   - Fall back to `SLACK_WEBHOOK_URL`.
   - Return `null` if neither is set; callers already handle this.
2. Add a channel key to each exported notifier:
   - `notifyBatchComplete({ ..., channelKey: 'pcs_imports' })`
   - `notifyFeedback({ ..., channelKey: 'pcs_feedback' })`
   - New: `notifyLabelDrift({ ..., channelKey: 'ra_safety' })`
   - New: `notifyAlert({ ..., channelKey: 'pcs_alerts' })`
3. Update `src/workflows/weekly-digest.js` and `src/workflows/nightly-reping.js` Mode A paths to pass `channelKey: 'pcs_requests'` instead of reading `SLACK_WEBHOOK_URL` directly.
4. Update `src/workflows/ingredient-safety.js` webhook fallback to use `channelKey: 'ra_safety'`.
5. Log the resolved channel key + whether it hit the specific webhook or firehose fallback — makes ops debugging sane.

Tests stay boring: mock `fetch`, assert the URL chosen matches the env var precedence.

---

## §7. Migration path

**Phase 1 — Firehose (today, already in flight).**
- `SLACK_WEBHOOK_URL` provisioned on the Vercel Production scope (and Preview, per the env-parity rule in MEMORY).
- All five live flows + feedback FAB start posting to `#pcs-automation`.
- Verify with one manual import + one feedback submission. Done.

**Phase 2 — Split the noisy channels.**
- Create `#pcs-imports` and `#pcs-feedback` in the Slack workspace.
- Add incoming webhooks for each, set `SLACK_WEBHOOK_PCS_IMPORTS` and `SLACK_WEBHOOK_PCS_FEEDBACK` on Vercel (all scopes).
- No code change needed yet — but the code isn't reading those vars yet either. So Phase 2 ships **the router** (§6 items 1–2) together with the env vars. The firehose keeps catching everything else.

**Phase 3 — Split the low-volume channels.**
- Create `#pcs-requests`, `#ra-safety` (once RA is onboarded), `#pcs-alerts`.
- Add their webhooks + env vars.
- Update the workflow callsites (§6 items 3–5).
- Wire up Wave 5.2 / 5.3 Slack hooks while we're in there.
- Keep `SLACK_WEBHOOK_URL` set but unused as an escape hatch for one release cycle, then remove.

---

## §8. Open questions

- **`#pcs-feedback` + `#ra-safety` overlap?** Garrett reads both, but their mental models differ (user voice vs system hazard). Recommend: keep separate; Slack sidebar grouping handles visual proximity.
- **Defer `#ra-safety` creation?** Yes. Until RA members are in the workspace, `SLACK_WEBHOOK_SAFETY` stays unset and safety flows hit the firehose. Document the TODO in the runbook so it doesn't get lost.
- **Per-channel emoji prefixes for scanability?** Already partial — `notifyBatchComplete()` uses ✅/⚠️, `notifyFeedback()` uses 🐛/❓/💡/💬. Recommend codifying: 📦 for imports, 📋 for requests, 🚨 for safety, 💬 for feedback, 🔥 for alerts. One glyph per flow, inside its own channel, means even if a channel accidentally receives a cross-flow post it is visually tagged.
- **Preview vs Production webhooks?** Preview should almost certainly point at the **same** firehose (or a `#pcs-automation-preview` if volume warrants) — definitely not production channels. Add that to the Preview-parity checklist.

---

## §9. Acceptance criteria

- Every one of the 12 notification types in §2 has a documented channel key.
- Per-channel webhooks are additive: unsetting any one of them falls back to firehose without code changes.
- Mode A and Mode B routing continue to work without regression for weekly digest, nightly re-ping, and ingredient safety.
- `src/lib/slack-notifier.js` has a single `getSlackWebhookForChannel()` helper; no direct `process.env.SLACK_WEBHOOK_URL` reads remain in workflow files.
- A runbook entry at `docs/runbooks/wave-7.0.4-slack-channels.md` documents the channels, env vars, and the Preview-vs-Production parity rule.
