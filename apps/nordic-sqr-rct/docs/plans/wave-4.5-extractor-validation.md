# Wave 4.5 — Extractor Validation + Research Requests

> **Status:** Planning artifact — no application code.
> **Author:** Claude (planning), Garrett (direction)
> **Date:** 2026-04-21
> **Dependencies:** Wave 3.7 (template-version classification, shipped), Wave 4.3 (Living PCS, upcoming)
> **Downstream consumers:** Wave 5 (Product Labels drift detection)

---

## §1. Problem statement + the three validation loops

### Why validation gaps survive

The PCS import pipeline today produces high-quality structured data from unstructured PDFs. But confidence is not binary. Every extraction produces a per-field confidence score embedded in the JSON. The template classifier produces a per-document signal set. Both of these outputs are logged and, in the template case, persisted to Notion — but neither triggers a durable human follow-up. Gaps vanish into Slack channel scrollback within hours.

This is the core problem Wave 4.5 addresses: converting transient signals into a **durable, assignable, weeks-surviving workstream**.

### The three validation loops

**Loop A — Per-field confidence** (exists, silently swallowed today)

`PROMPT_VERSION = 'v2.2-confidence'` tags every extraction with confidence scores per field. These scores sit in the extraction JSON but are never acted on after the commit path finishes. A field extracted at confidence 0.41 commits to Notion identically to one extracted at 0.97. The only downstream signal is a `[SANITY]` warning in the Slack notification — one line among many that scrolls past.

Loop A is partially closed: the data exists. What is missing is the routing step. A field with `confidence < 0.7` needs a ticket, an owner, and a due date, not just a warning string.

**Loop B — Template-version drift** (Wave 3.7, just shipped)

`classifyTemplate()` in `/src/lib/pcs-template-classifier.js` runs best-effort inside `commitExtraction()` at line 744 of `/src/lib/pcs-pdf-import.js`. It tags the PCS Document with `templateVersion` (`Lauren v1.0`, `Lauren v1.0 partial`, or `Legacy pre-Lauren`) and a `templateSignals` text block. The batch-complete Slack notification lists legacy documents under a "recommend re-issue" heading.

Loop B detection is closed. The lifecycle after detection is not. A document tagged `Legacy pre-Lauren` needs an assigned re-issue request that survives until someone updates the document, not a Slack mention.

**Loop C — Routing + notification** (the gap this wave closes)

There is no durable, queryable record of what Research or RA needs to do about Loop A or Loop B findings. The `NOTION_PCS_REQUESTS_DB` exists (`pcs-config.js` line 14; env var `NOTION_PCS_REQUESTS_DB`) and has a `REQUEST_STATUSES` enum (`'New', 'Blocked', 'With RES', 'With RA', 'Done'`). But the DB is currently used only for human-authored requests — no automated generator hooks into it, and it has no fields for request type, confidence signals, assigned team role, or aging metadata.

Wave 4.5 closes Loop C by activating the existing Requests DB as the authoritative queue for all validation work, wiring an automated generator into the commit path, and adding Workflow-backed digest and re-ping logic to keep the queue healthy.

### Why Slack-once notifications are not enough

Slack is ephemeral. A Monday morning `Legacy pre-Lauren` warning is invisible by Wednesday. The team has no way to query "what is still open?", "what is mine?", or "what is 30 days old and still unresolved?" without going back through channel history. There is also no concept of assignment — anyone can see the message; no one is responsible for acting on it.

A durable Notion database with assignee, status, priority, and aging metadata gives the Research and RA teams a workstream that survives deploys, personnel changes, and the natural entropy of a growing product catalog. Slack becomes the notification transport for the database, not the database itself.

---

## §2. PCS Research Requests DB — activation plan

### Read the existing schema first

Before writing any code, run a `notion.databases.retrieve({ database_id: process.env.NOTION_PCS_REQUESTS_DB })` call and inspect the live property map. The current `PROPS.requests` object in `/src/lib/pcs-config.js` (lines 194–206) defines: `request` (title), `status`, `requestedBy`, `requestNotes`, `owner`, `pcsVersion` (relation), `relatedClaims` (relation), `raDue`, `raCompleted`, `resDue`, `resCompleted`. Assume none of the Wave 4.5 additions below are already present until confirmed by that live inspection.

