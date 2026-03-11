# PCS Database View Specs — Complete Inventory

> Updated Mar 10, 2026. All property names verified against live Notion schemas.
>
> This document lists **every view** across all 6 PCS databases — both existing views (✅) and actions to take (numbered). Use it as the single reference for what should exist and how each view should be configured.
>
> **Legend:** ✅ = already exists · **Action #** = needs to be created or fixed
>
> **How to add a linked view in the Command Center:** Click below the yellow callout, type `/linked`, select "Linked view of database," pick the named database, then configure per the spec below. After adding, delete the yellow callout.
>
> **How to add a source-level view:** Navigate to the database, click `+` next to the existing view tabs, configure per spec.

---

## 1. PCS Requests

**Properties:** `Request` (title), `PCS Version` (relation), `Status` (status: New / Blocked / With RES / With RA / Done), `Owner` (person), `RA due` (date), `RES due` (date), `RA completed` (date), `RES completed` (date), `Requested by` (text), `Request notes` (text), `Related Claims` (relation)

### Source-Level Views

✅ **My Open Requests** — table, `Status` ≠ Done, sorted by `RA due` asc, shows `Request`, `PCS Version`, `Status`, `Owner`, `RA due`, `RES due`

✅ **Work queue** — board, grouped by `Status`, shows `Request`, `Status`, `Owner`, `RES due`, `RA due`

✅ **Products - Portfolio** — table, grouped by `Status`, shows all properties

### Command Center Linked Views

**Action 1 — linked view "My Open Requests"**
> Command Center → § My Open Requests → click below yellow callout → `/linked` → PCS Requests

| Setting | Value |
|---------|-------|
| Layout | Table |
| Filter | `Status` ≠ Done |
| Sort | `RA due` ascending |
| **Show** | `Request`, `PCS Version`, `Status`, `Owner`, `RA due`, `RES due` |
| **Hide** | `Request notes`, `Requested by`, `RA completed`, `RES completed`, `Related Claims` |

---

## 2. PCS Documents

**Properties:** `PCS ID` (title), `Classification` (select: A / B / C / NA / Unknown), `File status` (select: Static / Under revision / Unknown), `Product status` (select: On-market / In development / Retired / Unknown), `Transfer status` (select: Complete / Incomplete / Unknown), `Latest Version` (relation), `All versions` (relation), `Document notes` (text), `Approved/signed date` (date)

### Source-Level Views

✅ **Portfolio** — table, grouped by `File status`, sorted by `PCS ID` asc

✅ **By file status** — board, grouped by `File status`

✅ **Needs latest version** — table, filtered

✅ **Latest docs only** — table, filtered

✅ **By classification** — table, grouped by `Classification`

✅ **Under revision** — table, filtered to `File status` = Under revision

### Command Center Linked Views

**Action 2 — linked view Tab 1 "Portfolio"**
> Command Center → § Products at a Glance → `/linked` → PCS Documents

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `File status` |
| Sort | `PCS ID` ascending |
| **Show** | `PCS ID`, `Classification`, `File status`, `Latest Version`, `Product status` |
| **Hide** | `Transfer status`, `Document notes`, `Approved/signed date`, `All versions` |

**Action 3 — linked view Tab 2 "Under revision"**
> Same linked view block — add a second tab

| Setting | Value |
|---------|-------|
| Layout | Table |
| Filter | `File status` = Under revision |
| Sort | `PCS ID` ascending |
| **Show** | `PCS ID`, `Classification`, `File status`, `Latest Version`, `Product status` |
| **Hide** | `Transfer status`, `Document notes`, `Approved/signed date`, `All versions` |

---

## 3. Evidence Library

**Properties:** `Name` (title), `Evidence type` (select: Individual study / Meta-analysis / Monograph / regulatory source / Mechanistic background / Other), `Ingredient` (multi-select: EPA / DHA / Omega-3 (general) / Vitamin D / Magnesium / CoQ10 / Curcumin / Vitamin K2 / Probiotics / Other), `Publication year` (number), `DOI` (text), `PMID` (text), `URL` (url), `Citation` (text), `Canonical research summary` (text), `PDF` (file), `EndNote Record ID` (text), `EndNote Group` (text), `SQR-RCT score` (number), `SQR-RCT risk of bias` (select: Low / Some concerns / High), `SQR-RCT reviewed` (checkbox), `SQR-RCT review date` (date), `SQR-RCT review URL` (url), `Used in evidence packets` (relation), `PCS references` (relation)

