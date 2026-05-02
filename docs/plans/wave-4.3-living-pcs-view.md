# Wave 4.3 — Living PCS View

> **Status:** Planning artifact — no application code.
> **Author:** Claude (planning), Garrett (direction)
> **Date:** 2026-04-21
> **Dependencies:** Wave 4.1 (demographic axis restructure), Wave 3.7 (template classification)
> **Feeds into:** Wave 4.5 (Research Requests activation), Wave 5 (Product Labels)

---

## §1. Problem statement & strategic framing

For the last several years, the PCS document has existed in two incompatible forms simultaneously: a Word/PDF artifact that Lauren and the Research team author and sign, and a partially-ingested Notion record that lags behind, diverges silently, and cannot be queried. Researchers open the PDF to look up a claim. They open Notion to file a request. They never look at both in the same frame. The PDF is the source of truth — and it is inert, unsearchable, and disconnected from everything downstream.

Wave 3 changed that at the data layer: the importer now populates formula lines, claims, evidence packets, revision events, and references directly into Notion. Wave 3.7 adds template classification so the system knows which documents are Lauren-conformant and which are legacy. The data is now there. What is missing is a **view that makes Notion the surface of truth rather than the destination of last resort**.

Wave 4.3 builds that view. It is not a cosmetic improvement to `/pcs/documents/[id]`. It is an architectural flip: the Living PCS View is the page a researcher opens when they want to read, review, or act on a PCS document. The PDF is still the legal signature artifact, but the Living View is the operational surface. This flip has three specific consequences that make it the quiet-star change of the Wave 4 cycle:

**1. Drift detection becomes possible.** The view computes live whether each table section is complete, whether classifier signals are healthy, and whether field confidence meets threshold. These signals are the prerequisite for Wave 5's label drift checks and for Wave 4.5's Research Request queue. Without a rendered, section-aware view, there is no surface to attach "needs backfill" badges to.

**2. AI-assisted editing becomes tractable.** Because every section maps to a specific set of Notion DB records, an inline edit can be scoped: changing a claim in Table 3A means patching one Claims row, not re-importing an entire document. Save-as-new-version semantics (§7) give edits an audit trail that the PDF never had.

**3. Label cross-reference becomes actionable.** Wave 5's side-panel showing which SKU labels back this PCS (and whether any have drifted) can only exist if there is a PCS view to attach a panel to. The Living View provides that anchor.

The PDF-as-truth model made sense when Notion was a lightweight filing system. It does not make sense when Notion holds the authoritative data. Wave 4.3 completes the handoff.

---

## §2. Route + file structure

### Route decision: sibling, not replacement

The existing `/pcs/documents/[id]` page serves as the document metadata admin panel — it edits `fileStatus`, `productStatus`, table B fields, and lists version stubs. That page serves RA administrators doing triage, not researchers reading substantiation. **The Living View ships as a sibling route** at `/pcs/documents/[id]/view`.

Rationale:

- All existing deep links from `/pcs/documents` (the list table at `src/app/pcs/documents/page.js` renders `href={/pcs/documents/${row.id}}`) continue to work. No redirect needed.
- The admin metadata view and the research reading view have different audiences, different data requirements (admin: light; reading: all 10 tables loaded), and different RBAC gates (admin: `pcs` write role; reading: `pcs` or `pcs-readonly`).
- A future redirect from the list view's PCS ID link to `/view` can be added in Wave 4.3 once the view is stable — tracked in §9 as a Phase 4.3.2 task.

### Files to create