### Property additions for Wave 4.5

The following properties are **net-new**. Properties already present in `PROPS.requests` are kept as-is; the upsert logic will populate them as appropriate.

| Property | Notion type | Notes |
|---|---|---|
| **Related PCS** | Relation → PCS Documents DB | Parent document (not version). The existing `pcsVersion` relation points at a Version row — this new relation points at the Document row for grouping/filtering. |
| **Request type** | Select | `missing-field`, `low-confidence`, `template-drift`, `label-drift` |
| **Specific field / signal** | Rich text | The field name (e.g. `fmPlm`, `demographic`) or signal label (e.g. `missing Table B`) that triggered this request. |
| **Assigned role** | Select | `Research`, `RA`, `Template-owner` |
| **Assignee** | Person | The specific individual currently responsible. |
| **Priority** | Select | `Safety`, `High`, `Normal` |
| **Opened date** | Date | Set on creation; never updated. |
| **Last pinged date** | Date | Updated each time the nightly re-ping workflow runs for this request. |
| **Resolution note** | Rich text | Free-form explanation of how it was resolved; populated at close time. |
| **Source** | Select | `auto-on-commit`, `nightly-sweep`, `drift-detection`, `manual` |

The `PROPS.requests` constant in `/src/lib/pcs-config.js` will need corresponding key additions for all of these after the schema additions are confirmed live.

### Full property table (existing + new)

| Property | Type | Populated by |
|---|---|---|
| Request (title) | Title | Generator (descriptive string) |
| Status | Select (`New`, `Blocked`, `With RES`, `With RA`, `Done`) | Generator sets `New`; team updates |
| Requested by | Person | Generator sets service account or import operator |
| Request notes | Rich text | Generator populates full signal context |
| Owner | Person | Deprecated in favor of Assignee; keep for backward compat |
| PCS Version | Relation → Versions | Version that triggered the request |
| Related PCS | Relation → PCS Documents | Document parent (new) |
| Related Claims | Relation → Claims | Populated when request is claim-specific |
| RA due / RA completed | Date | Manual |
| RES due / RES completed | Date | Manual |
| Request type | Select | Generator (new) |
| Specific field / signal | Rich text | Generator (new) |
| Assigned role | Select | Routing logic (new) |
| Assignee | Person | Round-robin within role (new) |
| Priority | Select | Generator default `Normal`; escalated by rules (new) |
| Opened date | Date | Generator (new) |
| Last pinged date | Date | Nightly-sweep workflow (new) |
| Resolution note | Rich text | UI resolution action (new) |
| Source | Select | Generator (new) |

### Dedup key and upsert behavior

The dedup key is a composite of three values: `(pcs_document_id, request_type, specific_field)`.

Before creating a new request, query the Requests DB with a filter:

```
Related PCS == pcs_document_id
AND Request type == type
AND Specific field / signal == field_name
AND Status != 'Done'
```

If a matching open request exists, **update** it (bump `Last pinged date`, append to `Request notes` if the signal text has changed) rather than create a duplicate. If no match exists, create a new row. A `Done` request is never reopened — instead a new request is created, giving a clean audit trail.

This ensures that re-importing a document does not flood the queue, while also ensuring that a genuinely recurring gap (resolved once, regressed on next import) creates a fresh ticket with its own history.

### Views

| View name | Filter / sort | Primary audience |
|---|---|---|
| **My Open** | Assignee = me, Status != Done | Individual contributor daily triage |
| **All Open** | Status != Done, sorted by Opened date ascending | Team leads |
| **Aged > 14 days** | Status != Done, Opened date < today - 14 days, sorted by age descending | Lead escalation |
| **By PCS** | Group by Related PCS, filter Status != Done | Per-document audit |
| **Critical / Safety** | Priority = Safety OR Priority = High, Status != Done | RA compliance triage |
| **Recently Resolved** | Status = Done, sorted by RES completed or RA completed descending | Velocity check |
| **Unassigned** | Assignee is empty, Status != Done | Intake triage |

---

## §3. Generator logic — pseudocode

The generator hooks into `commitExtraction()` in `/src/lib/pcs-pdf-import.js` **immediately after the classifier block** (after line 763, before `return result`). The classifier already runs best-effort in a try/catch; the generator follows the same pattern so a request-generator bug never fails the import.

