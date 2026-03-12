# PCS PDF → Notion Database Import Process

> Last updated: Mar 10, 2026
>
> This document defines a repeatable process for extracting structured data from PCS (Product Claim Substantiation) PDF documents and entering it into the PCS Notion databases. It includes Notion AI prompt templates, property mappings, and a validation checklist.

---

## Overview

Each PCS PDF is a regulatory document for a dietary supplement product. A single PDF fans out across **up to 8 Notion databases** with strict dependency ordering:

```
PCS Documents          ← product-level record (PCS-0126)
  └→ PCS Versions      ← version-specific snapshot (v2.1)
       ├→ Formula Lines       ← ingredients with amounts
       ├→ PCS Claims          ← health claims (3A/3B/3C)
       ├→ PCS References      ← bibliography entries
       ├→ Revision Events     ← change history
       └→ Evidence Packets    ← claim ↔ evidence links (created later)
            └→ Evidence Library  ← studies/sources (matched or created later)
```

**Critical rule:** Create parent records before children. The PCS Document must exist before the Version, and the Version must exist before Claims, Formula Lines, etc. can link to it.

---

## Phase-by-Phase Process

### Before You Start

1. Open the PCS PDF and skim to identify which sections are present
2. Check if this PCS Document already exists in Notion (search PCS Documents by PCS ID)
3. If it exists, check if the version you're importing already exists in PCS Versions
4. Decide which phases to run — not every PDF has all sections

### Phase 1 — Document & Version

**What to create:** 1 row in PCS Documents (if new) + 1 row in PCS Versions

**Attach the PDF** to a scratch page or the PCS Document page itself, then prompt Notion AI:

```
Read the attached PCS PDF. Extract the following and create entries in the Notion databases:

1. PCS Documents database — create ONE entry:
   • PCS ID: the document number (e.g., "PCS-0126")
   • Classification: one of [A, B, C, NA, Unknown]
   • File status: one of [Static, Under revision, Unknown]
   • Product status: one of [On-market, In development, Retired, Unknown]

2. PCS Versions database — create ONE entry:
   • Version: the version label (e.g., "v2.1" or "PCS-0126 v2.1")
   • Effective date: the effective/approved date from the cover page
   • PCS Document: link to the PCS Documents entry you just created
   • Is latest: check this box (we'll uncheck the prior version manually if needed)

If you can't determine a Classification or status value from the PDF, use "Unknown".
```

**Property reference:**

| Database | Property | Type | Allowed Values |
|----------|----------|------|---------------|
| PCS Documents | `PCS ID` | title | e.g., "PCS-0126" |
| PCS Documents | `Classification` | select | A, B, C, NA, Unknown |
| PCS Documents | `File status` | select | Static, Under revision, Unknown |
| PCS Documents | `Product status` | select | On-market, In development, Retired, Unknown |
| PCS Versions | `Version` | title | e.g., "v2.1" or "PCS-0126 v2.1" |
| PCS Versions | `Effective date` | date | YYYY-MM-DD |
| PCS Versions | `PCS Document` | relation → PCS Documents | link to parent doc |
| PCS Versions | `Is latest` | checkbox | true (for newly imported version) |

---

### Phase 2 — Formula / Supplement Facts

**What to create:** N rows in Formula Lines (one per ingredient line)

```
Read the Supplement Facts / Formula section of the attached PCS PDF. For each ingredient line, create an entry in the Formula Lines database:

   • Ingredient / AI form: the full ingredient name as written (e.g., "Magnesium bisglycinate chelate")
   • Elemental AI: match to one of [Magnesium, Omega-3 (EPA), Omega-3 (DHA), Vitamin D, Vitamin C, Zinc, Probiotics, CoQ10, Curcumin, Other]
   • Elemental amount (mg): the elemental amount in mg per serving
   • Ingredient source: the source description if listed (e.g., "synthetically produced (TRAACS®)")
   • Serving basis note: any note about serving size basis (e.g., "per 2 softgels")
   • PCS Version: link to [VERSION NAME HERE]

Rules:
- One row per ingredient line in the Supplement Facts table
- If the ingredient doesn't match any Elemental AI option exactly, use "Other"
- Convert units to mg if given in mcg, IU, or other units (note the conversion in Ratio note)
- If a ratio or conversion is needed, record it in the Ratio note field
```

**Property reference:**

| Property | Type | Allowed Values |
|----------|------|---------------|
| `Ingredient / AI form` | title | full ingredient name as written |
| `Elemental AI` | select | Magnesium, Omega-3 (EPA), Omega-3 (DHA), Vitamin D, Vitamin C, Zinc, Probiotics, CoQ10, Curcumin, Other |
| `Elemental amount (mg)` | number | numeric mg value |
| `Ingredient source` | text | source description |
| `Serving basis note` | text | serving size context |
| `Ratio note` | text | conversion notes |
| `Formula notes` | text | any additional notes |
| `PCS Version` | relation → PCS Versions | link to the version |