| File | Rationale |
|---|---|
| `src/app/pcs/documents/[id]/view/page.js` | Top-level server component (or thin 'use client' shell) for the Living View route. |
| `src/app/pcs/documents/[id]/view/loading.js` | Skeleton loader matching section structure, prevents layout shift during fetch. |
| `src/app/api/pcs/documents/[id]/view/route.js` | Single GET endpoint that assembles all data needed for the view in one fan-out: document + latest version + all related records. Returns a flat `viewPayload` object. |
| `src/components/pcs/living-view/LivingPcsView.js` | Root client component receiving `viewPayload` as prop. Renders section list + sticky header + export button. |
| `src/components/pcs/living-view/PcsCoverSection.js` | Cover page section: title, PCS ID, format badge, demographic summary, approved date, template-version chip. |
| `src/components/pcs/living-view/PcsRevisionTable.js` | Table A: renders revision events as a dated table with dual-approver columns. |
| `src/components/pcs/living-view/PcsApplicableProducts.js` | Table B: finishedGoodName, FMT, SAP material no, SKU chips. |
| `src/components/pcs/living-view/PcsProductDetails.js` | Table 1: product name, format, four-axis demographic (Wave 4.1 integration point). |
| `src/components/pcs/living-view/PcsComposition.js` | Table 2: formula lines as an ingredient table with FM PLM#, AI source, AI form, AI name, amount, %DV. |
| `src/components/pcs/living-view/PcsClaimsSection.js` | Tables 3A / 3B / 3C: renders claim buckets as tabbed or stacked tables. Accepts claims array + bucket filter. |
| `src/components/pcs/living-view/PcsResearchTable.js` | Table 4: evidence packet narrative rows — studyDesignSummary, keyTakeaway, substantiationTier. |
| `src/components/pcs/living-view/PcsSupportingDocs.js` | Table 5: evidence packets with `substantiationTier = 'Table 5 (supporting doc)'`. |
| `src/components/pcs/living-view/PcsNullResults.js` | Table 6: evidence packets with `substantiationTier = 'Table 6 (null result)'` + nullResultRationale. |
| `src/components/pcs/living-view/PcsReferences.js` | References section: references DB rows sorted by pcsReferenceLabel, linked to evidence items. |
| `src/components/pcs/living-view/BackfillBadge.js` | The "Needs backfill" chip component (§4). Used inline in every section. |
| `src/components/pcs/living-view/BackfillSideSheet.js` | Slide-over panel triggered by badge click. Pre-fills Research Request draft form. Wave 4.5 interop point. |
| `src/components/pcs/living-view/LegacyBanner.js` | Banner shown when `templateVersion = 'Legacy pre-Lauren'` (§8). |
| `src/components/pcs/living-view/PdfExportButton.js` | Client component owning export UX and download trigger (§6). |
| `src/components/pcs/living-view/SectionAnchor.js` | Reusable section header with anchor link, section title, badge slot, and optional edit affordance. |

### Files to modify

| File | Change |
|---|---|
| `src/app/pcs/documents/[id]/page.js` | Add "Open Living View" link button pointing to `./view`. No logic changes. |
| `src/app/pcs/documents/page.js` | Add a "View" column to the PcsTable that links to `/pcs/documents/${row.id}/view` alongside the existing PCS ID link. |
| `src/components/pcs/PcsNav.js` | No structural changes. The Living View inherits the PCS layout and nav naturally because it lives inside `src/app/pcs/`. |
| `src/lib/pcs-config.js` | Add `BACKFILL_THRESHOLD = 0.7` constant (used by BackfillBadge confidence check). |

---

## §3. Section-by-section render table

