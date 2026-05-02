# Wave 5.4 — Ingredient-safety cross-check runbook

**Status:** Shipped 2026-04-21
**Related plan:** `docs/plans/wave-5-product-labels.md` §5
**Prerequisites:** Wave 4.5.0 (Research Requests) + Wave 5.0 (Product Labels DB)

---

## What it does

When a Research member reads a new paper or advisory that raises a safety concern about a specific ingredient at a specific dose in a specific population, this workflow fans out across every active Product Label and opens an RA-routed Research Request for each matched SKU.

Shape of the story:

```
Evidence row flagged "Safety signal" in Notion
        │
        ▼
Notion webhook  →  /api/webhooks/notion/evidence-updated
        │
        ▼
start(ingredientSafetySweep, {...})
        │
        ├─ Step 1  enumerate Product Labels matching ingredient + dose + demographic
        ├─ Step 2  open one Research Request per matched label (priority = Safety, role = RA)
        ├─ Step 3  post a single digest to #ra-safety (one Slack call, not 200)
        ├─ Step 4  durably wait on each per-request `safety-request-resolved:<id>` hook
        └─ Step 5  post "sweep complete" when every request resolves
```

---

## Human workflow — flagging an Evidence row

A Research team member opens the Evidence row in Notion and sets:

| Field | Type | Notes |
|---|---|---|
| **Safety signal** | checkbox | Flip to true to trigger the sweep. |
| **Safety ingredient** | relation → Ingredients DB | The single canonical ingredient the concern is about. |
| **Safety dose threshold** | number | The dose at or above which the concern applies. Optional but strongly recommended. |
| **Safety dose unit** | text | `mg`, `mcg`, `IU`, `CFU`, etc. Must match the unit conventions used on the label. |
| **Safety demographic filter** | rich text (JSON) | Optional. Shape: `{"ageGroup": ["Children (4-8y)"], "lifeStage": ["Pediatric"]}`. Leave blank for population-agnostic. |

On save, Notion's webhook fires. If your webhook is registered, the sweep starts within seconds.

---

## Setting up the Notion webhook (one-time, manual)

The Notion API does not expose webhook CRUD via the MCP as of this writing. Register the webhook manually:

1. Go to **Notion → Settings → Developers → Webhooks**.
2. Endpoint URL: `https://<your-host>/api/webhooks/notion/evidence-updated`
3. Events: `page.updated`
4. Scope: the **Evidence Library** data source.
5. Copy the verification token Notion gives you and put it in `NOTION_WEBHOOK_TOKEN` (Production + Preview).
6. Redeploy so the token takes effect.
7. Edit any Evidence row to confirm the webhook fires (Settings → Developers → Webhooks → "Recent deliveries").

### Fallback: nightly cron

If Notion webhooks aren't usable in your workspace, add a nightly cron that lists Evidence rows where `Safety signal = true` and `Last Edited > 24h ago` and POSTs each to the trigger route. See `src/workflows/nightly-reping.js` for the fetch-and-fan-out pattern. Not yet implemented — flagged as follow-up.

---

## Manual kickoff

For testing or for signals declared outside Notion:

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "evidenceId": "f5a40944-5f15-435b-bd9e-a4ff7889d7a5",
    "ingredientId": "bfaef639-3335-4e67-a7fd-9b90a059ee20",
    "doseThreshold": 160,
    "doseUnit": "mg",
    "demographicFilter": { "ageGroup": ["Children (4-8y)"] },
    "triggeringUserId": "sharon-notion-uuid",
    "declaredAt": "2026-04-21T17:00:00Z"
  }' \
  "https://<your-host>/api/workflows/ingredient-safety?wait=1"
```

Drop `?wait=1` to fire-and-forget (returns 202 with a `runId` you can inspect via `npx workflow inspect run <runId>`).

---

## Resolving a request (closing the loop)

Each request opens a durable hook with token `safety-request-resolved:<requestId>`. To resolve it manually:

```bash
curl -X POST \
  "https://<your-host>/.well-known/workflow/v1/hook/safety-request-resolved:<requestId>" \
  -H "Content-Type: application/json" \
  -d '{ "resolvedBy": "ra-user-id", "decision": "no-exposure", "note": "Dose on label is 80mg, below threshold." }'