---

### Phase 3 — Claims

**What to create:** N rows in PCS Claims (one per claim)

```
Read the Claims sections (typically Sections 3A, 3B, 3C) of the attached PCS PDF. For each claim, create an entry in the PCS Claims database:

   • Claim: the claim text (short label or full claim wording)
   • Claim No: the claim number as written in the PDF (e.g., "1", "2a", "A-3")
   • Claim bucket: based on which section the claim appears in:
     - Section 3A claims → "3A (Approved/Applicable)"
     - Section 3B claims → "3B (Unacceptable)"
     - Section 3C claims → "3C (Ineligible/NA)"
     - Other → "Other"
   • Claim status: one of [Authorized, Proposed, Not approved, NA, Unknown]
     - 3A approved claims → "Authorized"
     - 3B claims → "Not approved"
     - 3C claims → "NA"
     - If unclear → "Unknown"
   • Disclaimer required: check if a disclaimer or qualifier is noted for this claim
   • Dose guidance note: any dose-specific language (e.g., "at 500 mg/day EPA+DHA")
   • Min dose mg / Max dose mg: numeric dose values if specified
   • Claim notes: any additional context from the PDF
   • PCS Version: link to [VERSION NAME HERE]

Rules:
- Create one row per distinct claim, even if the same claim appears in multiple sections
- Claim bucket values must match EXACTLY: "3A (Approved/Applicable)", "3B (Unacceptable)", "3C (Ineligible/NA)", or "Other"
- If dose values are given as a range, put the lower in Min dose mg and upper in Max dose mg
```

**Property reference:**

| Property | Type | Allowed Values |
|----------|------|---------------|
| `Claim` | title | claim text |
| `Claim No` | text | as written in PDF |
| `Claim bucket` | select | 3A (Approved/Applicable), 3B (Unacceptable), 3C (Ineligible/NA), Other |
| `Claim status` | select | Authorized, Proposed, Not approved, NA, Unknown |
| `Disclaimer required` | checkbox | true/false |
| `Dose guidance note` | text | dose context |
| `Min dose mg` | number | lower bound |
| `Max dose mg` | number | upper bound |
| `Claim notes` | text | additional context |
| `PCS Version` | relation → PCS Versions | link to the version |

---

### Phase 4 — References / Bibliography

**What to create:** N rows in PCS References (one per bibliography entry)

```
Read the References / Bibliography section of the attached PCS PDF. For each reference entry, create a row in the PCS References database:

   • PCS reference label: the reference number/label as written (e.g., "12", "[12]", "A-3")
   • Reference text (as written): the full reference text exactly as it appears in the PDF
   • PCS Version: link to [VERSION NAME HERE]

Do NOT try to link the Evidence Item relation yet — that will be done in a later step.

Rules:
- One row per numbered reference in the bibliography
- Preserve the original text exactly — do not reformat citations
- If a DOI or PMID is visible in the reference text, note it in Reference notes
```

**Property reference:**

| Property | Type | Notes |
|----------|------|-------|
| `PCS reference label` | text | reference number as written |
| `Reference text (as written)` | text | full citation, verbatim |
| `Reference notes` | text | any DOIs/PMIDs spotted |
| `PCS Version` | relation → PCS Versions | link to the version |
| `Evidence Item` | relation → Evidence Library | **leave empty** — filled later |

---

### Phase 5 — Revision History (if present)

**What to create:** N rows in PCS Revision Events

```
Read the Revision History / Change Log section of the attached PCS PDF. For each revision event, create a row in the PCS Revision Events database:

   • Event: a short description of the revision (e.g., "Initial filing", "Updated claims for EPA")
   • Activity type: one of [File creation (FC), File modification (FM), Review & approve, Evaluate / revise substantiation, Other]
   • Start date: the date of the revision
   • Responsible dept: one of [RES, RA, Other] (if identifiable)
   • From version: the prior version label (e.g., "v1.0") if applicable
   • To version: the resulting version label (e.g., "v2.1") if applicable
   • Event notes: any additional context
   • PCS Version: link to [VERSION NAME HERE]

Rules:
- Activity type values must match EXACTLY as listed above
- If the revision history shows "initial creation" or "first version", use "File creation (FC)"
- If no responsible department is clear, use "Other"
```

**Property reference:**

| Property | Type | Allowed Values |
|----------|------|---------------|
| `Event` | title | short description |
| `Activity type` | select | File creation (FC), File modification (FM), Review & approve, Evaluate / revise substantiation, Other |
| `Start date` | date | YYYY-MM-DD |
| `End date` | date | YYYY-MM-DD (optional) |
| `Responsible dept` | select | RES, RA, Other |
| `Responsible individual` | person | (skip unless clearly identifiable) |
| `From version` | text | prior version label |
| `To version` | text | resulting version label |
| `Event notes` | text | additional context |
| `PCS Version` | relation → PCS Versions | link to the version |
| `Attachments` | file | (can attach the PDF here too) |