| Lauren Section | Notion source DB(s) | Key fields consumed | Layout | Empty-state copy | Links to Research Request? |
|---|---|---|---|---|---|
| **Cover / Header** | `documents`, `versions` (latest) | `pcsId`, `finishedGoodName`, `format`, `demographic`, `approvedDate`, `templateVersion` | Prose header card with pill badges | — | No |
| **Table A — Revision History** | `revisionEvents` (via version) | `activityType`, `responsibleDept`, `responsibleIndividual`, `startDate`, `endDate`, `fromVersion`, `toVersion`, `approverAlias`, `approverDepartment` | Sortable table (5 columns) | "No revision events recorded for this version." | No |
| **Table B — Applicable Products** | `documents` | `finishedGoodName`, `format`, `sapMaterialNo`, `skus` | 2-column key-value card + SKU chip row | "Product details not yet recorded. [Needs backfill chip]" | No |
| **Table 1 — Product Details** | `versions` (latest) | `productName`, `formatOverride`, `demographic` (multi-axis), `dailyServingSize` | Key-value card grid; demographic rendered as four-axis chips (Wave 4.1) | "Product name and demographic not recorded. [Needs backfill chip]" | No |
| **Table 2 — Product Composition** | `formulaLines` | `fmPlm`, `ingredientSource`, `aiForm`, `ai`, `amountPerServing`, `amountUnit`, `percentDailyValue` | Dense data table (7 columns), sortable by AI name | "No formula lines recorded. Upload a PCS PDF to extract composition data." | No |
| **Table 3A — Authorized Claims** | `claims` | bucket = `3A`, `claimNo`, `claim`, `claimStatus`, `minDoseMg`, `maxDoseMg`, `doseGuidanceNote`, `disclaimerRequired` | Table with status badge column; disclaimer flag icon | "No authorized claims recorded for this version." | Yes — each claim row has a "Request review" button (Wave 4.5) |
| **Table 3B — Unacceptable Claims** | `claims` | bucket = `3B`, same fields as 3A | Table with amber row highlight | "No unacceptable claims recorded." | Yes |
| **Table 3C — Ineligible/NA Claims** | `claims` | bucket = `3C`, same fields | Table with muted row style | "No ineligible/NA claims recorded." | No |
| **Table 4 — Research Summary** | `evidencePackets` + `evidence` (via relation) | `substantiationTier = 'Table 4 (primary study)'`, `studyDesignSummary`, `keyTakeaway`, `sampleSize`, `studyDoseAmount`, `studyDoseUnit`, `meetsSqrThreshold`, `applicabilityRating` (via linked applicability row) | Card-per-packet layout; each card has citation, design summary, takeaway, and tier badge | "No primary study evidence packets linked to claims in this version." | Yes — "Flag for review" per packet |
| **Table 5 — Supporting Documentation** | `evidencePackets` | `substantiationTier = 'Table 5 (supporting doc)'`, same narrative fields | Compact table (citation + relevance note) | "No supporting documentation recorded." | No |
| **Table 6 — Null Results** | `evidencePackets` | `substantiationTier = 'Table 6 (null result)'`, `nullResultRationale` | Compact table with rationale column | "No null results recorded." | No |
| **References** | `references` + `evidence` (via relation) | `pcsReferenceLabel`, `referenceTextAsWritten`, `evidenceItemId` (linked to DOI/PMID) | Numbered list; reference label hyperlinked to evidence detail page when `evidenceItemId` present | "No references recorded for this version." | No |

---

## §4. Inline backfill badges

### What the badge is

`BackfillBadge` is a small pill chip rendered inline within any section heading or field label where data is missing, confidence is below threshold, or the Wave 3.7 classifier has flagged a specific signal as negative. It is never shown on sections that are structurally complete and confident. The user sees it as `Needs backfill` with a variant color.

### Three variants

| Variant | Color | When it renders |
|---|---|---|
| `info` | Blue pill (`bg-blue-50 text-blue-700 border-blue-200`) | Field is null/empty but not required for claim substantiation (e.g. `sapMaterialNo` missing). Non-urgent. |
| `warning` | Amber pill (`bg-amber-50 text-amber-700 border-amber-200`) | Field is missing and is required for a complete Lauren template section (e.g. no formula lines, demographic is single-axis when Lauren requires multi-axis, classifier signal `negative` for this section). |
| `critical` | Red pill (`bg-red-50 text-red-700 border-red-200`) | Missing data blocks claim substantiation correctness (e.g. a 3A claim has no linked evidence packets, or `claimStatus` is `Unknown` on an `Authorized`-bucket claim). |

### Trigger logic (pseudocode, not application code)

```
// Per-section badge evaluation runs in the view's data-assembly layer
// (src/app/api/pcs/documents/[id]/view/route.js), not in the component.
// The API returns a `sectionHealth` map; components only read it.

sectionHealth = {
  tableB: fieldMissing(doc.finishedGoodName) ? 'warning' : null,
  table1: !version.demographic || version.demographic.length < 2 ? 'warning' : null,
  table2: formulaLines.length === 0 ? 'warning'
          : formulaLines.some(l => !l.fmPlm) ? 'info' : null,
  table3A: claims3A.length === 0 ? 'critical'
           : claims3A.some(c => c.claimStatus === 'Unknown') ? 'warning' : null,
  table4: evidencePackets4.length === 0 && claims3A.length > 0 ? 'critical'
          : evidencePackets4.some(p => !p.keyTakeaway) ? 'warning' : null,
  // confidence threshold from classifier
  overall: doc.templateVersion === 'Legacy pre-Lauren' ? 'warning'
           : classifierSignalNegativeCount > 2 ? 'warning' : null,
}
```

Confidence threshold: `0.7` (stored as `BACKFILL_THRESHOLD` in `pcs-config.js`). Any evidence packet extracted with overall confidence below this threshold at import time will render an `info` badge on its Table 4 card regardless of whether fields are populated.

### Click-through behavior

Clicking a badge opens `BackfillSideSheet` (a right-side slide-over, `fixed inset-y-0 right-0 w-96`). The sheet pre-fills a Research Request draft with:

- **Request title:** auto-generated from the section and missing field (e.g. "Backfill: Table 2 FM PLM# for PCS-0137v2.1")
- **Related version:** pre-linked to the current version's Notion page ID
- **Related claims:** pre-linked if the badge is on a claim-specific row
- **Request notes:** a template string describing what is missing and why
- **Status:** `New` (default from `REQUEST_STATUSES`)
- **Requested by:** current auth user

The sheet does not itself write to Notion in Wave 4.3. It presents the pre-filled form and a "Create Request" button that calls `POST /api/pcs/requests` (already implemented). This is the Wave 4.5 interop point — when Wave 4.5 activates the full Research Request workflow, the side sheet gains queue routing, Slack notification, and due-date assignment. The sheet's form shape is stable; Wave 4.5 only adds behavior behind the Create button.

The `BackfillSideSheet` must be implemented as a portal (`createPortal` to `document.body`) to avoid z-index conflicts with the sticky section header and the PCS nav.

---

## §5. Component tree

```
PcsLayout (src/app/pcs/layout.js — unchanged)
  └── /pcs/documents/[id]/view/page.js  (async server component or thin client shell)
        ├── fetches /api/pcs/documents/[id]/view  → viewPayload
        └── LivingPcsView  (client, receives viewPayload)
              ├── LegacyBanner?  (conditional, templateVersion = 'Legacy pre-Lauren')
              ├── sticky page header
              │     ├── PCS ID + product name
              │     ├── TemplateVersionChip  (Lauren v1.0 | partial | Legacy)
              │     ├── PdfExportButton
              │     └── "Edit metadata" link  → /pcs/documents/[id]
              │
              ├── section list (vertical scroll)
              │     ├── SectionAnchor id="cover"
              │     │     └── PcsCoverSection  { doc, version }
              │     ├── SectionAnchor id="table-a"
              │     │     └── PcsRevisionTable  { revisionEvents }
              │     ├── SectionAnchor id="table-b"
              │     │     ├── BackfillBadge? (variant from sectionHealth.tableB)
              │     │     └── PcsApplicableProducts  { doc }
              │     ├── SectionAnchor id="table-1"
              │     │     ├── BackfillBadge? (sectionHealth.table1)
              │     │     └── PcsProductDetails  { version }
              │     ├── SectionAnchor id="table-2"
              │     │     ├── BackfillBadge? (sectionHealth.table2)
              │     │     └── PcsComposition  { formulaLines }
              │     ├── SectionAnchor id="table-3"
              │     │     └── PcsClaimsSection  { claims, sectionHealth }
              │     │           ├── ClaimsBucketTab "3A — Authorized"
              │     │           │     ├── BackfillBadge? (sectionHealth.table3A)
              │     │           │     └── PcsTable  columns=[claimNo, claim, status, minDose, disclaimer]
              │     │           ├── ClaimsBucketTab "3B — Unacceptable"
              │     │           └── ClaimsBucketTab "3C — Ineligible/NA"
              │     ├── SectionAnchor id="table-4"
              │     │     ├── BackfillBadge? (sectionHealth.table4)
              │     │     └── PcsResearchTable  { evidencePackets4 }
              │     ├── SectionAnchor id="table-5"
              │     │     └── PcsSupportingDocs  { evidencePackets5 }
              │     ├── SectionAnchor id="table-6"
              │     │     └── PcsNullResults  { evidencePackets6 }
              │     └── SectionAnchor id="references"
              │           └── PcsReferences  { references }
              │
              └── BackfillSideSheet  (portal, conditionally visible)
```

**Reuse of existing components:**

- `PcsTable` (`src/components/pcs/PcsTable.js`) is reused for Tables 3A/3B/3C and Table A revision events. It already supports sortable columns and inline editing, which is the foundation for the §7 editing affordance.
- `CommentThread` (`src/components/pcs/CommentThread.js`) can be composed into `SectionAnchor` as a collapsible thread on any section, passing the version's Notion page ID as `pageId`.
- `useAuth` gates the "Create Request" button inside `BackfillSideSheet` — Research role check matches the existing `hasPcsWriteAccess` pattern from `PcsNav.js`.

**Component conventions to match:**