### Source-Level Views

✅ **All evidence** — table, default view

✅ **Needs summary** — table, filtered to empty `Canonical research summary`

✅ **Missing EndNote ID** — table, filtered to empty `EndNote Record ID`

**Action 4 — source view "By ingredient"**
> Evidence Library → click `+` next to existing view tabs

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Ingredient` |
| Sort | `Publication year` descending |
| **Show** | `Name`, `Evidence type`, `Ingredient`, `Publication year`, `DOI`, `PMID`, `SQR-RCT score`, `Used in evidence packets` |
| **Hide** | `Citation`, `Canonical research summary`, `EndNote Record ID`, `EndNote Group`, `PDF`, `SQR-RCT review URL`, `SQR-RCT review date`, `SQR-RCT reviewed`, `SQR-RCT risk of bias`, `PCS references`, `URL` |

**Action 5 — source view "By type"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Evidence type` |
| Sort | `Publication year` descending |
| **Show** | Same as Action 4 |
| **Hide** | Same as Action 4 |

**Action 6 — source view "SQR-RCT reviewed"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Filter | `SQR-RCT reviewed` = checked |
| Sort | `SQR-RCT score` descending |
| **Show** | `Name`, `SQR-RCT score`, `SQR-RCT risk of bias`, `Ingredient`, `Evidence type`, `Publication year` |
| **Hide** | `DOI`, `PMID`, `Citation`, `Canonical research summary`, `EndNote Record ID`, `EndNote Group`, `PDF`, `SQR-RCT review URL`, `SQR-RCT review date`, `SQR-RCT reviewed`, `PCS references`, `URL`, `Used in evidence packets` |

**Action 7 — source view "Needs ingredient tag"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Filter | `Ingredient` is empty |
| **Show** | `Name`, `Evidence type`, `Ingredient`, `Publication year`, `Canonical research summary` |
| **Hide** | `DOI`, `PMID`, `Citation`, `EndNote Record ID`, `EndNote Group`, `PDF`, `SQR-RCT score`, `SQR-RCT risk of bias`, `SQR-RCT review URL`, `SQR-RCT review date`, `SQR-RCT reviewed`, `PCS references`, `URL`, `Used in evidence packets` |

*Data quality view — use this to track progress backfilling the `Ingredient` field.*

### Command Center Linked Views

**Action 8 — linked view Tab 1 "All evidence"**
> Command Center → § Evidence Library → `/linked` → Evidence Library

| Setting | Value |
|---------|-------|
| Layout | Table |
| Sort | `Publication year` descending |
| **Show** | `Name`, `Evidence type`, `Ingredient`, `Publication year`, `DOI`, `PMID`, `SQR-RCT score`, `SQR-RCT risk of bias`, `Used in evidence packets` |
| **Hide** | `Citation`, `Canonical research summary`, `EndNote Record ID`, `EndNote Group`, `PDF`, `SQR-RCT review URL`, `SQR-RCT review date`, `SQR-RCT reviewed`, `PCS references`, `URL` |

**Action 9 — linked view Tab 2 "By ingredient"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Ingredient` |
| Sort | `Publication year` descending |
| **Show** | Same as Action 8 |
| **Hide** | Same as Action 8 |

**Action 10 — linked view Tab 3 "By type"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Evidence type` |
| Sort | `Publication year` descending |
| **Show** | Same as Action 8 |
| **Hide** | Same as Action 8 |

**Action 11 — linked view Tab 4 "SQR-RCT reviewed"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Filter | `SQR-RCT reviewed` = checked |
| Sort | `SQR-RCT score` descending |
| **Show** | `Name`, `SQR-RCT score`, `SQR-RCT risk of bias`, `Ingredient`, `Evidence type`, `Publication year` |
| **Hide** | `DOI`, `PMID`, `Citation`, `Canonical research summary`, `EndNote Record ID`, `EndNote Group`, `PDF`, `SQR-RCT review URL`, `SQR-RCT review date`, `SQR-RCT reviewed`, `PCS references`, `URL`, `Used in evidence packets` |

