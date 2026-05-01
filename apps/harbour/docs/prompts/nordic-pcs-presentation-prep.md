# Prompt: Nordic PCS Database Presentation Prep

> Copy everything below this line into a new Claude session.

---

Help me prepare a presentation for a manager/decision-maker at Nordic Naturals (a dietary supplement company). The goal is to clearly communicate the value of a PCS (Product Claim Substantiation) database system we've built in Notion, and lay out the next steps of development.

## Audience

- **Sharon** — the manager who oversees regulatory affairs and research substantiation
- She is NOT technical. She cares about: time saved, regulatory risk reduction, audit readiness, team clarity, and whether her team can actually use this
- She has seen the Notion workspace but hasn't fully grasped the scope of what's connected or why it matters compared to their current process

## The Problem We're Solving

Nordic's current process for managing PCS documents:

- **100+ PCS PDFs** scattered across shared drives and doc files
- Each PCS PDF is a regulatory document for one dietary supplement product containing: product metadata, supplement facts/formula, approved health claims (3A), rejected claims (3B/3C), a bibliography of supporting studies, and revision history
- The team tracks claim status, evidence references, and revision history in **Word tables and spreadsheets** — no cross-referencing, no single source of truth
- When a regulator asks "show me every product that uses this claim" or "which studies support this claim across all products," the team has to manually search through dozens of PDFs
- Evidence quality is tracked separately in a custom SQR-RCT (Systematic Quality Review for Randomized Controlled Trials) web platform, but there's no connection between quality scores and the claims they support
- New hires have no way to see the full picture — they inherit tribal knowledge

## What We've Built

A relational Notion database system with 8 interconnected databases:

### The Databases

| Database | Purpose | Record Count (approx) |
|----------|---------|----------------------|
| **PCS Documents** | One row per product (PCS-0126, PCS-0127, etc.) with classification, file status, product status | ~50-100 products |
| **PCS Versions** | Version snapshots (v1.0, v2.1) linked to their parent Document | ~150-300 versions |
| **PCS Claims** | Every health claim with bucket (3A approved / 3B rejected / 3C ineligible), status, dose info | ~500-2000 claims |
| **Formula Lines** | Supplement Facts ingredient lines with amounts, linked to versions | ~300-1000 lines |
| **Evidence Library** | Canonical research studies — each study exists ONCE and gets linked everywhere it's cited | ~200-500 studies |
| **Evidence Packets** | Join table: which studies support which claims (with evidence role and quality threshold) | ~1000-3000 links |
| **PCS References** | Bibliography entries per PCS version, linked to Evidence Library items | ~1000-5000 refs |
| **PCS Revision Events** | Full change history: who changed what, when, between which versions | ~200-1000 events |
| **Canonical Claims** | Claim library — reusable canonical claim definitions with evidence requirements | ~30-80 claims |

### Key Relationships

```
PCS Document → Versions → Claims → Evidence Packets → Evidence Library
                       → Formula Lines
                       → PCS References → Evidence Library
                       → Revision Events
Canonical Claims → PCS Claims (many instances of the same canonical claim across products)
```

### The Command Center

A single Notion dashboard page that surfaces:
- My Open Requests (work queue by status)
- Products at a Glance (all PCS documents with file status)
- Evidence Library (with ingredient, type, and SQR-RCT reviewed tabs)
- Claims by Product (grouped by version, with evidence gap detection)
- Recent Activity (revision event audit trail)
- Claim Library (canonical claims with reuse counts)

### Tooling Built

1. **SQR-RCT Sync Bridge** — automated pipeline that pushes study quality scores from the SQR-RCT review platform into the Evidence Library in real-time (score, risk of bias rating, review date, link back to full review)

2. **Ingredient Backfill Engine** — keyword-matching script that auto-tags Evidence Library entries with ingredient multi-select values (EPA, DHA, Vitamin D, Magnesium, CoQ10, Curcumin, Vitamin K2, Probiotics) based on scientific synonyms in titles and abstracts