- All components under `src/components/pcs/living-view/` are `'use client'` because they receive data via props from a server-component data fetch (not because they need state individually — many are pure display).
- Use `pacific-600` / `pacific-50` Tailwind color tokens (already established across the PCS UI) for links, active states, and bucket highlights.
- `bg-gray-50 rounded-lg p-4` card pattern for sections (already established in `[id]/page.js`).
- Skeleton loader uses `animate-pulse` gray divs (pattern from `[id]/page.js` line 80).

---

## §6. PDF export architecture

### Button UX

A `PdfExportButton` in the sticky page header shows `Export as PDF (Lauren template)`. On click it shows an in-button spinner while the generation runs. On completion it triggers a browser download. Error state renders a toast using the existing `ToastProvider`.

### Filename format

`PCS-{pcsId}_{fmt}_{version}_{YYYY-MM-DD}.pdf`

Example: `PCS-0137_Softgel_v2.1_2026-04-21.pdf`

All tokens are available in `viewPayload`. `fmt` comes from `doc.format` (the `FORMATS` enum); spaces are replaced with hyphens in the filename.

### Technology trade-off

| Approach | Fidelity to Lauren template | Vercel timeout risk | Bundle / cold-start cost | Maintenance burden | Recommendation |
|---|---|---|---|---|---|
| **`docx` (already in use) → browser PDF print** | Moderate — Word rendering in browser varies; headers/page breaks unreliable | None (runs in browser) | Zero (no new dependency) | Low | **Chosen approach** |
| `react-pdf` (`@react-pdf/renderer`) | Good for PDFs designed as PDFs | Low (runs server-side or browser) | ~1.8 MB bundle add, slow cold start, no CSS support | High (separate layout system) | Rejected |
| Puppeteer | Pixel-perfect | High — Chromium binary ~170 MB, 300s Vercel function limit is real risk for complex pages | Very high (binary size, memory) | Very high | Rejected |
| Playwright | Same as Puppeteer | Same problem | Same problem | Same problem | Rejected |
| `docx` server-side → LibreOffice → PDF | Highest fidelity to Word template | Very high (LibreOffice not available on Vercel) | Not viable on Vercel | — | Rejected |

**Chosen: extend the existing `docx` pipeline with a browser-side print-to-PDF flow.**

Rationale: `src/lib/pcs-docx.js` and `src/app/api/pcs/export/docx/route.js` already generate `.docx` files using the `docx` npm package. Wave 4.3 adds a new export type to that endpoint (`type=lauren-template`) that renders all 10 Lauren tables into a structured `.docx` document. The `PdfExportButton` component then offers two options:

1. **Download as Word (.docx)** — uses the existing endpoint extended with the new type. Immediately downloadable, pixel-closest to Lauren's actual template.
2. **Print / Save as PDF** — opens the generated `.docx` via a blob URL in a new tab and instructs the user to `File → Print → Save as PDF`. Not elegant, but zero timeout risk and no new infrastructure.

A future wave can revisit `react-pdf` if the team decides pixel-perfect PDF is required for regulatory submissions. For now, Word-native is the right call: Lauren herself authors in Word and the team's existing review flow is Word-based.

The new `docx` export type uses the same `BRAND` color constants already in `pcs-docx.js` and the same `Table`, `TableRow`, `TableCell` primitives. It maps directly to the 10-table structure in §3, using `HeadingLevel.HEADING_2` for section titles and `HeadingLevel.HEADING_3` for table labels — matching the existing `generateFullReport` pattern.

**Route addition:** `GET /api/pcs/export/docx?type=lauren-template&documentId={id}` — returns `Content-Disposition: attachment; filename=PCS-{id}_{fmt}_{version}_{date}.docx`.

---

## §7. Editing affordance (stretch — not in v1)

This section describes the intended design so that data model decisions made now do not foreclose it later.

### Who can edit

Only users with the `pcs` write role (i.e., Research team members: Sharon, Gina, Adin, Lauren). The `canWrite` pattern from `[id]/page.js` line 24 applies: `user?.roles?.includes('pcs') || user?.isAdmin`. Users with `pcs-readonly` see the view but no edit affordances.

### Semantics: save as new version

Editing a field in the Living View does not overwrite the existing version record in place. Instead it triggers a "save as new version" flow:

1. User clicks the edit icon on a section (e.g., clicks a claim text to edit it).
2. An inline editor opens (contenteditable or input replacing the display value).
3. When user confirms the change, a modal prompts: "This will create a new version of this PCS document. Add a version note:" with a text field pre-filled with `"Inline edit: [section name] updated by [user]"`.
4. On confirm: the API creates a new Version row (cloning all relations from the current version), applies the edited field to the new version, sets `isLatest = true` on the new version, and unsets it on the old.
5. The view refreshes to show the new version.