---

### Phase 6 — Evidence Library + Evidence Packets (deferred)

This phase matches PCS References to Evidence Library entries and creates the claim ↔ evidence linkages. It's more complex and should be done **after** the references are imported:

1. **Match references to Evidence Library entries** — search by DOI, PMID, or title
2. **Create new Evidence Library entries** for any references that don't already exist
3. **Create Evidence Packets** — join records linking each PCS Claim to its supporting Evidence Library items
4. **Set the Evidence Item relation** on each PCS Reference

This phase can be automated via the SQR-RCT sync tools or done manually per-reference.

---

## Validation Checklist

After importing a PCS PDF, verify:

- [ ] **PCS Document** entry exists with correct PCS ID
- [ ] **PCS Version** entry exists, linked to the Document, with correct effective date
- [ ] **Formula Lines** count matches the Supplement Facts table in the PDF
- [ ] **Claims** count matches total claims across 3A + 3B + 3C sections
- [ ] Each claim has the correct **Claim bucket** (3A/3B/3C)
- [ ] **Claim status** values are consistent with their bucket (3A → Authorized, etc.)
- [ ] **PCS References** count matches the bibliography length
- [ ] **Revision Events** cover the change history (if present in the PDF)
- [ ] All child records link to the correct **PCS Version** via the relation property
- [ ] **PDF attached** to the PCS Version page and/or Evidence Library entries as appropriate
- [ ] Select/multi-select values match the allowed options **exactly** (case-sensitive)

### Common Mistakes

| Mistake | How to Catch |
|---------|-------------|
| Wrong Claim bucket value | Check that "3A (Approved/Applicable)" is spelled exactly — not "3A" or "Approved" |
| Missing PCS Version relation | Sort child databases by PCS Version; blank = broken link |
| Duplicate claims | Same claim text appearing twice — merge or check if intentional (e.g., different products) |
| Unit conversion errors | Spot-check 2-3 Formula Lines against the original PDF values |
| Mangled citation text | Compare first and last reference against the PDF — should be verbatim |

---

## Tips for Notion AI Prompts

1. **One phase per prompt.** Don't ask Notion AI to do all 5 phases in one shot — it loses accuracy on long multi-step tasks.
2. **Replace `[VERSION NAME HERE]`** in each prompt with the actual version entry name before running.
3. **Spot-check select values** immediately after each phase. Notion AI sometimes invents option names that don't match the allowed list.
4. **Use the PDF attachment** on the same page you're prompting from — Notion AI reads attached files on the current page.
5. **For large reference lists (30+)**, split into batches — prompt for references 1-15, then 16-30, etc.
6. **Lock completed views** in the Command Center to prevent accidental edits after import.

---

## Database Quick Reference

| Database | ID | Title Property | Key Relations |
|----------|----|---------------|---------------|
| PCS Documents | `44020402bbbc445d830c806d114e6d99` | `PCS ID` | → PCS Versions (via `Latest Version`) |
| PCS Versions | `cb5ced32-adfc-446b-9440-68ea91b76406` (data source) | `Version` | → PCS Documents, → Claims, → Formula Lines, → References, → Revision Events |
| Formula Lines | `b252bea7-be7c-41ff-917c-937884016659` (data source) | `Ingredient / AI form` | → PCS Version |
| PCS Claims | `661ffecdc3f14b68b216d068df38fa18` | `Claim` | → PCS Version, → Evidence Packets, → Canonical Claim |
| PCS References | `690afa1d-7c68-413b-8503-38e7df327844` (data source) | `Name` | → PCS Version, → Evidence Item |
| PCS Revision Events | `f5a409445f15435bbd9ea4ff7889d7a5` | `Event` | → PCS Version |
| Evidence Library | `5835efb6733644b4afd69fc49daaa6cb` | `Name` | ← PCS References, ← Evidence Packets |
| Evidence Packets | `5a528e36a1ec469fbbfc0b669756124d` | `Name` | → PCS Claim, → Evidence Item |

---

## Bulk Migration Notes (100+ PDFs)

For the initial migration of the existing PCS PDF backlog, a separate automated pipeline will be built (Phase 3 of the rollout). That pipeline will:

1. Read PDFs from a storage bucket (R2 or Vercel Blob)
2. Use Claude API to extract structured data from each PDF
3. Validate extracted data against the database schemas
4. Write entries to Notion databases via the API
5. Generate a diff report for human review before committing

The manual Notion AI process documented above is for **ongoing use** — when 1-5 new PCS PDFs arrive per month. The bulk pipeline is a one-time migration tool.