3. **Admin Sync Dashboard** — web UI at `/admin/sync` where the team can run dry runs and live syncs for both the SQR-RCT bridge and ingredient backfill, with result summaries and error reporting

4. **PCS PDF Import Process** — standardized 5-phase Notion AI prompt templates that let the team import a PCS PDF into all the correct databases in ~15-20 minutes per document, with a validation checklist

5. **24 pre-designed database views** — filtered, sorted, grouped views across all databases (9 source-level views + 14 Command Center linked views + 1 filter fix), fully specified with exact property names and ready for the team to click into place

## What This Enables (Value Propositions)

Frame these for a non-technical manager:

1. **"Show me every product that uses this claim"** — one click instead of searching 100 PDFs
2. **"Which studies support this claim, and what's their quality?"** — Evidence Packets + SQR-RCT scores give instant answers
3. **"Are we audit-ready?"** — the Revision Events database IS the audit trail; regulators can see the full history per product
4. **"What claims need more evidence?"** — the Evidence Gaps view surfaces claims with zero evidence packets
5. **"What studies haven't been quality-reviewed?"** — the SQR-RCT Reviewed view shows exactly which studies have scores
6. **"How do I onboard a new team member?"** — hand them the Command Center; everything is visible and cross-referenced
7. **"Can we track ingredient-level evidence?"** — the Ingredient multi-select + By Ingredient view group studies by ingredient across the whole library
8. **One study, many claims** — the Evidence Library is canonical. Update a study's quality score once and it propagates to every claim that cites it, across every product

## Development Phases

### Phase 1 — Foundation (COMPLETE ✅)
- All 8 databases designed and created with proper schemas
- Relations and rollups connecting everything
- Command Center dashboard with setup instructions
- PCS PDF Import Guide with Notion AI prompts
- 21 database views already configured
- SQR-RCT sync bridge (live, deployed)
- Ingredient backfill engine (live, deployed)
- Admin sync dashboard (live, deployed)

### Phase 2 — View Configuration + Initial Data (IN PROGRESS 🔄)
- 24 remaining view actions (source-level + Command Center linked views)
- These are manual Notion UI tasks — clicking through the specs to create filtered/grouped views
- Run ingredient backfill on existing Evidence Library entries
- Run SQR-RCT sync to pull in current quality scores
- Import first 5-10 PCS PDFs using the Notion AI prompt process to validate the workflow

### Phase 3 — Bulk Migration (PLANNED 📋)
- Automated pipeline to process the 100+ existing PCS PDFs
- Claude API reads each PDF and extracts structured data
- Data is validated against database schemas before writing
- Generates a diff report for human review before committing
- One-time migration tool; after this, ongoing imports use the Notion AI prompts

### Phase 4 — Advanced Features (FUTURE 🔮)
- Evidence Library ↔ PubMed integration (auto-fetch metadata from DOIs/PMIDs)
- Canonical Claim guardrails enforcement (minimum evidence counts, required evidence tiers)
- PDF generation from database (export a reconstructed PCS document from the structured data)
- Dashboard analytics (claim coverage rates, evidence quality distribution, portfolio risk heat map)

## What I Need Help With

Please help me create:

1. **A presentation outline** (10-15 slides) that tells the story from problem → solution → value → next steps, calibrated for a non-technical manager who cares about regulatory risk and team efficiency

2. **Talking points for each slide** — what to say, not just what to show. Sharon needs to feel the pain of the current process and the relief of the new one

3. **A "before vs. after" comparison** — concrete scenarios showing how specific tasks change (e.g., "finding all products with a claim about cardiovascular health" goes from "2 hours searching PDFs" to "one click")

4. **A recommended demo flow** — if I'm going to show the Notion workspace live, what's the most impressive 5-minute walkthrough path?

5. **Objection handling** — what questions will a cautious manager ask ("what if Notion goes down?", "who maintains this?", "what's the learning curve?") and how to answer them

Keep the language non-technical. No code, no API talk. Focus on outcomes, time savings, risk reduction, and team clarity. Nordic is a mid-size supplement company — they care about regulatory compliance, efficiency, and not getting caught flat-footed during an audit.