```
// AFTER the template-version classification block in commitExtraction()

try {
  const { generateValidationRequests } = await import('./pcs-request-generator.js');

  await generateValidationRequests({
    documentId: result.documentId,
    versionId: result.versionId,
    pcsId: data.document?.pcsId,
    extraction: data,                    // full extraction for field-level confidence scores
    templateVersion,                     // from classifier: 'Lauren v1.0' | 'Lauren v1.0 partial' | 'Legacy pre-Lauren' | null
    templateSignals,                     // { positive: string[], negative: string[] }
  });
} catch (err) {
  console.warn('[REQUEST-GEN] Failed to generate validation requests:', err?.message || err);
  warnings.push(`[REQUEST-GEN] Failed: ${err?.message || err}`);
}
```

The `generateValidationRequests` function (in new file `src/lib/pcs-request-generator.js`) runs the following logic:

```
async function generateValidationRequests({ documentId, versionId, pcsId, extraction, templateVersion, templateSignals }) {

  // --- Loop A: per-field confidence ---
  // The extraction JSON contains a top-level `confidence` object
  // with a `perField` map. Walk every key.
  const perField = extraction?.confidence?.perField ?? {};

  for (const [field, score] of Object.entries(perField)) {
    if (typeof score !== 'number') continue;
    if (score < 0.7) {
      const role = routeFieldToRole(field);   // see §4 routing table
      const assignee = pickAssignee(role);    // see §4 load-balancing

      await upsertRequest({
        dedupKey: { documentId, type: 'low-confidence', field },
        title: `Low-confidence extraction: ${field} on ${pcsId}`,
        type: 'low-confidence',
        specificField: field,
        assignedRole: role,
        assignee,
        priority: field.toLowerCase().includes('claim') ? 'High' : 'Normal',
        notes: `Field "${field}" extracted with confidence ${(score * 100).toFixed(0)}% (threshold: 70%). Manual verification required.`,
        source: 'auto-on-commit',
        documentId,
        versionId,
      });
    }
  }

  // --- Loop B: template-version drift ---
  if (templateVersion && templateVersion !== 'Lauren v1.0') {
    const missingSignals = (templateSignals?.negative ?? []).join('; ');
    const isLegacy = templateVersion === 'Legacy pre-Lauren';

    await upsertRequest({
      dedupKey: { documentId, type: 'template-drift', field: 'template-version' },
      title: `Template drift: ${templateVersion} — ${pcsId}`,
      type: 'template-drift',
      specificField: 'template-version',
      assignedRole: 'Template-owner',
      assignee: pickAssignee('Template-owner'),   // Lauren
      priority: isLegacy ? 'High' : 'Normal',
      notes: [
        `Template classified as "${templateVersion}".`,
        missingSignals ? `Missing signals: ${missingSignals}` : '',
        isLegacy ? 'This document predates the Lauren v1.0 template and should be re-issued.' : '',
      ].filter(Boolean).join('\n'),
      source: 'auto-on-commit',
      documentId,
      versionId,
    });
  }
}
```

Key design decisions:

- The function is purely additive — it never modifies existing Notion data outside the Requests DB.
- `upsertRequest` implements the dedup query described in §2 before creating a new row.
- If `extraction.confidence` is absent (older extraction format or extraction from a pre-`v2.2-confidence` prompt), the loop is a no-op. No error, no warning.
- Missing-field requests (where a field is entirely absent from the extraction, not just low-confidence) can be detected by checking `perField[field] === null` or `=== 'missing'` — the exact sentinel depends on how the extraction prompt encodes absence. This should be confirmed against the live prompt before implementation.

---

## §4. Routing logic — signal-to-team mapping table

### Primary routing table