```

Once every request in the sweep is resolved, Step 5 fires the "sweep complete" Slack.

A future Wave 5.5 enhancement will wire a "Resolve safety review" button on the PCS Requests dashboard so RA doesn't have to curl.

---

## Environment variables

| Var | Required | Purpose |
|---|---|---|
| `CRON_SECRET` | yes | Gates the manual trigger route. |
| `NOTION_WEBHOOK_TOKEN` | production | Notion shared-secret for the evidence-updated endpoint. Preview/local can leave unset — the route logs a warning and accepts all calls. |
| `SLACK_SAFETY_CHANNEL` | optional | Channel ID (or `#name`) for the RA safety digest + completion posts. Falls back to `SLACK_REQUESTS_CHANNEL`, then `SLACK_WEBHOOK_URL`. |
| `SLACK_BOT_TOKEN` | optional | Used with `SLACK_SAFETY_CHANNEL` for targeted channel posts. Without it we fall back to `SLACK_WEBHOOK_URL`. |
| `SLACK_WEBHOOK_URL` | optional | Legacy incoming webhook. Used when no bot token is present. |
| `NEXT_PUBLIC_SITE_URL` | optional | For dashboard links in Slack. Defaults to the hosted URL. |

No new Notion env vars beyond the existing PCS database list — the sweep reads the Evidence, Ingredients, Product Labels, and Requests DBs using env vars that already exist.

---

## Workflow DevKit API observations

The plan §5 sketch referenced `step.forEach`, `step.parallel`, and `step.waitForWebhook`. Those aren't part of the DevKit in this repo's installed version (`workflow` package). Actual primitives used:

- `'use workflow'` / `'use step'` directives (same pattern as `weekly-digest.js`, `nightly-reping.js`).
- `createHook({ token })` from `workflow` — durable wait with a deterministic token so resolution calls can reconstruct it.
- Plain `for` loop for sequential fan-out, `Promise.all()` for the parallel hook waits. No special combinators.
- `start()` + `getRun()` from `workflow/api` for starting and inspecting runs.

See `node_modules/workflow/docs/foundations/hooks.mdx` for the canonical hook API.

---

## Files shipped in Wave 5.4

| File | Role |
|---|---|
| `src/workflows/ingredient-safety.js` | The workflow orchestrator (fan-out, digest, durable wait, completion). |
| `src/lib/label-safety.js` | `findLabelsByIngredientDoseAndDemographic()` + `openSafetyReviewRequest()`. |
| `src/app/api/workflows/ingredient-safety/route.js` | CRON_SECRET-gated manual trigger. |
| `src/app/api/webhooks/notion/evidence-updated/route.js` | Notion webhook → fire-and-forget `start()`. |
| `src/lib/pcs-evidence.js` | Parses five new Safety-signal fields on Evidence rows. |
| `src/lib/pcs-config.js` | Declares Safety-signal property names. |
| **Evidence Library (Notion)** | Five new properties added via MCP: Safety signal (checkbox), Safety ingredient (relation → Ingredients), Safety dose threshold (number), Safety dose unit (text), Safety demographic filter (rich text). |

---

## Open follow-ups

1. **Demographic matching is a no-op today.** `demographicMatches()` in `label-safety.js` returns true unconditionally because the Product Labels DB doesn't yet carry the four-axis demographic fields (those land as part of Wave 4.1b on the Labels side). Once it does, replace the TODO with real axis intersection.
2. **Dose unit normalization.** Cross-unit comparison (mg ↔ g ↔ mcg) is not handled. Unit mismatches fall through to RA for manual review (conservative over-inclusion). Revisit if RA reports false positives.
3. **Triggering user id.** The Notion webhook payload includes the editor; we don't surface it today. Add once the payload shape is confirmed.
4. **Resolve button.** Replace the curl-a-hook resolution flow with a Dashboard button in Wave 5.5.
5. **Cron fallback.** If Notion webhooks turn out to be flaky, add a nightly sweep of recently-flagged safety signals.

---

*End of runbook.*