This is the same semantics as a full re-import but scoped to a single field. The revision events table is not automatically updated — the user is prompted to optionally add a revision event row before saving.

### Out of scope for v1

- Bulk operations (editing multiple claims in one transaction)
- Claim approval workflow (marking a proposed claim as authorized requires separate RA sign-off — this is a Wave 4.5 concern)
- Formula line additions (adding a new ingredient row — complex because it requires a new FormulaLines DB row, not just a field update)
- Any AI-assisted suggestion during editing

The editing affordance in v1 is limited to: free-text field updates on existing records (claim text, demographic, document notes, version notes). Table B fields (`finishedGoodName`, `format`, `sapMaterialNo`, `skus`) are editable inline because they map to simple PATCH calls on `documents/{id}` — already implemented.

---

## §8. Graceful degradation for Legacy pre-Lauren documents

When `doc.templateVersion === 'Legacy pre-Lauren'` (as set by the Wave 3.7 classifier), the view does not attempt to render missing sections as if they were empty — it renders a partial view with a prominent banner explaining why sections are incomplete.

### Banner: LegacyBanner

Rendered at the top of `LivingPcsView`, immediately below the sticky header and above all sections:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Legacy document — pre-Lauren template                                   │
│                                                                          │
│  This PCS was authored before Lauren Bozzio's 10-table template was      │
│  standardized. Some sections may be empty or partially populated.        │
│  Tables 1, 2, 3A, and 4 may require backfill before claim               │
│  substantiation can be verified.                                         │
│                                                                          │
│  Classifier signals: [positive: 1] [negative: 5]    [Request re-issue]  │
└──────────────────────────────────────────────────────────────────────────┘
```

Color: `bg-amber-50 border border-amber-200`. The "Request re-issue" button opens the `BackfillSideSheet` pre-filled with a special "Template re-issue" request type (creates a Research Request with a standard note: "This document predates the Lauren template. A re-issue scan is needed to populate missing sections.").

### Section behavior for Legacy documents

- Sections with data render normally (e.g., a legacy doc may have claims in Table 3A but no FM PLM# in Table 2).
- Sections that are entirely empty render their empty-state copy plus a `warning` BackfillBadge — not a blank white box, and not a JavaScript error.
- Tables 4/5/6 specifically: if `evidencePackets` is empty for a Legacy doc, the section renders: `"Evidence packets were not captured in the original PCS. Run a re-issue scan to extract Table 4 content."` This copy distinguishes "no evidence" from "evidence not yet imported" — an important distinction for the Research team's triage.
- The PDF export button is still available for Legacy docs but adds the text `(partial — legacy)` to the button label and includes a disclaimer line at the top of the generated docx.

### What never happens

The view never throws a JavaScript error because a section's data is null. Every section component accepts an empty array as a valid prop value and renders its empty state cleanly. The `sectionHealth` map is computed defensively in the API route — any null/undefined in the Notion response maps to a `warning` badge, never to an unhandled exception.

---

## §9. Rollout plan

### Feature flag vs. hard cut

Ship behind a **URL-only soft flag** rather than an environment variable feature flag. The view is at `/pcs/documents/[id]/view` — it is only discoverable if you know the URL or if the list/detail pages link to it. No `NEXT_PUBLIC_FEATURE_LIVING_VIEW` flag is needed. When the view is stable, adding the "Open Living View" link button to `[id]/page.js` and the "View" column to `documents/page.js` is the rollout gate.

This avoids the cognitive overhead of a feature flag in a small-team codebase where the main user is Garrett + the Research team. If the view breaks in production, it only affects users who navigate to `/view` directly — the existing admin detail page is untouched.

### Phased sections: which tables ship first

| Phase | Sections | Gating criterion |
|---|---|---|
| **4.3.0 — Skeleton + Cover + Table B** | Sticky header, LegacyBanner, Cover section, Table B (Applicable Products). No backfill badges yet. | View loads for any PCS document without errors. Internal review only. |
| **4.3.1 — Tables A, 1, 2** | Revision history, Product Details, Composition. BackfillBadge ships here. `sectionHealth` API endpoint ships. | Three Lauren-conformant PCS documents render all three tables correctly. |
| **4.3.2 — Tables 3A/3B/3C + Research Request stub** | Claims tables with bucket tabs. BackfillSideSheet ships (form only — no Wave 4.5 routing yet). | Research team (Sharon/Lauren) can use the view to review claims for one product without opening Notion. |
| **4.3.3 — Tables 4/5/6 + References** | Evidence packet narrative cards. References numbered list. | All 10 Lauren sections render for at least one fully-imported PCS. |
| **4.3.4 — Export + list-view link** | PDF/docx export button. "View" column added to documents list. "Open Living View" link on detail page. | Export generates a valid .docx for a Lauren-conformant PCS. Redirect `/pcs/documents/{id}` links from list table to `/view` for Research team members (admin members keep the existing metadata view as default). |

### Migration of existing link destinations

- **`/pcs/documents` list table:** Currently links `pcsId` to `/pcs/documents/${row.id}`. In Phase 4.3.4 add a second "View" column that links to `/view`. The existing PCS ID link remains so RA admins can still reach the metadata panel directly.
- **`/pcs/claims/[id]` page:** Already shows a linked PCS version. Add a "View full PCS" link to `/pcs/documents/{docId}/view` in Phase 4.3.3.
- **`/pcs/evidence/[id]` page:** Add a "Used in PCS documents" section showing linked document names with `/view` links. Future phase.
- **`/pcs` Command Center:** The existing document count card can link to the first document in the list. No change needed in Wave 4.3.

---

## §10. Cross-wave interop

### Wave 3.7 (template classification) → Wave 4.3

The `templateVersion` and `templateSignals` fields on PCS Documents (set by `classifyTemplate()` in `src/lib/pcs-template-classifier.js`) drive:

- The `TemplateVersionChip` in the cover section (renders `Lauren v1.0`, `Lauren v1.0 partial`, or `Legacy pre-Lauren` with appropriate colors).
- The `LegacyBanner` (§8) visibility condition.
- The `sectionHealth` computation in the view API route — classifier's `negativeCount` feeds directly into which sections get `warning` badges.
- The "Request re-issue" path in `BackfillSideSheet`.

No new classifier calls are made at view-render time. The classifier runs at import/commit time (Wave 3.7) and its output is stored on the Document row. The view reads that stored output.

### Wave 4.1 (demographic axis restructure) → Wave 4.3

Wave 4.1 restructures `versions.demographic` from a flat multi-select into four independent axis properties (Biological Sex, Age Group, Life Stage, Lifestyle). `PcsProductDetails` (Table 1) must render whichever model is live at the time of Wave 4.3 shipping.

**Design-time decision:** implement `PcsProductDetails` to check whether the four-axis properties exist on the version payload. If yes, render four labeled chips. If not (because Wave 4.1 has not yet shipped), fall back to rendering the flat `demographic` multi-select. This makes Wave 4.3 shippable independently of Wave 4.1 sequencing.

The four-axis property keys should be named in `PROPS.versions` (in `pcs-config.js`) once Wave 4.1 defines them — add them there and import in `PcsProductDetails`. Do not hardcode string property names in the component.

### Wave 4.3 → Wave 4.5 (Research Requests activation)

The `BackfillSideSheet` is the primary interop point. In Wave 4.3 it calls `POST /api/pcs/requests` directly (already implemented route). In Wave 4.5, the Request lifecycle gains:

- Slack routing (`#pcs-requests` channel) when a new request is filed.
- RA due-date assignment logic based on request type.
- Status webhook back into the system.

