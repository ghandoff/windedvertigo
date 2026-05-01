# Nordic PCS Database — Strategic Vision & Add-On Features

> Reference document for expanding the PCS database system into an AI-integrated platform.
> Organized by implementation tier (nearest-term → biggest bets).

---

## Tier 1 — Near-Term AI Features (weeks, not months)

These build directly on infrastructure that's already deployed.

### 1. Auto-summarization on evidence intake

When a new study is added to the Evidence Library, AI reads the abstract/PDF and auto-generates:
- Canonical research summary (currently empty on many entries)
- Ingredient tags (extending the existing backfill engine to run on new entries)
- Evidence type classification (Individual study vs. Meta-analysis vs. Monograph)
- Publication year extraction from citation text

Turns a 10-minute manual data entry task into a 30-second review-and-confirm.

### 2. PubMed auto-enrichment

The Evidence Library already has DOI and PMID fields. A simple enrichment pipeline:
- For any entry with a PMID but missing metadata → hit PubMed API → pull title, authors, journal, year, abstract
- For entries with a DOI but no PMID → resolve DOI → then enrich
- Could run as a button on the existing admin sync dashboard

### 3. Natural language database querying

A chat interface where the research team asks questions in plain English:
- "Which omega-3 claims have fewer than 3 supporting studies?"
- "Show me all products under revision"
- "What evidence supports cardiovascular claims across the portfolio?"

AI translates these into Notion database queries using the verified schema. The structured relational data makes this dramatically more reliable than search over unstructured docs.

### 4. Evidence gap detector

Automated analysis across the full portfolio:
- Claims with zero evidence packets
- Claims supported only by mechanistic evidence (no RCTs)
- Claims where all supporting studies are older than N years
- Claims where the average SQR-RCT score is below threshold
- Cross-product gaps: "Products A, B, and C all make Claim X, but Product B is missing Study Y that supports the other two"

Proactive risk identification, not reactive scrambling during an audit.

---

## Tier 2 — Cross-Functional Expansion (research team → company-wide)

This is where the system stops being "Sharon's databases" and becomes company infrastructure.

### 5. Marketing claim approval workflow

Marketing wants to put a health claim on packaging or a website:
1. Marketing submits a claim request (PCS Requests database, new status: "Marketing review")
2. System checks: Does this match a Canonical Claim? Is it 3A authorized? What's the evidence strength?
3. If it matches, shows approved wording variants (the Wording Variants relation already exists)
4. RA reviews and approves/rejects
5. Marketing gets the approved wording + any required disclaimers

Every claim on every label becomes traceable back to authorized claims with evidence.

### 6. Product development intelligence

R&D considering a new product with Vitamin D + Magnesium + Probiotics:
- "What canonical claims are available for these ingredients?"
- "What's the evidence strength for each claim?"
- "What's the minimum SQR-RCT evidence needed for the claim tier we want?"

The database already has Canonical Claims → Evidence tier required → Minimum evidence items. An AI layer turns this into a structured product feasibility report.

### 7. Regulatory change monitoring

A scheduled task that:
- Monitors FDA dietary supplement guidance pages
- Watches EFSA scientific opinion feeds
- Flags when a regulatory change might affect existing claims
- Auto-creates a PCS Request: "FDA updated guidance on cardiovascular claims — review needed for PCS-0126, PCS-0142, PCS-0158"

Proactive compliance vs. reactive compliance.

### 8. Audit readiness dashboard

Real-time executive view:
- Portfolio coverage: What % of claims have complete evidence packets?
- Quality distribution: What % of supporting evidence passes SQR-RCT?
- Freshness: How many claims rely on evidence older than 5 years?
- Completeness: How many PCS documents are fully imported vs. still PDF-only?
- Risk heat map: Red/yellow/green per product based on composite score

---

## Tier 3 — Platform Plays (bigger bets)

### 9. AI-assisted claim drafting

Given a product's formula and the Evidence Library, AI drafts candidate claims:
- Suggests claim text based on existing evidence
- Maps to the closest Canonical Claim
- Rates claim as strong / moderate / weak based on evidence depth
- Flags required disclaimers based on dose and evidence tier
- Outputs a draft claim package ready for RA review

