# diag-dashboard.mjs — Operator Runbook

> **What it is:** a local diagnostic that runs the same data-fetch path as `/api/pcs/dashboard` but in isolation, so you can pinpoint which Notion DB is broken without browser-console gymnastics.
> **When to run:** anytime `/pcs` won't load, the Command Center shows error state, or the page hangs past 30s.
> **Where it lives:** `apps/nordic-sqr-rct/scripts/diag-dashboard.mjs`

---

## Quick start

```bash
cd /Users/garrettjaeger/Projects/windedvertigo/apps/nordic-sqr-rct

# Make sure .env.local has the production NOTION_TOKEN + DB IDs
vercel env pull .env.local --environment=production --yes

# Run the diagnostic
node scripts/diag-dashboard.mjs
```

Expected healthy output:

```
ok  getAllDocuments: 38 (676ms)
ok  getAllClaims: 469 (12550ms)
ok  getClaimsWithoutEvidence: 100 (839ms)
ok  getOpenRequests: 49 (612ms)
ok  getAllEvidence: 84 (696ms)
ok  getAllEvidencePackets: 1783 (11291ms)
```

(Counts vary as the corpus grows; what matters is that all 6 say `ok`.)

---

## What each fetch corresponds to

| Fetch | Backing table | If it fails | Likely root cause |
|---|---|---|---|
| `getAllDocuments` | Notion `pcs_documents` | `/pcs/documents` shows nothing | `NOTION_PCS_DOCUMENTS_DB` empty / wrong / integration not shared |
| `getAllClaims` | Notion `pcs_claims` | `/pcs/claims` shows nothing | `NOTION_PCS_CLAIMS_DB` empty / wrong |
| `getClaimsWithoutEvidence` | Same as above + filter | Dashboard "claims without evidence" KPI is wrong | parser bug, not env |
| `getOpenRequests` | Notion `pcs_requests` | "Requests" sidebar count wrong | `NOTION_PCS_REQUESTS_DB` empty / wrong |
| `getAllEvidence` | Notion `pcs_evidence` | `/pcs/evidence` shows nothing | `NOTION_PCS_EVIDENCE_DB` empty / wrong |
| `getAllEvidencePackets` | Notion `pcs_evidence_packets` | Coverage heatmap fails (only the lazy `/coverage` route now) | `NOTION_PCS_EVIDENCE_PACKETS_DB` empty / wrong |

---

## Common failure modes

### "Invalid request URL" (Notion API)

The env var is empty or malformed — Notion's SDK constructs `/databases//query` (double slash) and the API rejects it.

**Fix:** check via Vercel REST API to see the actual stored value:

```bash
TOKEN=$(jq -r '.["//"].token // .token' ~/Library/Application\ Support/com.vercel.cli/auth.json)
PROJECT=$(jq -r '.projectId' .vercel/project.json)
TEAM=$(jq -r '.orgId' .vercel/project.json)
curl -s "https://api.vercel.com/v9/projects/$PROJECT/env?teamId=$TEAM&decrypt=true" \
  -H "Authorization: Bearer $TOKEN" | \
  jq -r '.envs[] | select(.key | test("^NOTION_PCS_.*_DB$")) | "\(.key) target=\(.target | join(",")) value=\(.value | .[0:30])"'
```

If a row shows `value=` (empty), DELETE it via the API and POST a fresh one with the correct ID. The canonical IDs are commented inline in `src/lib/pcs-config.js` (lines 9–20). Trigger a redeploy after via `git commit --allow-empty -m "redeploy" && git push origin main`.

### "API token is invalid"

`NOTION_TOKEN` is wrong, expired, or unset. Pull the production env again with `vercel env pull --environment=production --yes` and re-run.

### "object_not_found"

The Notion integration `windedvertigo.com` doesn't have access to the database the script is querying. The fix is on the Notion side — share the database with the integration via `… → Connections → Add connections`.

### A specific fetch hangs >30s

Notion API is throttling or the DB has too many rows for the page-size loop. Cap pages with the `maxPages` parameter on `getAllClaims(maxPages)` if you're testing locally.

---

## When to expand the diagnostic

Add new fetches to `scripts/diag-dashboard.mjs` whenever a new lib helper is wired into a route the user-facing dashboard depends on. Pattern:

```javascript
await step('newFetchName', () => newFetchFn());
```

The `step` wrapper times the call and reports `ok` / `ERR` with stack-trace head.

---

## Related

- `src/lib/pcs-documents.js`, `src/lib/pcs-claims.js`, etc. — the helpers being exercised
- `src/app/api/pcs/dashboard/route.js` — the route that does the same fetches in production
- `src/app/api/pcs/dashboard/coverage/route.js` — heatmap fetches, split out 2026-05-03
- 2026-05-03 incident: 3 NOTION_PCS_*_DB env vars stored as empty strings, caused 500 on /api/pcs/dashboard. Diagnosed in <2 minutes with this script. ([commit c8318c3](#))