None of these require changes to `BackfillSideSheet`'s form or API call. Wave 4.5 adds behavior inside the existing route handler. The shape of the request payload from the side sheet must match `PROPS.requests` exactly — verify against the existing `POST /api/pcs/requests` handler when implementing.

### Wave 4.3 → Wave 5 (Product Labels sidebar)

Wave 5 adds a `Product Labels` DB and introduces label-to-PCS relations. The Living View gains a collapsible "Related Labels" panel in its sidebar in Wave 5. This panel is not part of Wave 4.3 but the view's layout must accommodate it. Specifically:

- The main content column should be `max-w-4xl` (not full-width), leaving room for a future `w-72` right panel.
- The sticky header should include a placeholder slot for "Labels ({n})" that renders `null` in Wave 4.3 and populates in Wave 5.
- The `viewPayload` API endpoint should accept an optional `?include=labels` query param (returns empty array in Wave 4.3) so Wave 5 can extend the payload without a breaking API change.

The Wave 5 plan (`docs/plans/wave-5-product-labels.md`, §10) notes that "Wave 4.3 Living PCS view benefits from Wave 5 because the Living PCS view gains a 'Related Labels' sidebar." That sidebar slot is the forward-compatible hook.

---

## §11. Open questions for the user

1. **Version selector in the view.** The Living View currently shows the **latest version** only. Should it include a version picker in the header that lets the user navigate to any prior version? If yes, what is the UX — a dropdown in the sticky header or a separate versions timeline panel? The API endpoint can accept `?versionId=` to serve any version, but the picker adds component complexity.