Flips the process from "we have claims, do we have evidence?" to "here's what the evidence supports."

### 10. Evidence Library as living literature review

- PubMed watch lists per ingredient — new publications auto-flagged for review
- Citation network mapping — "this meta-analysis cites 4 studies already in your library"
- Automatic SQR-RCT queuing — high-relevance studies auto-queued for quality review
- Trend detection — "40% increase in Vitamin K2 + cardiovascular publications in last 12 months"

### 11. PDF generation from database (round-trip)

Today: PDF → database (import). The reverse:
- Generate a complete PCS document from the structured data
- Always up-to-date — reflects current database state
- Version-controlled — generate the document as it existed at any point
- Eliminates the "which PDF is the latest?" problem permanently

### 12. Multi-tenant platform

The architecture patterns (relational Notion databases + AI enrichment + quality scoring + sync bridges) generalize to:
- Other supplement companies
- Nutraceutical companies with similar regulatory requirements
- Food & beverage companies with health claim substantiation
- Pharma companies with lighter-weight evidence management

---

## The winded.vertigo Consulting Angle

### What this project proves

| Capability | Evidence |
|---|---|
| Notion as enterprise infrastructure | 8 interconnected databases replacing scattered PDFs |
| AI integration that augments experts | AI reads PDFs, tags ingredients, syncs quality scores — humans decide |
| Domain-specific tooling | SQR-RCT platform, sync bridge, ingredient backfill — built for this workflow |
| Progressive complexity | databases → views → sync → AI → platform |
| Build → prove → expand model | Research team → marketing → company-wide → multi-tenant |

### Service tiers

1. **Database architecture** — schema design, Notion setup, view configuration (~1-2 weeks)
2. **AI enrichment layer** — auto-summarization, PubMed integration, NL querying (~2-4 weeks)
3. **Sync infrastructure** — custom bridges between Notion and domain platforms (~2-3 weeks)
4. **Workflow automation** — claim approval, regulatory monitoring, audit dashboards (~3-6 weeks)
5. **Ongoing intelligence** — monthly retainer for literature monitoring, gap analysis, maintenance

### Key differentiator

The moat is the **relational knowledge graph**, not the AI. Any company can bolt AI onto a document pile. The value is structured relational data that makes AI queries precise and trustworthy. That's the hard part — and it's what's already built.

---

## Existing Slide Deck Structure (14 slides)

The presentation at `nordic-pcs-presentation.pptx` currently contains:

| # | Title | Content |
|---|-------|---------|
| 1 | product claim substantiation database | Title slide with subtitle and winded.vertigo logo |
| 2 | the challenge today | Current pain points |
| 3 | the real cost | "2+ hours", "weeks", "zero" — quantified pain |
| 4 | what if your team could... | Vision bullets with winded.vertigo logo |
| 5 | what we built | Database overview with visual elements |
| 6 | how everything connects | Relationship diagram |
| 7 | the command centre | Dashboard overview |
| 8 | before vs. after | Comparison table |
| 9 | smart automation, simple for your team | SQR-RCT sync, ingredient backfill, admin tools |
| 10 | audit ready from day one | Compliance/audit readiness |
| 11 | where we are | 3-phase roadmap (Foundation ✅, Views 🔄, Bulk Migration 📋) |
| 12 | immediate next steps | Action items |
| 13 | looking ahead | Future features |
| 14 | let's walk through it. | Closing / demo prompt |

### Where new slides should go

Insert **after slide 13 ("looking ahead")** and **before slide 14 ("let's walk through it")**. The new slides expand the vision beyond what "looking ahead" covers. Suggested new slides:

1. **"AI that works with your team"** — Tier 1 features (auto-summarization, PubMed enrichment, NL querying, gap detection). These are nearest-term and most tangible.
2. **"beyond the research team"** — Tier 2 features (marketing claim workflow, product dev intelligence, regulatory monitoring, audit dashboard). Shows company-wide value.
3. **"the bigger picture"** — Tier 3 features (claim drafting, living lit review, PDF round-trip, multi-tenant). Plants the seed for platform thinking.

Match the existing slide style: dark navy backgrounds for section headers, white/cream backgrounds for content slides, lowercase titles, bullet points with short phrases, warm accent colors (the copper/orange from the title slide).
