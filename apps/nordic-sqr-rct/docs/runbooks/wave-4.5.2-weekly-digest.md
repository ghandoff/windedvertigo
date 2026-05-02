# Wave 4.5.2 — Weekly Research Requests Digest

Runbook for operating the Monday-morning Slack digest of open PCS Research
Requests. Implemented on top of the Vercel Workflow DevKit (package
`workflow`) with fan-out-friendly steps so Slack/Notion failures retry in
isolation.

## Pipeline

```
Vercel Cron (Mon 16:00 UTC)
   └─► GET /api/workflows/weekly-digest        (CRON_SECRET bearer gate)
          └─► start(weeklyDigestWorkflow)      (workflow/api)
                 ├─ step: fetchOpenRequestsGroupedByAssignee
                 ├─ step: resolveSlackRecipient          (Mode B only)
                 └─ step: sendConsolidatedDigestViaWebhook (Mode A)
                        | sendGroupViaBotApi             (Mode B)
```

Files:

- `src/workflows/weekly-digest.js` — workflow + steps
- `src/app/api/workflows/weekly-digest/route.js` — cron trigger (GET) +
  manual trigger (POST)
- `vercel.json` — cron entry `0 16 * * 1`
- `next.config.js` — wrapped with `withWorkflow()` from `workflow/next`

## Delivery modes

Mode is chosen at runtime by env-var presence:

| Env                              | Mode A (fallback)        | Mode B (bot DM)              |
| -------------------------------- | ------------------------ | ---------------------------- |
| `SLACK_WEBHOOK_URL`              | required                 | optional (unused)            |
| `SLACK_BOT_TOKEN`                | absent                   | **required**                 |
| `NOTION_SLACK_USER_MAP` (JSON)   | ignored                  | strongly recommended         |
| `SLACK_REQUESTS_CHANNEL`         | ignored                  | optional fallback channel    |

- **Mode A — consolidated webhook (current state).** One HTTP call to the
  existing incoming webhook. Message is grouped by assignee; "Unassigned"
  is just another group. Safe to ship today.
- **Mode B — per-assignee DM.** `chat.postMessage` with `channel` set to
  the Slack user ID (Slack auto-opens the IM). Unmapped assignees fall
  through to `SLACK_REQUESTS_CHANNEL` if set, otherwise skipped with a
  warning log line. The unassigned bucket always goes to that channel
  when present.

### `NOTION_SLACK_USER_MAP` format

Single-line JSON, Notion user UUID → Slack user ID:

```
NOTION_SLACK_USER_MAP={"ab12...":"U012ABCDEF","cd34...":"U034GHIJKL"}
```

Invalid JSON is tolerated (logs and treated as empty map). To find a
Notion user UUID, open a Request in Notion, copy the assignee, and inspect
the `people` array returned by `queryRequests()` — the `id` field.

## Schedule — DST note

The cron fires at `0 16 * * 1` UTC. That is:

- **PST (Nov–mid-Mar):** 08:00 Pacific ✅ on spec
- **PDT (mid-Mar–Nov):** 09:00 Pacific — one-hour drift

Acceptable for now. Future options: split into two schedules with
date-guarded short-circuits, or move scheduling inside the workflow
function (`sleep()` + wall-clock math).

## Message anatomy

Per-assignee section:

```
Assignee Name — N open requests
  _Template drift_
   🔴 Request title · `field` · 7d · <PCS link> <open>
   🟠 …
  _Low confidence_
   ⚪ …
```

Emoji legend (from the plan):

- 🔴 `priority == 'Safety'`
- 🟠 `priority == 'High'` AND `ageDays > 14`
- ⚪ everything else

Footer links to `/pcs/requests?filter=mine` (DM) or `?filter=all`
(channel digest).

## Provisioning Slack bot (Mode B, when ready)

1. https://api.slack.com/apps → **Create New App** → *From scratch* → name
   "PCS Digest" in the Nordic workspace.
2. **OAuth & Permissions** → Bot Token Scopes: `chat:write`, `users:read`,
   `im:write`. Install to workspace and copy the bot token
   (`xoxb-…`).
3. `vercel env add SLACK_BOT_TOKEN` → Production + Preview.
4. Collect Slack user IDs for the Research and RA teams (Slack profile →
   ⋯ → Copy member ID) and populate `NOTION_SLACK_USER_MAP`.
5. Invite the bot to `#pcs-requests` (or whatever channel is set in
   `SLACK_REQUESTS_CHANNEL`) so unmapped-assignee fallbacks succeed.
6. Redeploy — no code change needed; the workflow reads env at run time.

## Manual trigger

```
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  "https://nordic-sqr-rct.vercel.app/api/workflows/weekly-digest"
# → { "ok": true, "runId": "..." }
```

Append `?wait=1` to block until the workflow finishes and return the
result inline (useful during local dev).

Inspect a run:

```
npx workflow inspect run <runId> --backend vercel --project nordic-sqr-rct
npx workflow web <runId>    # open dashboard
```

## Env var checklist

Required in Production + Preview:

- `CRON_SECRET` (already set — same one the import worker uses)
- `NOTION_TOKEN`, `NOTION_PCS_REQUESTS_DB` (already set)
- `SLACK_WEBHOOK_URL` (already set — Mode A)
- `NEXT_PUBLIC_SITE_URL` (footer deeplinks)

Optional / future (Mode B):

- `SLACK_BOT_TOKEN`
- `NOTION_SLACK_USER_MAP`
- `SLACK_REQUESTS_CHANNEL`

## OIDC prereq

Not required for Wave 4.5.2. The digest workflow is fully deterministic —
no LLM calls, no AI Gateway usage. If Wave 4.5.3 / 4.5.4 add an LLM
summary step, `VERCEL_OIDC_TOKEN` must be pulled via
`vercel env pull --environment=production`.

## Failure modes

| Symptom                                     | Likely cause                                  | Fix                                                          |
| ------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| 401 from cron endpoint                      | Missing/wrong `CRON_SECRET`                   | Re-issue via `vercel env add CRON_SECRET`                    |
| Workflow run stuck in "running"             | Step throws non-retryable error               | `npx workflow inspect run <id>`; fix step; re-trigger        |
| Slack webhook 400 "invalid_blocks"          | Message exceeds 50-block limit                | Expected only with very large queues — paginate future work  |
| Mode B skips all assignees                  | `NOTION_SLACK_USER_MAP` empty or misformatted | Set JSON env var; restart deploy                             |
| Duplicate DMs on the same Monday            | Manual trigger on top of cron                 | Expected; workflows are not idempotent across manual retries |
