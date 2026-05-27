# Nordic Naturals PCS — Workflow Synthesis

*How the 11-database schema maps to Sharon's team's daily work. Written Mar 2026.*

---

## The Big Picture

The PCS (Product Claim Substantiation) system replaces what was previously a mix of Smartsheet trackers, email threads, and institutional memory. The Notion relational database is **not a task manager** — it's a **claims registry with evidence lineage**. Every product claim the company makes can be traced back through versions, evidence packets, and source literature.

The three core user journeys are:

1. **"Can we say this?"** — A new claim request arrives, gets evaluated, gets substantiated or rejected
2. **"What did we say?"** — Regulatory or legal needs the history of a specific claim
3. **"What do we have?"** — Research team inventories evidence for a product line or ingredient

---

## Database Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    PCS DOCUMENTS (top level)                 │
│            One per product (e.g., "Ultimate Omega")         │
│                                                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │              PCS VERSIONS (per document)              │  │
│   │         v1.0, v1.1, v2.0... audit trail              │  │
│   │                                                       │  │
│   │   ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │  │
│   │   │  CANONICAL   │  │  FORMULA     │  │  EVIDENCE  │  │  │
│   │   │  CLAIMS      │  │  LINES       │  │  PACKETS   │  │  │
│   │   │              │  │              │  │            │  │  │
│   │   │ "Supports    │  │ EPA 400mg    │  │ Packet A:  │  │  │
│   │   │  heart       │  │ DHA 200mg    │  │ 3 studies  │  │  │
│   │   │  health"     │  │ Vit D 1000IU │  │ + 1 review │  │  │
│   │   └──────┬──────┘  └──────────────┘  └─────┬──────┘  │  │
│   │          │                                   │         │  │
│   └──────────┼───────────────────────────────────┼─────────┘  │
│              │                                   │            │
│              ▼                                   ▼            │
│   ┌─────────────────┐                 ┌──────────────────┐   │
│   │ CLAIM–EVIDENCE   │                 │ EVIDENCE LIBRARY │   │
│   │ JOIN TABLE       │────────────────▶│                  │   │
│   │ (N:M linkage)    │                 │ Individual       │   │
│   │                  │                 │ studies, reviews, │   │
│   └─────────────────┘                 │ monographs        │   │
│                                        └──────────────────┘   │
│                                                               │
│   ┌───────────────┐  ┌────────────────┐  ┌───────────────┐  │
│   │ PCS REQUESTS   │  │ REVISION       │  │ PCS           │  │
│   │ (intake queue) │  │ EVENTS         │  │ REFERENCES    │  │
│   │                │  │ (change log)   │  │ (external     │  │
│   │ "Marketing     │  │                │  │  citations)   │  │
│   │  wants claim   │  │ "v1.0 → v1.1: │  │               │  │
│   │  for new SKU"  │  │  added DHA     │  │ EndNote IDs,  │  │
│   │                │  │  claim per     │  │ DOIs, PMIDs   │  │
│   │                │  │  Sharon review"│  │               │  │
│   └───────────────┘  └────────────────┘  └───────────────┘  │
│                                                               │
│   ┌───────────────────────────────────────────────────────┐  │
│   │                    STATUS LOG                          │  │
│   │      RA/RES review trail with status abbreviations     │  │
│   └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Journey 1: "Can We Say This?" — New Claim Request

**Who**: Marketing, product development, or sales submits a request. RA/RES team evaluates.

### Step-by-step

| Step | Who | What happens | Database touched |
|------|-----|-------------|-----------------|
| 1 | Requester | Fills out a new request: product, proposed claim language, urgency, context | **PCS Requests** |
| 2 | Sharon / RA lead | Triages request in dashboard view (filtered by status). Assigns to reviewer. | **PCS Requests** (status update) |
| 3 | Reviewer | Checks if claim already exists in the system | **Canonical Claims** (search/filter) |
| 4a | If claim exists | Links request to existing canonical claim. Reviews whether current evidence still supports it. | **PCS Requests** → **Canonical Claims** (relation) |
| 4b | If new claim | Creates canonical claim record with claim language, category, and regulatory scope | **Canonical Claims** (new record) |
| 5 | Reviewer | Searches Evidence Library for relevant studies. May also query Perplexity/MCP for new literature. | **Evidence Library** (search) |
| 6 | Reviewer | Builds or updates an evidence packet — groups of evidence items that collectively substantiate the claim | **Evidence Packets** + **Claim–Evidence Join** (link claims ↔ evidence) |
| 7 | Reviewer | Creates or updates a PCS Version for the product document, attaching the claim and evidence packet | **PCS Versions** (new or updated) |
| 8 | Sharon | Reviews in dashboard. Approves, requests revision, or rejects. | **Status Log** + **PCS Requests** (status) |
| 9 | System | Request closed. Canonical claim now has evidence trail. | **PCS Requests** (completed) |

### Dashboard view Sharon sees

A filtered view of **PCS Requests** sorted by status:
- **New** → needs triage
- **In Review** → assigned, being worked
- **Pending Approval** → evidence packet ready, Sharon needs to sign off
- **Approved / Rejected** → archived

---

## Journey 2: "What Did We Say?" — Regulatory Audit Trail

**Who**: Legal, regulatory affairs, or FDA inquiry needs the history of a specific claim.

### Step-by-step

| Step | Who | What happens | Database touched |
|------|-----|-------------|-----------------|
| 1 | Auditor | Searches by product name or claim language | **PCS Documents** or **Canonical Claims** |
| 2 | — | Opens the PCS Document page → sees "All versions" back-link | **PCS Documents** → **PCS Versions** |
| 3 | — | Opens specific version → sees linked claims, formula lines, evidence packets, and references | **PCS Versions** (with all back-links) |
| 4 | — | Clicks into a claim → sees "Used in evidence packets" and "PCS references" | **Canonical Claims** → **Evidence Packets** → **Evidence Library** |
| 5 | — | Reviews Revision Events to understand what changed between versions and why | **Revision Events** (from/to version links, responsible individual, rationale) |

### Why back-links matter here

Before the schema fix, an auditor landing on a PCS Document page would see... nothing. No children listed. They'd have to search PCS Versions separately and manually filter. Now, the "All versions" relation on PCS Documents and the dual relations on PCS Versions mean **every parent page displays its children automatically**. This is the navigation Sharon specifically asked about.

---

## Journey 3: "What Do We Have?" — Evidence Inventory

**Who**: Research team doing periodic review, or prepping for a new product launch.

### Step-by-step

| Step | Who | What happens | Database touched |
|------|-----|-------------|-----------------|
| 1 | Researcher | Opens Evidence Library, filters by ingredient, publication year, or study type | **Evidence Library** |
| 2 | — | Sees "Used in evidence packets" back-link → knows which claims this evidence already supports | **Evidence Library** → **Evidence Packets** |
| 3 | — | Sees "PCS references" back-link → connects to formal citation records (DOIs, PMIDs, EndNote IDs) | **Evidence Library** → **PCS References** |
| 4 | — | Identifies gaps: "We have 12 studies on EPA cardiovascular, but only 2 on EPA cognitive" | Gap analysis via filtered views |
| 5 | — | Adds new evidence from literature search, links to PCS References for citation management | **Evidence Library** + **PCS References** (new records) |

### Perplexity/MCP integration point

When a researcher queries Perplexity (or any MCP-connected AI) about the database, the disambiguated field names (e.g., "Document notes" vs. "Claim notes" vs. "Version notes") prevent confusion. A query like *"Which claims in PCS Documents reference omega-3 cardiovascular studies?"* can now resolve unambiguously because "Document notes" won't collide with "Claim notes" or "Version notes" in the response.

---

## The Status Abbreviation System

Sharon's team uses a qualitative review process with status codes (carried over from Smartsheet). These flow through the **Status Log** database:

| Abbreviation | Meaning | Used when |
|---|---|---|
| **DR** | Draft | Version is being assembled |
| **IR** | In Review | Assigned reviewer is evaluating claims + evidence |
| **PA** | Pending Approval | Ready for Sharon's sign-off |
| **AP** | Approved | Claim substantiation accepted |
| **RV** | Revision Needed | Sharon or reviewer flagged issues |
| **RJ** | Rejected | Claim cannot be substantiated with current evidence |
| **AR** | Archived | Superseded by newer version |

These are **not automatable** — the review is fundamentally qualitative judgment. The system's job is to make the context visible (what evidence exists, what changed, who reviewed) so that judgment can be made efficiently.

---

## What Views / Dashboards to Build

The schema is the foundation. The *experience* is in the views. Here's what Sharon's team needs as Notion database views:

### Priority 1 — Daily Operations

| View | Database | Filter/Sort | Purpose |
|------|----------|------------|---------|
| **Request Queue** | PCS Requests | Status ≠ Completed, sorted by urgency then date | Sharon's daily triage |
| **My Reviews** | PCS Requests | Assigned to = current user, Status = In Review | Individual reviewer workload |
| **Pending Approval** | PCS Versions | Status = PA | Sharon's approval queue |
| **Recent Changes** | Revision Events | Last 30 days, sorted by date | Team awareness of what's moving |

### Priority 2 — Navigation & Lookup

| View | Database | Filter/Sort | Purpose |
|------|----------|------------|---------|
| **Products A–Z** | PCS Documents | Alphabetical | Quick product lookup |
| **Claims by Category** | Canonical Claims | Grouped by claim category | "Show me all cardiovascular claims" |
| **Evidence by Ingredient** | Evidence Library | Grouped by ingredient/tag | Evidence inventory |
| **Full Citation List** | PCS References | Sorted by author/year | EndNote cross-reference |

### Priority 3 — Analytics & Reporting

| View | Database | Filter/Sort | Purpose |
|------|----------|------------|---------|
| **Claims per Product** | PCS Versions | Rollup: claim count | Portfolio coverage overview |
| **Evidence Gaps** | Evidence Library | Grouped by ingredient, filtered by low citation count | Where to invest research effort |
| **Version History** | PCS Versions | Grouped by PCS Document, sorted by version number | Audit-ready document history |

---

## How This Connects to the Existing SQR-RCT App

The Nordic SQR-RCT platform (already live at `apps/nordic-sqr-rct/`) is a **study quality assessment tool** — expert reviewers score published research across 11 dimensions. Its output (quality scores, credibility badges) feeds directly into the PCS system:

```
Published study  →  SQR-RCT quality review  →  Evidence Library entry
                                                      ↓
                                              Evidence Packet
                                                      ↓
                                              Claim substantiation
```

When a researcher adds a study to the Evidence Library, they can reference its SQR-RCT quality score as part of the evidence strength assessment. The `Publication year` field (added in the schema fix) and citation metadata in PCS References align with SQR-RCT's intake database fields.

**Future integration opportunity**: A Notion automation or API bridge could pull SQR-RCT scores directly into Evidence Library records, eliminating manual cross-referencing.

---

## Security Model (Per Sharon's Priority)

Sharon emphasized security as a top concern. The Notion workspace supports this through:

1. **Workspace-level access**: Only Nordic team members see PCS databases
2. **Database-level permissions**: Views can be locked so team members see filtered data without modifying the underlying structure
3. **Person-type fields**: `Responsible individual` on Revision Events (now corrected from text → person) enables permission-aware filtering — "show me only my reviews"
4. **Audit trail**: Revision Events + Status Log create an immutable-style change history. Even if a PCS Version is updated, the revision event records who changed what and when
5. **No external exposure**: Unlike the SQR-RCT app (web-facing), the PCS system lives entirely within Notion — no API endpoints, no public URLs

---

## Summary: What the Team Gets

| Before (Smartsheet + email) | After (Notion PCS) |
|---|---|
| Claims scattered across spreadsheets | Single canonical claims registry |
| "Which version of the document had that EPA claim?" → dig through email | Version history with bidirectional links |
| "What evidence supports this claim?" → ask whoever remembers | Evidence packets with traceable lineage |
| "Who approved this and when?" → check email threads | Status log + revision events with person fields |
| New claim request → email to Sharon → hope it doesn't get lost | Request queue with triage dashboard |
| Literature search results → saved locally | Evidence Library searchable by ingredient, year, type |
| "Is this the same claim as that one?" → judgment call | Canonical claims with deduplication |
| Perplexity queries return ambiguous results | Disambiguated field names for clean MCP queries |

---

*This document describes the intended workflow design. The schema (11 databases, bidirectional relations, disambiguated fields) is complete. The next step is building the Notion views/dashboards listed above so Sharon's team has the right entry points into the data.*
