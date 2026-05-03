# Bundle 4 — Form-Driven PCS Claim Entry (Operator Runbook)

> **Audience:** Lauren Bosio (Research) and any RA team member adding new claims to a PCS doc.
> **Prereq:** You're signed in as a role with `pcs.claims:create` capability (researcher / ra / admin / super-user).
> **Status:** Bundle 4 P1 + P2 live. P3 (AI master import from Smartsheet) requires Lauren's CSV — covered separately.

---

## When to use this

Use the form-driven entry path **whenever you're starting a new claim from scratch** rather than uploading a legacy `.docx`. The form enforces Lauren's controlled vocabulary (active ingredient, AI form, demographics, benefit category, grade) so claims are consistent across the corpus.

Legacy `.docx` upload still works for in-flight documents — see `wave-8-living-pcs.md` for that path. The two paths coexist; full deprecation of upload is on the 2027 roadmap.

---

## Steps

1. Navigate to the PCS document you're adding a claim to (e.g. `nordic.windedvertigo.com/pcs/documents/<id>`).
2. Click **+ New claim** in the Claims section header. You'll land on `/pcs/claims/new?documentId=<id>`.
3. Fill the form, top to bottom:
   - **Active ingredient** — dropdown sourced from `cv_active_ingredients`. *Empty until Phase 4.3 lands Lauren's CSV import.* In the meantime, leave blank or use a placeholder; the form won't block submit.
   - **AI form** — depends on AI selection (e.g. cholecalciferol for vitamin D3).
   - **Demographics** — age range + sex + life stage + lifestyle/diet, all controlled-vocab.
   - **Benefit category** — 17-item dropdown (Bones · Muscles · Joints, Brain · Cognition, etc.).
   - **Claim grade** — A / B / C per Lauren's rubric.
   - **Min dose** + **unit** (mcg / mg / IU / %DV).
   - **Claim text** — free-text, the actual claim sentence.
4. (Optional) **Reference an AICS doc** — if this claim derives from an existing AICS substantiation (e.g. AICS-0004 Vit D3), pick the AICS version from the picker. The claim will inherit the AICS's grade + safety limit by reference.
5. Click **Submit**. The form posts to `/api/pcs/claims/from-form`, which composes the structured claim record and writes it to Notion.
6. You're redirected back to the PCS doc. The new claim appears in the Claims section.

---

## What the form prevents (vs. free-text upload)

- **Typos in benefit names.** "Bones · Muscles · Joints" is one canonical option, not 14 spellings.
- **Mismatched dose units.** mcg vs μg vs micrograms — controlled to one canonical form.
- **Orphaned AI references.** You can only pick AIs that exist in `cv_active_ingredients`. (Once the master is imported.)
- **Grade drift.** Only A/B/C are accepted; no "B+" or "B-".

---

## What the form does NOT yet do

- **AI master is empty.** Until Phase 4.3 imports Lauren's Smartsheet "AI Details for Qualified Raw Materials" CSV, the AI dropdown is empty. Operator workaround: leave the AI field blank, fill `claim_text` with the AI name inline, and Lauren / Garrett will backfill the relation after the import.
- **Smartsheet API integration.** Phase 4.4 (deferred to Budget B retainer) swaps the CSV scaffold for a live Smartsheet API pull. Until then, the import is manual.
- **Three-perspective views.** The by-AI / by-benefit dashboards (Bundle 6 in roadmap) are not in the 2026 platform build; they live in the retainer R&D track.

---

## Troubleshooting

- **"AI dropdown is empty"** — expected until Phase 4.3 import runs. See `scripts/import-active-ingredients.mjs`.
- **"Submit returns 403"** — your role lacks `pcs.claims:create`. Reviewers (external) don't have this capability by design. Confirm with Garrett if you should.
- **"Submit returns 500"** — most likely the Notion API timed out. Retry after 30s. If it fails twice, escalate to Garrett with the request ID from the error toast.

---

## Related

- `wave-8-living-pcs.md` — legacy upload path
- `aics-onboarding.md` — AICS docs as upstream substantiation
- `db/migrations/003_aics_entity_ddl.sql` — controlled-vocab schema
- `src/app/pcs/claims/new/page.js` — form source
