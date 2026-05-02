# Wave 8 — Living PCS · Operator Runbook

> **Audience:** Garrett (DPO), Nordic Research (Gina + team), Nordic RA.
> **Status:** Phases A, B, C1–C4, D, A.7, A.8, and 8.1 all live in production.
> **Last updated:** 2026-04-22

---

## What Wave 8 changed for your daily workflow

Before Wave 8, PCS documents were read-only inside the platform. Any edit happened in Word, got emailed around, and eventually ended up back in Notion via an engineer. That loop is now closed: **every PCS entity is editable in place**, every edit is **captured as a versioned revision**, and any edit can be **reverted** by Garrett with one click.

You don't need to change how you *think* about the platform. Open a document, click a field, edit it, blur. Saved. If you fat-finger something, the History panel has your back.

---

## How to edit something

### PCS Documents — `/pcs/documents/[id]`

- **Compact mode (default):** hover any field you want to change. An "Edit" link appears on the right. Click to enter edit mode, type, click Save (or press Enter). Esc to cancel.
- **Word mode (for scannability):** toggle the **Word** button in the page header. Everything renders in Lauren's Word-template layout (serif font, 11pt, real tables). Currently read-only in this view — toggle back to Compact to edit.
- **Editable fields:** name, FMT format, SAP material number, SKUs, file status, product status, transfer status, document notes.

### Canonical Claims — `/pcs/canonical-claims/[id]`

