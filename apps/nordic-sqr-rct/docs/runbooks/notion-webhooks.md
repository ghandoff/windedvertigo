# Notion Webhooks — Setup Runbook

> **Purpose:** Register `POST /api/webhooks/notion/page-updated` in Notion so that
> direct team edits to PCS Notion databases are mirrored to Postgres within ~1 second,
> complementing the 2-minute drift-sync cron safety net.

---

## What this webhook does

When any team member saves a change to a PCS record in Notion, Notion sends a
`page.updated` or `page.created` event to our worker. The route identifies the
edited page's parent database ID, maps it to the appropriate
`syncSingle*PageToPostgres` helper, and mirrors the change immediately.

Only the 13 Postgres-mirrored databases are acted on; edits to label, prefix, or
AICS databases are silently acknowledged with `{ ok: true }`.

The cron (`*/2 * * * *`) remains the safety net — a webhook miss is caught within
2 minutes.

---

## Webhook URL

```
https://nordic.windedvertigo.com/api/webhooks/notion/page-updated
```

---

## Auth

The route checks `Authorization: Bearer <NOTION_WEBHOOK_TOKEN>` or the
`x-notion-webhook-token` header. `NOTION_WEBHOOK_TOKEN` is already set as a
CF Worker secret (confirmed 2026-05-07).

During initial setup Notion sends a verification challenge (`body.type = 'url_verification'`
or `body.verification_token`) — the route echoes it back automatically. No manual action
needed for the challenge step.

---

## Databases to register (all 13 mirrored tables)

Register **one webhook** covering all the databases listed below. Notion's UI lets
you select multiple databases per webhook.

| Notion DB name | env var | DB ID |
|---|---|---|
| Evidence Library | `NOTION_PCS_EVIDENCE_DB` | `5835efb6-7336-44b4-afd6-9fc49daaa6cb` |
| Claims | `NOTION_PCS_CLAIMS_DB` | `661ffecd-c3f1-4b68-b216-d068df38fa18` |
| Documents | `NOTION_PCS_DOCUMENTS_DB` | `44020402-bbbc-445d-830c-806d114e6d99` |
| Ingredients | `NOTION_PCS_INGREDIENTS_DB` | `bfaef639-3335-4e67-a7fd-9b90a059ee20` |
| Canonical Claims | `NOTION_PCS_CANONICAL_CLAIMS_DB` | `02820f09-e165-4468-85a4-82f16f3a9e73` |
| Core Benefits | `NOTION_PCS_CORE_BENEFITS_DB` | `414ce653-dfad-42ec-b446-2eee762c41b9` |
| Evidence Packets | `NOTION_PCS_EVIDENCE_PACKETS_DB` | `5a528e36-a1ec-469f-bbfc-0b669756124d` |
| Formula Lines | `NOTION_PCS_FORMULA_LINES_DB` | `1c2a69c0-a944-49c4-ac08-54a4f7ea2762` |
| References | `NOTION_PCS_REFERENCES_DB` | `1aea8c6f-2064-427a-8b05-5d8d4085ae61` |
| Requests | `NOTION_PCS_REQUESTS_DB` | `7589ebcd-cce8-4660-a66f-fbb0ffe75fe1` |
| Revision Events | `NOTION_PCS_REVISION_EVENTS_DB` | `f5a40944-5f15-435b-bd9e-a4ff7889d7a5` |
| Versions | `NOTION_PCS_VERSIONS_DB` | `e334741f-fe58-44da-b300-2ec12fa21c05` |
| Wording Variants | `NOTION_PCS_WORDING_VARIANTS_DB` | `986d92b3-90c5-45d9-b662-ecf67ac71374` |

---

## Step-by-step registration (Notion UI)

1. Go to [https://www.notion.com/my-integrations](https://www.notion.com/my-integrations)
2. Open the **WV Nordic** integration (or whichever integration has access to the PCS workspace)
3. Navigate to **Capabilities → Webhooks** (or the **Webhooks** tab)
4. Click **+ Add webhook**
5. Set **Webhook URL** to:
   ```
   https://nordic.windedvertigo.com/api/webhooks/notion/page-updated
   ```
6. Set **Events** to: `page.updated`, `page.created`
7. Under **Databases**, select all 13 databases listed in the table above
   (you can search by DB ID or name)
8. Click **Save** — Notion will send a verification challenge; the route handles it automatically
9. Confirm Notion shows the webhook status as **Active**

---

## Testing

After setup, open any Evidence or Claims record in Notion, change a field, and
save. Within 1–2 seconds the CF Worker logs should show:

```
[page-updated] mirrored pageId=<uuid> dbId=<uuid> mirrored=true
```

You can also test manually:

```bash
# Smoke test — should return { ok: true, reason: 'no page id in payload' }
curl -s -X POST https://nordic.windedvertigo.com/api/webhooks/notion/page-updated \
  -H "Authorization: Bearer <NOTION_WEBHOOK_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Notion shows webhook as **Failed** | NOTION_WEBHOOK_TOKEN mismatch | Check the token in Notion matches the CF Worker secret |
| Postgres row not updated after Notion edit | Webhook not registered for that DB | Add the DB to the webhook's database list |
| `[page-updated] page not accessible` in logs | Integration doesn't have access to the workspace | Share the Notion workspace with the WV Nordic integration |
| Rows still update after 2min but not instantly | Webhook missed; cron caught it | Check CF Worker logs for webhook errors; drift-sync cron is working as expected |

---

## Who to contact

- Webhook setup: Garrett (workspace admin)
- If NOTION_WEBHOOK_TOKEN needs to be rotated: `wrangler secret put NOTION_WEBHOOK_TOKEN --name wv-nordic`, then update in Notion's webhook settings
