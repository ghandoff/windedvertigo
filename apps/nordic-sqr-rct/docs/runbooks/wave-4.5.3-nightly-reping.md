# Wave 4.5.3 — Nightly Research Requests Re-ping

Runbook for the nightly workflow that re-pings assignees on stale (≥7d since
last ping) open PCS Research Requests with a 3-tier age-based escalation.
Built on Vercel Workflow DevKit (package `workflow`), mirroring the
Wave 4.5.2 weekly-digest pattern.

## Pipeline

```
Vercel Cron (daily 07:00 UTC)
   └─► GET /api/workflows/nightly-reping        (CRON_SECRET bearer gate)
          └─► start(nightlyRepingWorkflow)      (workflow/api)
                 ├─ step: fetchStaleRequests({ minDaysSinceLastPing: 7 })
                 ├─ step: sendTierViaWebhook    (Mode A, one per non-empty tier)
                 │    — or —
                 ├─ step: sendBotMessage        (Mode B, per-row fan-out)
                 └─ step: markPinged            (updates `Last pinged date`)
```

Files:

- `src/workflows/nightly-reping.js` — workflow + steps
- `src/app/api/workflows/nightly-reping/route.js` — GET (cron) + POST (manual)
- `vercel.json` — cron entry `0 7 * * *`
- `src/lib/pcs-requests.js` — `queryRequests({lastPingedBefore})` +
  `updateRequestLastPinged(id, iso)`

## Escalation tiers

| Tier | Age (days from `Opened date`) | Delivery (Mode B)                             | Delivery (Mode A fallback)     |
| ---- | ----------------------------- | --------------------------------------------- | ------------------------------ |
| 1    | 7–13                          | DM assignee                                   | Consolidated channel post      |
| 2    | 14–29                         | DM assignee + DM role lead                    | Consolidated channel post (CC inline) |
| 3    | 30+                           | Post to `SLACK_REQUESTS_CHANNEL` + DM lead    | Consolidated channel post (CC inline) |

Mode is selected automatically by `SLACK_BOT_TOKEN` presence, identical to
Wave 4.5.2.

## Schedule — DST note

Cron fires at `0 7 * * *` UTC. That is:

- **PST (Nov–mid-Mar):** 23:00 Pacific (day before) ✅ on spec
- **PDT (mid-Mar–Nov):** 00:00 Pacific (midnight start of day)

One-hour drift accepted, same policy as weekly-digest.

## Env vars

Required in Production + Preview:

- `CRON_SECRET` — bearer for the cron route (shared with other workflows).
- `NOTION_TOKEN`, `NOTION_PCS_REQUESTS_DB` — Notion queries/writes.
- `SLACK_WEBHOOK_URL` — Mode A consolidated posts.
- `NEXT_PUBLIC_SITE_URL` — deeplinks into `/pcs/requests?id=…`.

New in 4.5.3:

- `NOTION_TEAM_LEADS` — JSON mapping role → Notion user UUID, used to resolve
  Tier 2/3 CC targets. Example:

  ```
  NOTION_TEAM_LEADS={"Research":"ab12...","RA":"cd34...","Template-owner":"ef56..."}
  ```

  If a role is missing from the map, the CC step is skipped and a warning is
  logged. Missing / invalid JSON → empty map, workflow still runs.

Optional (Mode B):

- `SLACK_BOT_TOKEN` — enables true DMs + channel posts via Web API.
- `NOTION_SLACK_USER_MAP` — JSON, Notion UUID → Slack user ID (reused from 4.5.2).
- `SLACK_REQUESTS_CHANNEL` — channel ID or name for Tier 3 escalations.

Optional safety:

- `DRY_RUN=1` — skip all Slack and Notion writes; log what would have been
  sent. Recommended for the first Preview deploy to validate selection logic.

## Manual trigger

```
curl -H "Authorization: Bearer $CRON_SECRET" \
     https://nordic-sqr-rct.vercel.app/api/workflows/nightly-reping
# → { "ok": true, "runId": "..." }

# synchronous (blocks until workflow completes)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
     "https://nordic-sqr-rct.vercel.app/api/workflows/nightly-reping?wait=1"
```

Inspect a run:

```
npx workflow inspect run <runId> --backend vercel --project nordic-sqr-rct
npx workflow web <runId>
```

## Dry-run recipe

Before enabling the cron for real, run once on Preview with `DRY_RUN=1`:

1. `vercel env add DRY_RUN` → Preview → `1`.
2. Redeploy the Preview branch.
3. `curl -H "Authorization: Bearer $CRON_SECRET" https://<preview-url>/api/workflows/nightly-reping?wait=1 | jq`
4. Inspect the returned result structure. The `byTier` counts and `results`
   array show exactly which rows would have been pinged.
5. Remove `DRY_RUN` from Preview when satisfied.

## Idempotency

The `markPinged` step updates `Last pinged date` to today's UTC date after
each successful Slack send. The `fetchStaleRequests` filter excludes rows
where `Last pinged date >= today - 7d`, so a second run on the same day
**will** re-ping the same rows (the filter is day-granular and today's row
now has `Last pinged date = today`, which is after the 7-days-ago cutoff, so
it is excluded on a same-day re-run).

However: a manual trigger during the day that fires AFTER the cron has
already run will NOT re-ping today's rows (good). A manual trigger that
fires BEFORE the cron and picks up the backlog will cause the nightly cron
to then find an empty queue (also good — no duplication).

## Team-lead resolution

Role name comes from the Request row's `Assigned role` property
(`Research`, `RA`, `Template-owner`). If the role is unset on a row,
`leadsByRole[undefined]` returns undefined, the CC step is skipped, and a
warning is logged with the request ID. Fix at the row level by setting
`Assigned role` in Notion.

## Failure modes

| Symptom                                  | Likely cause                                       | Fix                                                          |
| ---------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| 401 from cron endpoint                   | Missing/wrong `CRON_SECRET`                        | `vercel env add CRON_SECRET` → redeploy                      |
| Workflow returns `mode: 'noop'`          | No stale requests (queue is healthy)               | Nothing to do                                                |
| Mode B skips all assignees               | `NOTION_SLACK_USER_MAP` not populated              | Set JSON env var with Notion UUID → Slack ID mapping         |
| Tier 3 says "skip-no-channel"            | `SLACK_REQUESTS_CHANNEL` not set                   | Set channel ID in env; invite bot to the channel             |
| Lead CCs all "skip-no-mapping"           | `NOTION_TEAM_LEADS` empty or role name mismatch    | Set JSON env var; confirm role strings match `Assigned role` |
| Same rows pinged twice on same day       | Manual trigger run after cron                      | Expected — manual triggers are not deduplicated              |
| Slack webhook 400 "invalid_blocks"       | Tier bucket exceeds 50-block limit                 | Paginate within tier step (future work) or switch to Mode B  |

## Rollout sequence (recommended)

1. Merge + deploy worktree branch to Preview.
2. `DRY_RUN=1` on Preview; `curl …?wait=1`; verify counts look sane.
3. Unset `DRY_RUN`; trigger once manually against Preview — one message should
   arrive in the test channel, Notion `Last pinged date` should update.
4. Promote to Production. Cron picks up on next 07:00 UTC.
5. Observe the first real nightly run; inspect via `npx workflow web <runId>`.