| Signal / field | Assigned role | Rationale |
|---|---|---|
| `fmPlm` (FM PLM#) | Research | Formula-management linkage; Research (Gina/Sharon) owns PLM data |
| `ingredientSource` (AI Source) | Research | Supplier and sourcing data; Research confirms sourcing accuracy |
| `ai`, `aiForm` (active ingredient / form) | Research | Ingredient identity and form; Research validates against canonical DB |
| `demographic` (multi-axis demographic) | Research | Population scoping is a Research responsibility |
| `finishedGoodName`, `fmt` (Table B) | Research | Product identity fields validated against PLM system |
| `evidencePackets.*` (Table 4/5/6 narratives) | Research | Study summaries, takeaways, and design descriptions |
| `keyTakeaway`, `studyDesignSummary`, `canonicalSummary` | Research | Narrative evidence fields; Research authors and validates |
| `claimStatus` (Claim Status) | RA | Regulatory status of a claim is RA domain |
| `claimBucket` (3A / 3B / 3C routing) | RA | Bucket assignment has regulatory implications |
| `disclaimerRequired` | RA | Disclaimer obligation is RA judgment |
| `substantiationTier` (Table 3B/3C) | RA | Tier assignment is RA compliance judgment |
| `claim` (claim text itself) | RA | Verbatim claim copy touches regulatory admissibility |
| `revision-event prefix` (FC/FM pattern) | Template-owner | Template-structural signal; Lauren Bozzio owns the template |
| `tableB` / `finishedGoodName + fmt` (Table B structure) | Template-owner | Template structural completeness |
| `table4-narrative` (Table 4 block) | Template-owner | Indicates whether evidence packets follow the Lauren Table 4 layout |
| `template-version` (overall template drift) | Template-owner | Document-level re-issue is Lauren's remit |
| `totalEPA`, `totalDHA`, `totalEPAandDHA` (Omega-3 totals) | Research | Dose totals validated against formula lines by Research |
| `doseRequirements.*` (claim dose reqs) | Research | Dose requirements for claims validated by Research |

### Assignee selection within a role

The system does not currently have an expertise-tag system. Until one is built, use **round-robin load balancing** within a role:

1. At request-generation time, query the Requests DB for open requests grouped by assignee within the target role. Pick the assignee with the fewest open requests.
2. Tie-break: alphabetical by Notion user ID (deterministic across runs).
3. If no team members are configured for the role (see §10, open question 1 regarding RA team identities), leave `Assignee` blank and set `Status = New`. The "Unassigned" view in §2 catches these.

The assignee pool per role is stored as a configuration object in the generator module, populated from environment variables or a small JSON config file (not hardcoded), so the RA team members can be added without a code deploy when their Notion user IDs are known.

**Template-owner** is a single-person role: Lauren Bozzio. `pickAssignee('Template-owner')` always returns Lauren's Notion user ID, which must be set as `NOTION_PCS_TEMPLATE_OWNER_USER_ID` in the environment.

---

## §5. Vercel Workflow DevKit orchestration

### Why Workflow DevKit, not a plain cron

Both digest and re-ping workflows could be implemented as Vercel Cron functions polling Notion on a schedule. Workflow DevKit is the better choice for four concrete reasons:

1. **Durability across deploys.** A cron function that starts a fan-out over 50 open requests and hits a deploy mid-way through loses all progress. Workflow DevKit persists step outputs deterministically; a new deploy picks up from the last completed step.

2. **Retries on Notion / Slack flakes.** Each step marked `'use step'` gets automatic retry with exponential backoff. A single Notion rate-limit response does not abort the entire digest run.

3. **Step-level resumability for fan-out.** Sending 20 individual Slack DMs (one per assignee) is a fan-out. With Workflow DevKit, each DM is a step. If DM 7 fails, only DM 7 retries — not DMs 1-20.

4. **Durable wait for future escalation.** The nightly re-ping workflow at 30-day escalation sends a channel-wide message. If we later want to wait for acknowledgment before de-escalating, `defineHook` lets the workflow pause durably for human response without polling.

### Workflow A — Weekly digest

**Trigger:** Monday 8:00 am Pacific via Vercel Cron (`0 16 * * 1` UTC, which is 8 am Pacific standard / `0 15 * * 1` daylight saving — confirm timezone handling with Vercel Cron docs; see open question §10).

**Purpose:** Every team member with open requests receives a single Slack DM summarizing their queue with age-coded priorities. Avoids flooding the shared channel.

```
// app/workflows/weekly-digest.ts (future)

export async function weeklyDigestWorkflow() {
  'use workflow';

  // Step 1: fetch all open requests from Notion (single query, idempotent)
  const openRequests = await fetchOpenRequestsGroupedByAssignee();
  // Returns: Map<NotionUserId, Request[]>

  // Step 2: fetch Slack user IDs for each assignee
  const assigneeSlackIds = await resolveSlackUserIds(openRequests.keys());

  // Step 3: fan-out — one DM per assignee (each is its own step for retry isolation)
  for (const [notionUserId, requests] of openRequests) {
    await sendWeeklyDmStep(assigneeSlackIds.get(notionUserId), requests);
  }
}

async function sendWeeklyDmStep(slackUserId: string, requests: Request[]) {
  'use step';

  const message = buildWeeklyDigestMessage(requests);
  // Message includes age-coded priority: Safety = red, High + aged >14d = orange, Normal = grey
  // Each request bullet includes a direct Notion link and the opened date
  await slackDm({ userId: slackUserId, blocks: message });
}
```

The digest message groups requests by type and sorts by age descending. Priority coding: `Safety` items shown first with a red indicator, items aged >14 days shown with an orange indicator regardless of original priority, Normal items shown as plain text. The footer includes a count summary and a link to `/pcs/requests?filter=mine`.

### Workflow B — Nightly re-ping

**Trigger:** Every night at 11:00 pm Pacific via Vercel Cron (`0 7 * * *` UTC).

**Purpose:** Re-ping assignees on stale requests, escalating through three tiers as age increases.

```
// app/workflows/nightly-reping.ts (future)

export async function nightlyRepingWorkflow() {
  'use workflow';

  const now = new Date();

  // Step 1: fetch requests where last-pinged > 7 days ago AND status != Done
  const staleRequests = await fetchStaleRequests({ minDaysSinceLastPing: 7 });

  // Step 2: fan-out escalation — each request is its own step
  for (const req of staleRequests) {
    await repingStep(req, now);
  }
}

async function repingStep(request: Request, now: Date) {
  'use step';

  const ageDays = daysBetween(request.openedDate, now);

  if (ageDays >= 30) {
    // Tier 3: post to shared channel, cc team lead
    await slackPost({
      channel: SLACK_PCS_REQUESTS_CHANNEL,   // see §10 open question 2
      text: buildEscalationMessage(request, '30-day escalation'),
    });
  } else if (ageDays >= 14) {
    // Tier 2: DM assignee + cc their lead
    await slackDm({ userId: request.assigneeSlackId, text: buildRepingMessage(request, 'aged 14d') });
    await slackDm({ userId: request.leadSlackId, text: buildLeadCcMessage(request) });
  } else {
    // Tier 1: DM assignee only
    await slackDm({ userId: request.assigneeSlackId, text: buildRepingMessage(request) });
  }

  // Always update last-pinged date in Notion after a successful DM
  await updateRequestLastPinged(request.id, now);
}
```

The Notion write (`updateRequestLastPinged`) is inside the step so it retries together with the Slack call — both succeed or both retry. This prevents a "pinged Slack but failed to write Notion" state that would cause duplicate pings on the next nightly run.

### Infrastructure prerequisites

These are identical to the prerequisites documented in `docs/plans/wave-5-product-labels.md §5`:

- Project must be linked: `vercel link` (already done — `.vercel/project.json` present).
- Install the `workflow` package: `npm i workflow`.
- Workflow functions live in `app/workflows/` and use the `'use workflow'` / `'use step'` directives (Workflow SDK syntax; see https://vercel.com/docs/workflow).
- Environment must include `VERCEL_OIDC_TOKEN` for AI Gateway access if any step calls an LLM: `vercel env pull` against the Production scope. The nightly re-ping and weekly digest workflows do not call LLMs, so this is not a Day 1 blocker — it becomes relevant only if request summarization is added later.
- Slack Bot Token (`SLACK_BOT_TOKEN`) with `chat:write` and `users:read` scopes is required for DM delivery. The existing `SLACK_WEBHOOK_URL` in the codebase is an incoming webhook (channel-only) — it cannot send DMs. A bot token is a new infrastructure requirement. See open question §10 item 3.
- Cron schedule strings go in `vercel.json` under the `crons` key, pointing at route handlers that trigger the workflow.

---

## §6. UI surfaces

### Existing `/pcs/documents/[id]` — Outstanding Research Requests card

The document detail page at `/src/app/pcs/documents/[id]/page.js` fetches document and version data via two parallel `fetch` calls in `useEffect`. A third parallel fetch is added:

```
fetch(`/api/pcs/requests?documentId=${id}&status=open`)
```

The result renders as a collapsible card below the existing document metadata section. The card shows:

- Count badge: "3 open requests" in amber if any exist, green if zero.
- Per-request row: type icon (wrench for template-drift, magnifying glass for low-confidence), field name, assigned role chip, assignee name, age in days, status.
- "View all" link to `/pcs/requests?pcsId=<id>`.

The card is read-only in the first release (4.5.1). The resolution UI (§6, resolution paragraph) ships in a subsequent pass.

### New `/pcs/requests` index page

Route: `src/app/pcs/requests/page.js` (client component, mirrors the pattern of `/pcs/documents/page.js`).

Filter tabs rendered as a tab bar:
- **Mine** — requests where assignee matches the authenticated user; default tab.
- **All Open** — all requests with status != Done.
- **Aged > 14 days** — subset of All Open where opened date is older than 14 days.
- **Critical** — priority = Safety or High.

Each tab fetches from a new route handler `/api/pcs/requests` with query parameters `filter=mine|all|aged|critical`. The route handler translates these to Notion filter objects and returns a flat array.

Table columns: PCS ID (link), Request type, Specific field, Assigned role, Assignee, Priority, Opened date, Age (computed client-side), Status, Actions.

### Request detail side-sheet

A side-sheet component (not a new page) opens when a request row is clicked. It shows the full `Request notes` text, the PCS version link, related claims (if any), and the resolution UI (see below).

This side-sheet is the same component that will be triggered by clicking a "needs backfill" chip on the Living PCS page (Wave 4.3 interop). The chip click passes a `requestId` to the sheet; the sheet fetches the full request from `/api/pcs/requests/[id]`.

### Resolution UI

Inside the side-sheet, a "Mark resolved" button is visible to users with the `pcs` or `admin` role (`canWrite` check, matching the pattern in the document detail page). Clicking it:

1. Prompts for a `Resolution note` (single-line text input, required).
2. On confirm: `PATCH /api/pcs/requests/[id]` with `{ status: 'Done', resolutionNote, resolvedAt: new Date().toISOString() }`.
3. The route handler updates the Notion row and returns the updated request.
4. The side-sheet transitions to a "Resolved" read-only state.

Status transitions are role-gated: a Research team member can close `With RES` requests; an RA team member can close `With RA` requests; an admin can close any. Attempting to close a request owned by the other team shows a warning but does not hard-block (see §10 open question 5).

### Stretch — Slack deeplink resolution

The nightly re-ping DM includes a "Resolve" button using Slack's Block Kit interactive action. The action posts to `/api/slack/actions` which validates the Slack request signature, opens a modal asking for a resolution note, and on submit calls the same `PATCH /api/pcs/requests/[id]` handler. This requires the Slack bot to have `chat:write` + interactive component support configured. Tag as stretch for 4.5.4+.

---

## §7. Instrumentation — three health metrics

The three metrics selected are the ones that most directly reflect queue health and team throughput without requiring complex aggregations:

### Metric 1 — Median time-to-resolve, broken out by type and team

**What it measures:** How long it takes from request creation to resolution. Broken out by `request_type` (low-confidence, template-drift, label-drift) and by `assigned_role` (Research, RA, Template-owner).

**How it is computed:** At dashboard render time, query the Requests DB for rows with `status = Done` in the last 90 days. For each row, compute `(resolved_at - opened_date)` in days. Compute median across the set, then median within each type × role slice.

**Where it is surfaced:** Footer of the weekly digest Slack message as a one-line summary ("Median resolution: 6d Research / 9d RA / 4d Template"). Also visible on a metrics card at the top of `/pcs/requests`.

### Metric 2 — % of current PCS documents with at least one open request

**What it measures:** The "coverage debt" of the current catalog. A high percentage means a large share of the catalog has known gaps that haven't been addressed.

**How it is computed:** Two Notion queries — total PCS Document count (filter: archived = false), and count of distinct `Related PCS` values among open requests. Divide the latter by the former.

**Where it is surfaced:** `/pcs/requests` page header as a single-number callout ("38% of active PCS documents have open requests"). Also in the weekly digest footer.

### Metric 3 — Oldest-open-request age (p50 and p95)

**What it measures:** Queue staleness. A single 90-day-old ticket is a red flag that the queue is not being worked. p95 surfaces whether a small number of tickets are becoming permanently stale while the rest are resolved promptly.

**How it is computed:** At render time, compute `(today - opened_date)` for all open requests. Take the 50th and 95th percentile of that distribution. If p95 > 30 days, surface a warning indicator.

**Where it is surfaced:** `/pcs/requests` metrics card alongside Metric 2. The nightly re-ping workflow also reads p95 and includes it in the 30-day escalation channel message so team leads see the queue health in context.

---

## §8. Migration + rollout

### Backfill script

File: `scripts/backfill-research-requests.mjs`

The script iterates every PCS Document in the Documents DB that has `templateVersion = 'Legacy pre-Lauren'` or `templateVersion = 'Lauren v1.0 partial'` (set by the Wave 3.7 backfill script, `scripts/backfill-template-classification.mjs`). For each such document, it calls the same `upsertRequest` logic used by the generator (imported from `src/lib/pcs-request-generator.js`), passing:

- `type: 'template-drift'`
- `specificField: 'template-version'`
- `source: 'nightly-sweep'` (distinguishing from the auto-on-commit source, since these are retrospective)
- `priority: 'High'` for Legacy, `'Normal'` for Partial
- `notes`: pulled from the existing `templateSignals` text on the Document row

The dedup key prevents duplicates if the script is re-run. Run once after 4.5.0 ships and the DB schema additions are confirmed.

### Phased rollout

| Phase | Scope | Gate |
|---|---|---|
| **4.5.0** | DB schema additions (new properties) confirmed live. PROPS.requests updated. `src/lib/pcs-request-generator.js` written and hooked into `commitExtraction`. Backfill script runs. | First import after deploy creates request rows without errors. |
| **4.5.1** | UI surfaces: Outstanding Requests card on `/pcs/documents/[id]`. New `/pcs/requests` page with filter tabs. Request detail side-sheet. Resolution button. | Research team member confirms queue is browsable and resolution flow works end-to-end. |
| **4.5.2** | Weekly digest workflow. Requires `SLACK_BOT_TOKEN` and Workflow DevKit infrastructure in place. | Monday morning: each assignee with open requests receives a correctly formatted DM. |
| **4.5.3** | Nightly re-ping workflow. Requires age-based escalation logic tested against at least one aged request in staging. | A synthetic aged request (set `opened_date` to 15 days ago manually) triggers a re-ping DM on the next nightly run. |
| **4.5.4** | Metrics dashboard card on `/pcs/requests`. Metrics footer in weekly digest. Stretch: Slack interactive "Resolve" action. | Team lead can state the % coverage debt and median resolution time without opening Notion directly. |

---

## §9. Cross-wave interop

### Consumes from Wave 3.7

`classifyTemplate()` in `/src/lib/pcs-template-classifier.js` produces `templateVersion` and `templateSignals`. Wave 4.5 reads both fields directly from the `commitExtraction` result object (lines 762-763 of `pcs-pdf-import.js`). No new interface is required — the generator is called in the same function scope where those variables are already live.

The `templateSignals.negative` array becomes the `notes` body of the template-drift request. The specific negative signals (e.g. "missing Table B (no finishedGoodName + fmt)") give the assignee (Lauren) actionable detail without needing to re-read the original PDF.

### Produces inputs for Wave 4.3 (Living PCS)

The Living PCS view (Wave 4.3) will render field-level "needs backfill" chips where extraction confidence was low or a field was missing. Each chip is backed by a `requestId` from the Requests DB. Clicking the chip opens the Wave 4.5 side-sheet with the full request detail and the resolution UI.

This requires Wave 4.3 to query `/api/pcs/requests?documentId=<id>&type=low-confidence` when rendering the Living PCS and map the results to their corresponding field positions in the template. Wave 4.5 only needs to guarantee the API endpoint and the `specificField` property are populated consistently — which is already part of the generator design.

### Underpins Wave 5 (Product Labels drift detection)

The label drift detector in Wave 5 (pseudocode in `wave-5-product-labels.md §4`) calls `upsertRequestFromDrift` to create Request rows when a label's claims or ingredients diverge from its backing PCS. This function is the same `upsertRequest` utility in `src/lib/pcs-request-generator.js`, called with `type: 'label-drift'` and `source: 'drift-detection'`.

Wave 5 assumes Wave 4.5 is live so it can use `label-drift` as a request type without building a separate request infrastructure. The "Drift Review Queue" view in the Product Labels DB (wave-5 §2) filters on requests with `type = label-drift`, which already exists in the Wave 4.5 request type enum.

---

## §10. Open questions for the user

1. **RA team member identities.** The user memory notes "2 TBD" for the RA team. The routing logic in §4 needs Notion user IDs for these two people to populate the assignee pool. Once identified, they should be set as environment variables (`NOTION_PCS_RA_USER_IDS`, comma-separated) so the pool is configurable without a code change.

2. **Slack channel for escalations.** The 30-day escalation in the nightly re-ping workflow posts to a shared channel. What is the correct channel — `#pcs-research-requests`, `#pcs-ops`, the existing `#pcs-imports` channel where batch notifications already land? Confirm before the workflow ships.

3. **Slack bot token vs. webhook.** The existing `SLACK_WEBHOOK_URL` is an incoming webhook — it can only post to one pre-configured channel and cannot send DMs. The digest and re-ping workflows require a Slack bot with `chat:write` and `users:read` scopes. This is a new OAuth app setup in the Nordic Slack workspace. Who owns this? Does it require IT approval?

4. **Resolution authority — who can close what?** The resolution UI in §6 proposes soft role-gating (Research closes RES requests, RA closes RA requests, admin closes anything, cross-team gets a warning). Is the warning enough or should cross-team closure be hard-blocked? Related: can Lauren (Template-owner) close Research or RA requests if she's acting in an admin capacity?

5. **Priority escalation for Safety.** The `Safety` priority tier is defined in the schema but no generator rule currently produces it. Safety-priority requests are expected from Wave 5 label drift (ingredient safety cross-check). Should any Wave 4.5 generator paths also produce `Safety`-priority requests? Candidate: a claim whose `claimStatus` confidence is below 0.5 (the system isn't sure whether a claim is authorized or not). Confirm with RA whether that threshold is appropriate.

6. **Confidence threshold for low-confidence requests.** The 0.7 threshold in §3 is a starting point. After the first week of auto-generated requests, review whether it produces too many false positives (fields that look low-confidence but are actually correct) or too few (fields with genuine errors slipping through at 0.71). The threshold should be tunable via environment variable (`PCS_REQUEST_CONFIDENCE_THRESHOLD`, default `0.7`).

7. **Missing-field vs. low-confidence distinction.** The current extraction schema uses `null` for fields that genuinely don't exist in the source document (e.g., FM PLM# on a legacy PCS that predates the PLM system). Should a null value produce a `missing-field` request or be treated as N/A? The answer depends on whether the underlying PCS template version is Lauren v1.0 (where FM PLM# is expected) or Legacy (where it is not). The generator could suppress `missing-field` requests for fields that are expected to be absent on the classified template version. Confirm the desired behavior.

8. **Backfill scope.** The backfill script targets `Legacy pre-Lauren` and `Lauren v1.0 partial` documents. Should it also process fully classified `Lauren v1.0` documents for any low-confidence field requests? If those documents were imported under `PROMPT_VERSION = 'v2.2-confidence'`, their confidence scores are available and the backfill could generate low-confidence requests retroactively. This could produce a large initial queue. Confirm whether to include them.

9. **Weekly digest timing.** Monday 8 am Pacific is proposed. Is this the right cadence and time for the Research and RA teams given their current working rhythms? Would a Friday afternoon digest (review before the week ends) work better than a Monday morning one?

10. **`NOTION_PCS_TEMPLATE_OWNER_USER_ID` identity.** The routing table assigns all template-drift and template-structural requests to Lauren Bozzio. Her Notion user ID needs to be set in the environment. Confirm and add to the `.env.local` setup runbook.

---

*End of plan.*