---

## 4. PCS Claims

**Properties:** `Claim` (title), `Claim No` (text), `Claim bucket` (select: 3A (Approved/Applicable) / 3B (Unacceptable) / 3C (Ineligible/NA) / Other), `Claim status` (select: Authorized / Proposed / Not approved / NA / Unknown), `Disclaimer required` (checkbox), `Dose guidance note` (text), `Min dose mg` (number), `Max dose mg` (number), `Claim notes` (text), `PCS Version` (relation), `PCS Document` (rollup), `Canonical Claim` (relation), `Evidence packet links` (relation), `Evidence count` (rollup), `SQR-RCT pass count` (rollup), `Wording Variants` (relation)

### Source-Level Views

✅ **All claims** — table, default view

✅ **By bucket** — board, grouped by `Claim bucket`

⚠️ **Needs evidence packet** — exists but has **no filter** — see Action 12

✅ **Unlinked** — table, filtered to unlinked claims

✅ **Needs canonical claim** — table, filtered to empty `Canonical Claim`

**Action 12 — ⚠️ FIX existing "Needs evidence packet" view**
> PCS Claims → click "Needs evidence packet" tab → add filter + adjust columns

| Setting | Value |
|---------|-------|
| **Add filter** | `Evidence packet links` is empty |
| **Show** | `Claim`, `PCS Version`, `PCS Document`, `Claim bucket`, `Claim status`, `Evidence count`, `Evidence packet links` |
| **Hide** | `Claim No`, `Disclaimer required`, `Dose guidance note`, `Min dose mg`, `Max dose mg`, `Claim notes`, `Wording Variants`, `Canonical Claim`, `SQR-RCT pass count` |

### Command Center Linked Views

**Action 13 — linked view Tab 1 "By version"**
> Command Center → § Claims by Product → `/linked` → PCS Claims

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `PCS Version` |
| **Show** | `Claim`, `Claim No`, `Claim bucket`, `Claim status`, `Evidence count`, `SQR-RCT pass count`, `Canonical Claim` |
| **Hide** | `Disclaimer required`, `Dose guidance note`, `Min dose mg`, `Max dose mg`, `Claim notes`, `Wording Variants`, `Evidence packet links`, `PCS Document` |

**Action 14 — linked view Tab 2 "Evidence gaps"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Filter | `Evidence packet links` is empty |
| **Show** | `Claim`, `PCS Version`, `PCS Document`, `Claim bucket`, `Claim status`, `Evidence count`, `Evidence packet links` |
| **Hide** | `Claim No`, `Disclaimer required`, `Dose guidance note`, `Min dose mg`, `Max dose mg`, `Claim notes`, `Wording Variants`, `Canonical Claim`, `SQR-RCT pass count` |

**Action 15 — linked view Tab 3 "By bucket"**

| Setting | Value |
|---------|-------|
| Layout | **Board** |
| Group by | `Claim bucket` |
| Show on cards | `Claim`, `Claim status`, `PCS Version` |

---

## 5. PCS Revision Events

**Properties:** `Event` (title), `Activity type` (select: File creation (FC) / File modification (FM) / Review & approve / Evaluate / revise substantiation / Other), `Start date` (date), `End date` (date), `PCS Version` (relation), `From version` (text), `To version` (text), `From version (linked)` (relation), `To version (linked)` (relation), `Responsible individual` (person), `Responsible dept` (select: RES / RA / Other), `Event notes` (text), `Attachments` (file)

### Source-Level Views

✅ **All events** — table, default view

✅ **Unlinked** — table, filtered to unlinked events

**Action 16 — source view "Recent (30 days)"**
> PCS Revision Events → click `+` next to existing view tabs

