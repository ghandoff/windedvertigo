# Wave 5.2 — PCS ↔ Label Drift Detection Runbook

**Status:** Shipped 2026-04-21.
**Owner:** Research + RA (drift findings route to both roles).
**Code:** `src/lib/label-drift.js`, `src/app/api/cron/sweep-label-drift/route.js`.

## What it does

Compares each Active Product Label against its backing PCS Document and
opens a `label-drift` Request row for every discrepancy. Findings dedup via
`upsertRequest()` — running detection twice on the same unchanged label
produces zero new rows.

## Triggers (three)

| Trigger | Where | Hook |
|---|---|---|
| **PCS update** | `commitExtraction` in `src/lib/pcs-pdf-import.js` | Best-effort fan-out to all labels backing the committed PCS Document via `detectDriftForPcsDocument(documentId)`. |
| **Label update** | `createLabel` / `updateLabel` in `src/lib/pcs-labels.js` | `queueMicrotask` schedules `detectDriftForLabel(labelId)` after any change to claims, ingredients, doses, or the backing PCS relation. Skipped when the write is only a drift-stamp (avoids recursion). |
| **Nightly sweep** | `/api/cron/sweep-label-drift` | `vercel.json` cron at `0 8 * * *` (1am Pacific). Picks Active labels with `Last Drift Check` null or older than 90 days. Batches 10 per tick. |

## Drift categories + severity tiers

| Drift type | Compares | Severity | Role |
|---|---|---|---|
| **unauthorized-claim** | Label claim with NO ≥0.50 LLM match to any PCS 3A/Authorized claim | Critical | RA |
| **ingredient-drift** | Label ingredient set ≠ PCS formula-line set (either direction) | High | Research |
| **dose-drift** | Label ingredient amount ≠ PCS amount (±0% after mg/mcg normalization) | High | Research |
| **claim-text-drift** | Label claim with best-match similarity in [0.50, 0.85) | Normal | RA |
| **demographic-drift** | Label demographic axis ⊋ PCS axis on biologicalSex / ageGroup / lifeStage / lifestyle | Normal | Research |

`Critical` was added to `REQUEST_PRIORITIES` in `pcs-config.js` for this wave.
The Requests UI already handles the label-drift request type (Wave 4.5.1).

## Similarity threshold

- **0.85** is the drift threshold for claim-text drift.
- **0.50** is the unauthorized-claim floor — below it, we say the label
  claim has no substantive match in the PCS.
- Prompt audit tag: `LABEL_DRIFT_PROMPT_VERSION = 'v1-initial'` — stored in
  `src/lib/label-drift.js` and echoed into every Request's notes.
- After the first 20 real labels flow through, RA should review the
  findings and tune the threshold if the false-positive rate is too high
  (suggested tuning band: 0.80–0.90).

## Manual dry-run

```bash
node scripts/test-label-drift.mjs <labelId>
```

Prints findings + stats for one label without suppressing errors. Safe to
run against production; it calls `upsertRequest()` so repeated runs do not
create duplicate rows.

## Cost / rate limits

- One LLM call per label-claim (parallelized across label claims within one
  label, serial across labels in the sweep).
- Ballpark at Haiku pricing: ~$0.0008 per similarity call. A label with 5
  claims costs ~$0.004 / drift check. Nightly sweep of 10 labels ~= $0.04.
- Set `LLM_MODEL=claude-haiku-4-5-20260501` (or current Haiku) in Vercel env
  to route similarity calls to the cheap/fast model.

## Failure modes & safety

- Drift detection is wrapped in best-effort try/catch at every integration
  point. A bug in drift can never fail a PCS import or a label write.
- When the label has no backing PCS or the PCS has no latest version, the
  detector returns early with a descriptive `error` string in the result.
- When the label's demographic axes are empty, demographic-drift is
  skipped (no false positives from missing data).

## Verification checklist (first-run)

1. Ensure `CRON_SECRET`, `LLM_API_KEY`, `NOTION_TOKEN`, and all
   `NOTION_PCS_*_DB` ids are set in the target Vercel scope.
2. Run `node scripts/test-label-drift.mjs <labelId>` against one of Gina's
   seed labels. Expect at least one finding — if zero, either the seed
   label is too aligned to test, or something is wrong.
3. Hit `/api/cron/sweep-label-drift` with the cron bearer and confirm the
   response payload shows `labelsProcessed > 0` and `findings >= 0`.
4. Check the PCS Requests DB for new rows with `Source = drift-detection`
   and `Request type = label-drift`.