2. **Section ordering vs. Lauren's exact table order.** Lauren's Word template has a rigid section order (Cover → A → B → 1 → 2 → 3A → 3B → 3C → 4 → 5 → 6 → References). The Living View follows this order. Should there also be a sidebar table-of-contents with anchor links to jump to a section? (The `SectionAnchor` component already generates anchors — this is a question about whether a sticky TOC sidebar ships in Wave 4.3 or deferred.)

3. **Demographic rendering in Table 1 before Wave 4.1.** The flat `demographic` multi-select currently holds values like `"Adults (19-50y)"` from the `DEMOGRAPHICS` constant. Wave 4.1 will restructure this into four axes. Can Wave 4.3 ship with the flat rendering and upgrade in-place when Wave 4.1 ships, or should Wave 4.3 wait for Wave 4.1 to avoid a visible UI change mid-rollout?

4. **`pcs-readonly` role and the view.** The PCS layout gates on `['pcs', 'pcs-readonly', 'admin']` (layout.js line 15). The `pcs-readonly` role can read but not write. Should readonly users see the `BackfillBadge` chips and the side sheet form (read-only, no "Create Request" button visible), or should the badges be hidden entirely from readonly users to reduce noise?

5. **Export as .docx vs. browser print-to-PDF.** The chosen approach (§6) generates a `.docx` and asks users who want a PDF to print it. Lauren likely prefers to receive a `.docx` anyway since her review flow is Word-native. But confirm: is there a use case where a true PDF (not print-to-PDF) is required — e.g., for regulatory submission or archival? If yes, how frequently, and does it justify the complexity of a server-side PDF pipeline?

6. **BackfillSideSheet — Research Request vs. comment.** The current design pre-fills a Research Request. An alternative is to pre-fill a Comment Thread comment (the existing `CommentThread` component) so that backfill notes stay at the section level without creating formal requests. Which is the right escalation level for `info`-variant badges vs. `critical`-variant badges? Propose: `info` → comment, `warning`/`critical` → Research Request.

7. **Wave 4.3 as the new default link from the document list.** Phase 4.3.4 adds a "View" column but keeps the PCS ID link pointing to the metadata admin page. Long-term, should the PCS ID in the list become the primary link to `/view` (with an "Edit metadata" link on the view page for admins)? This is a navigation philosophy question — "document list as Research tool" vs. "document list as Admin tool."

8. **Evidence packet confidence badges.** The importer assigns per-field confidence scores but these are not currently stored as structured data — they are consumed at commit time and discarded. Should Wave 4.3 surface confidence on Table 4 cards (e.g., a small `confidence: 0.74` note below a `keyTakeaway` that was extracted with low confidence)? This requires either storing confidence scores in the EvidencePackets DB or re-running the classifier on demand, both of which are non-trivial.

9. **Null results in Table 6 vs. Table 4 negative results.** `evidencePackets` has both a `substantiationTier` field (which routes packets to Tables 4/5/6) and a `negativeResults` text field on packets that land in Table 4. Currently these are separate concepts: a null result (Table 6) is a study with no positive finding; a negative result field on a Table 4 packet describes negative findings within an otherwise-supporting study. Confirm Lauren's intent: should Table 6 show only pure null-result packets (tier = "Table 6"), or should it also show Table 4 packets where `negativeResults` is non-empty?

10. **Link between Table 3A claims and their Table 4 evidence.** Lauren's template implies a row-by-row correspondence: each Table 4 row exists to substantiate a specific Table 3A claim. The `evidencePackets` DB already stores `pcsClaimId` for this linkage. Should the Living View render Table 4 as grouped-by-claim (one collapsible claim header, evidence cards underneath) or as a flat list sorted by `sortOrder`? Grouped makes the substantiation logic readable at a glance; flat is simpler. Lauren's Word template uses a flat list — start flat, add grouping in a later iteration?

---

*End of plan.*