| Setting | Value |
|---------|-------|
| Layout | Table |
| Filter | `Start date` is within the past month *(use Notion's relative date filter)* |
| Sort | `Start date` descending |
| **Show** | `Event`, `Activity type`, `Responsible individual`, `Responsible dept`, `PCS Version`, `From version (linked)`, `To version (linked)`, `Start date` |
| **Hide** | `End date`, `From version`, `To version`, `Event notes`, `Attachments` |

**Action 17 — source view "By activity type"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Activity type` |
| Sort | `Start date` descending |
| **Show** | Same as Action 16 |
| **Hide** | Same as Action 16 |

**Action 18 — source view "By department"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Responsible dept` |
| Sort | `Start date` descending |
| **Show** | Same as Action 16 |
| **Hide** | Same as Action 16 |

### Command Center Linked Views

**Action 19 — linked view Tab 1 "Recent"**
> Command Center → § Recent Activity → `/linked` → PCS Revision Events

| Setting | Value |
|---------|-------|
| Layout | Table |
| Sort | `Start date` descending |
| **Show** | `Event`, `Activity type`, `Responsible individual`, `Responsible dept`, `PCS Version`, `From version (linked)`, `To version (linked)`, `Start date` |
| **Hide** | `End date`, `From version`, `To version`, `Event notes`, `Attachments` |

**Action 20 — linked view Tab 2 "By activity type"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Activity type` |
| Sort | `Start date` descending |
| **Show** | Same as Action 19 |
| **Hide** | Same as Action 19 |

---

## 6. Canonical Claims

**Properties:** `Canonical claim` (title), `Claim family` (select: Mood / stress / Sleep / Cognition / Cardiovascular / Muscle / Energy / metabolism / Cellular signaling / Deficiency / Other), `Evidence tier required` (select: Structure-function required / Mechanistic-only allowed), `Minimum evidence items` (number), `Notes / guardrails` (text), `PCS claim instances` (relation)

### Source-Level Views

✅ **All canonical claims** — table, default view

✅ **Needs mapping** — table, filtered to unmapped claims

**Action 21 — source view "By claim family"**
> Canonical Claims → click `+` next to existing view tabs

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Claim family` |
| Sort | `Canonical claim` ascending |
| **Show** | `Canonical claim`, `Claim family`, `Evidence tier required`, `Minimum evidence items`, `Notes / guardrails`, `PCS claim instances` |

**Action 22 — source view "Evidence requirements"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Sort | `Minimum evidence items` descending |
| **Show** | `Canonical claim`, `Evidence tier required`, `Minimum evidence items`, `PCS claim instances` |
| **Hide** | `Claim family`, `Notes / guardrails` |

### Command Center Linked Views

**Action 23 — linked view Tab 1 "All claims"**
> Command Center → § Claim Library → `/linked` → Canonical Claims

| Setting | Value |
|---------|-------|
| Layout | Table |
| Sort | `Canonical claim` ascending |
| **Show** | `Canonical claim`, `Claim family`, `Evidence tier required`, `Minimum evidence items`, `Notes / guardrails`, `PCS claim instances` |

**Action 24 — linked view Tab 2 "By claim family"**

| Setting | Value |
|---------|-------|
| Layout | Table |
| Group by | `Claim family` |
| Sort | `Canonical claim` ascending |
| **Show** | Same as Action 23 |

---

## Summary

| # | Database | Existing | Actions | What to do |
|---|----------|----------|---------|------------|
| 1 | PCS Requests | 3 views | 1 | 1 Command Center linked view |
| 2 | PCS Documents | 6 views | 2 | 2 Command Center linked view tabs |
| 3 | Evidence Library | 3 views | 8 | 4 new source views + 4 Command Center tabs |
| 4 | PCS Claims | 5 views | 4 | 1 filter fix + 3 Command Center tabs |
| 5 | PCS Revision Events | 2 views | 5 | 3 new source views + 2 Command Center tabs |
| 6 | Canonical Claims | 2 views | 4 | 2 new source views + 2 Command Center tabs |
| | **Total** | **21** | **24** | **9 source + 14 linked + 1 fix** |

---

## Schema Change Log

| Date | Database | Change | Why |
|------|----------|--------|-----|
| Mar 9, 2026 | Evidence Library | Added `Ingredient` multi-select (EPA, DHA, Omega-3 (general), Vitamin D, Magnesium, CoQ10, Curcumin, Vitamin K2, Probiotics, Other) | Enables "By ingredient" grouping |

---

## Tips

- Use **locked views** on Command Center linked views to prevent accidental filter changes
- Use **wrap cells** for readability on text-heavy columns
- Delete the yellow setup callouts from the Command Center after adding each linked view
- Use the "Needs ingredient tag" view to track progress backfilling the `Ingredient` field
