# Wave 8 — Audit Trail CSV Export (Operator Runbook)

> **Audience:** RA team, compliance, anyone needing to demonstrate "who changed what and when" on a PCS doc to an auditor or to internal review.
> **Capability gate:** `audit:read` (RA + admin + super-user).
> **Status:** Live as of Bundle 0 / Wave 8 Phase B.

---

## What it produces

A CSV with one row per revision event on the chosen PCS doc, columns:

| Column | Meaning |
|---|---|
| `revision_id` | Notion page ID for the revision log entry |
| `claim_id` | Which claim was changed (or "doc-level" for whole-doc edits) |
| `field` | Field name (e.g. `claim_text`, `min_dose`, `grade`) |
| `before` | Previous value |
| `after` | New value |
| `changed_by_email` | Operator's email (post Phase B email-as-key migration) |
| `changed_at` | UTC timestamp |
| `note` | Optional change description from the operator |

This satisfies the standard "audit trail" export format auditors expect for FDA / Health Canada / EU EFSA filings.

---

## Steps

1. Navigate to the PCS doc detail page (`/pcs/documents/<id>`).
2. Scroll to the **Revisions** section.
3. Click **Export CSV** in the section header.
4. Browser downloads `pcs-revisions-<doc-id>-<timestamp>.csv`.

That's it. No date range picker, no field filter — full revision history dumps in one file.

---

## What's NOT in the export

- **Reviewer edits on draft claims** (those happen in the reviewer workflow, separate audit log).
- **AICS revisions** — currently scoped to the PCS doc only. A companion AICS audit export will land when AICS revision tracking ships (Wave 8.1 or later, no firm date).
- **Login / logout events** — those are auth-layer audit, separate from the doc-level audit trail.
- **Read events** — only writes are tracked. There's no "who viewed this" log.

---

## Capability check (for operator-side debugging)

If the **Export CSV** button is missing from the Revisions section header, the user lacks `audit:read`. Verify with:

```bash
# As super-user
curl -s "https://nordic.windedvertigo.com/api/auth/me" | jq '.capabilities'
```

Expected to include `audit:read` for RA + admin + super-user. Researchers and reviewers do NOT have this by design — audit access is a regulatory/compliance role, not a research role.

---

## Compliance use cases

- **Annual claim audit:** Export per-doc CSV at year-end → import to Excel/Sheets → group by `changed_by_email` to show RA reviewers' coverage.
- **Pre-launch claim verification:** Before a product launches, RA exports the doc to confirm every claim has at least one RA-keyed revision (i.e. went through review).
- **Incident response:** If a label-printed claim is questioned, export the doc → filter `field = claim_text` → walk the before/after chain to show provenance.

---

## Related

- `wave-8-living-pcs.md` — Living-PCS revision panel UX
- `wave-7.1-capabilities-migration.md` — capability system
- `src/app/api/pcs/audit-trail/export/route.js` — handler source
- `src/components/pcs/living-view/PcsRevisionTable.js` — Export CSV button