- Click any field to edit in place. Supports title, claim family, notes/guardrails, dedupe decision.
- Relations (prefix, benefit category, active ingredient) are read-only here today — edit via the Notion interface for now. (Wave 8 Phase C doesn't yet ship a relation picker.)

### Claims — `/pcs/claims/[id]`

- The "Edit Fields (audited)" card exposes the seven editable fields: claim text, prefix, bucket, status, min dose (mg), max dose (mg), notes.
- The existing view stays unchanged above.

### Evidence packets — inline on `/pcs/claims/[id]`

- Each packet row has an "Edit" affordance when you have the capability. Edit name, tier, role, key takeaway, relevance note, study design summary, sample size, SQR threshold (one-click toggle), null result rationale.
- `meetsSqrThreshold` is a checkbox and saves instantly on click — no confirm step.

---

## Who can edit what

All four entity types are gated by **`researcher` + `ra` roles** (admin inherits via composition; super-user can do anything). Reviewers and `pcs-readonly` users see the exact same pages in read-only mode — edit affordances simply don't appear.

Capability keys in use:
- `pcs.documents:edit`
- `pcs.claims:edit`
- `pcs.evidence:edit`
- `pcs.canonical:edit`

Changing who can edit these is a single-line change to `ROLE_CAPABILITY_MAP` in `src/lib/auth/capabilities.js` and requires a deploy. Ask Garrett.

---

## The History panel

Every detail page with inline edit has a **History** button in the header. Click to open a right-side panel showing the last 20 revisions for this entity.

Each revision row shows:
- Timestamp (relative: "2 min ago", "3 hours ago")
- Actor (email of the person who made the change)
- Field path (what was changed)
- Click to expand → side-by-side before/after diff

Filter controls at the top: by actor (substring match), by field path (substring match), by date range (All / 7d / 24h).

**The revert button** appears on each revision when you are **super-user**. Admin, researcher, RA see the full history but no revert button. Clicking Revert opens a confirm dialog requiring a reason (text is saved with the revert audit entry).

### What happens when you revert

For the four wired entity types (`pcs_document`, `claim`, `evidence_packet`, `canonical_claim`), revert is a real rewrite: the live entity rolls back to the pre-edit value, AND a new revision row is created that points back at the reverted one (so the revert itself is auditable).

For other entity types (formula lines, claim prefixes, active ingredients, AI forms, reviewers), revert currently logs the audit trail but doesn't rewrite the live row — the toast message will say "Revert audit logged. Live entity not rewritten (no updater wired for this entity type yet)." Those four types are scheduled for Wave 8.2.

**Revert is nuclear.** It bypasses the normal review flow entirely. Use it when you catch a bad edit in real time; for anything older than a day or two, prefer fixing forward (edit again to the correct value) so the history narrative stays intact.

---

## The dedupe review surface

Route: `/pcs/canonical-claims/dedupe-review`

### What it is

A single page showing all canonical-claim clusters where two or more rows share the same identity key (per the Wave 7.0.5 T2 canonical-key audit). Each cluster is one card; each card has one row per candidate.

### How to use it

1. **Scan summary tiles:** "Clusters", "Fully decided", "Needs attention", "Rows in clusters", "Undecided rows". These update as you mark decisions.
2. **Sort within a cluster:** the ★ row is the "most-referenced" survivor candidate (merging into it minimizes downstream re-pointing). The "Links" column shows the raw count. The "Created" column helps when references are tied.
3. **Pick a decision per row from the dropdown:**
   - **Keep this (survivor)** — the one row that stays in the cluster
   - **Retire into survivor** — fold this row; its PCS claim references will be re-pointed at the survivor
   - **Archive entirely** — the row goes away completely; its references lose their canonical linkage (rare — most retirements are merges)
   - **Actually different (false positive)** — the identity key was too blunt; these rows are genuinely distinct and should not be merged. Leaves them alone.
   - **Needs more info** — punt; revisit later.
4. **Guard rails:**
   - A **"Multiple survivors picked"** red badge appears if you mark two rows in the same cluster as survivor. Fix before submitting.
   - A **"Partial"** amber badge appears when some but not all rows in a cluster have decisions.
   - A **"Decided"** green badge appears when every row in a cluster has a decision AND there's exactly one survivor.
5. **The orphan cluster** (the 17-row "v1:::::not_applicable::" cluster): these rows aren't real duplicates. They all share an empty identity key because their prefix/benefit/AI relations are unset. The decision dropdown is disabled for them — use the direct-link "Edit in PCS" button on each row to go assign missing relations, then the next audit run will either give them unique keys or correctly surface them as duplicates of existing rows.

### After you finish

When every cluster you intend to resolve has a survivor + retirements marked, Garrett runs:

```bash
node scripts/merge-canonical-claims.mjs --dry-run --verbose   # preview
node scripts/merge-canonical-claims.mjs --confirm              # execute
```

The script reads decisions directly from the Notion rows (no export/import of your marks needed) and performs the re-pointing. It's idempotent — re-running after a successful merge is a no-op for already-processed clusters.

---

## Common questions

**Q: I made an edit and hit save, but the page reverted to the old value.**
A: The server rejected the write (usually an allowlist violation or Notion validation error) and the UI rolled back. Look for a red error message next to the field. If the error message is unclear, check the browser dev-tools Network tab for the PATCH response body.

**Q: My teammate just edited a field I'm viewing. Do I see it?**
A: Not live. You'll see their edit after you reload the page or open the History panel. Wave 9 will add real-time collaborative editing; for now, treat multi-user edits the way you treat Word — coordinate first.

**Q: I hit Edit on a field and nothing happened.**
A: You probably don't have the required capability. Reviewers and `pcs-readonly` users see the read-only view only. Ask Garrett if you should.

**Q: I can see the History panel but the Revert button isn't showing.**
A: Revert is super-user only. The panel shows everyone the full history; only Garrett sees Revert.

**Q: I reverted a revision and the live entity didn't change.**
A: Check the toast message. For entity types not yet wired to the live-rewrite path (formula lines, claim prefixes, active ingredients, AI forms, reviewers), revert logs the audit trail only. Those types get wired in Wave 8.2.

**Q: Does the History panel show edits made in Notion directly?**
A: No. Only edits made through the PCS web app (which is the only sanctioned write path) create revision rows. If someone edits in Notion directly, the platform sees the new value but has no audit entry for the change. This is one of several reasons the DPO policy restricts Notion workspace access to Garrett.

**Q: How long are revisions retained?**
A: Forever. There's no archival policy yet. If Notion row-count pressures emerge, we'll build a Wave 8.x archive-old-revisions job.

---

## For Garrett — revert policy

Use revert **liberally** in the first days after an edit lands:
- A field that was mis-typed can be reverted in seconds
- Legal or regulatory concerns about a claim wording — revert, then edit forward with the correct phrasing + a reason note

Use revert **sparingly** for anything older than 48 hours:
- Downstream systems (label import, evidence fan-out, weekly digests) may have already acted on the edited value
- Reverting a claim's prefix days after it shipped to a label review creates a downstream cascade that isn't automatically untangled
- Prefer edit-forward with a reason note for older changes

Every revert writes an audit row naming you + your reason + a reference to the original revision. If Nordic ever asks "who changed what and when," the PCS Revisions DB is the answer.

---

## Emergency: how to disable editing globally

If there's a security incident and you need to freeze all PCS writes:

```bash
# In Vercel env vars (prod + preview):
PCS_WRITES_FROZEN=true
```

*(Not yet wired — this is a planned Wave 8.3 kill switch. Today, revoke the `pcs.*:edit` capabilities from all roles in `capabilities.js` and redeploy. Takes ~3 minutes.)*

---

## Developer notes

### Adding edit support to a new entity type

1. Add a `update{Entity}Field({ id, fieldPath, value, actor, reason })` helper in `src/lib/pcs-{entity}.js` that routes through `mutate()` from `pcs-mutate.js`.
2. Define an `EDITABLE_FIELDS` allowlist for that entity; reject writes outside the allowlist with a 400.
3. Add a PATCH route at `src/app/api/admin/pcs/{entity}/[id]/route.js` guarded by `requireCapability('pcs.{entity}:edit')`.
4. Add the new entity type to `ENTITY_PATCH_URL` map in `src/components/pcs/InlineEditField.js`.
5. Add the new entity type to `REVISION_ENTITY_TYPES` in `src/lib/pcs-config.js`, and to the `Entity type` select options in the PCS Revisions Notion DB.
6. Add the new type to `ENTITY_UPDATERS` map in `src/app/api/admin/pcs/revisions/[id]/revert/route.js` so revert works.
7. Wire the UI: drop `<InlineEditField entityType="your_type" ... />` into the detail page.

### When something goes wrong with the revisions DB

If the PCS Revisions DB hits a schema issue or Notion outage, `logRevision` will throw. By default `mutate()` is **fails-closed** — the caller's mutation is aborted. If you need an emergency bypass for a specific cron/workflow path, pass `strict: false` to that call site. Don't bypass globally; the audit trail is the product.

### The `Password reset required` banner

Wave 7.0.7 Phase 0.1 added this checkbox to every reviewer row. Login intercepts it and forces the user through `/reset-password`. If a reviewer complains they can't log in: check the `Password reset required` field on their row. If it's true, they need to complete the reset flow — their old password will still work exactly once, they'll land on the reset page, set a new password, then log in normally.
