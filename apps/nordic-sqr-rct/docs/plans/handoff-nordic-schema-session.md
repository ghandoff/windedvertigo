# Session Handoff: Nordic Database Schema

**Date**: March 9, 2026
**Branch**: `claude/pedantic-ptolemy-w9zvv`
**From**: Cloud machine (remote laptop)
**To**: Local desktop

---

## What We Discussed

This session covered **syncing workflow between machines** and the **Nordic database schema** context. The key takeaway: use the git branch as the handoff point between machines — commit/push here, pull there.

---

## Nordic Ecosystem Overview

There are **two Nordic systems** in this repo. They are related but architecturally distinct:

### 1. Nordic SQR-RCT (Web App)

**Path**: `apps/nordic-sqr-rct/`
**Status**: Live and stable (upgraded to Next.js 16 + React 19, March 2026)

A systematic review tool for assessing research quality across 11 dimensions. Built for Nordic Naturals.

**Database**: 3 Notion databases accessed in real-time (no local DB, no caching):

| Database | Notion ID | Purpose |
|----------|-----------|---------|
| Reviewers | `b74c6186d782449985ac3dee528a1977` | Profiles, credentials, consent, training |
| Intake | `8229473837b249789a1163d109b617ef` | Study records with citation metadata (DOI, PMID, author, year, journal) |
| Scores | `9dc69b99d6dc427db9c58b0446e215d2` | Quality ratings Q1–Q11 (Likert 1–5) |

**Key source files**:
- `src/lib/notion.js` — Notion client with retry logic (3 retries, exponential backoff + jitter)
- `src/lib/auth.js` — JWT-based authentication (bcryptjs + jose)
- `src/lib/rubric.js` — Quality assessment framework (11 dimensions)
- `src/lib/llm.js` / `src/lib/llm-reviewer.js` — Claude API auto-review
- `src/app/api/` — 19 API routes (auth, studies, scores, export, ai-review, credibility)

**Run locally**: `npm run dev:sqr-rct` (port 3001)
**Env vars**: see `apps/nordic-sqr-rct/.env.local.example`

---

### 2. Nordic PCS Pilot (Notion-only, no web app)

**Status**: Pilot phase — schema complete, Sharon's RA/RES team testing

A Notion relational database system for **Product Claim Substantiation** — replacing Smartsheet trackers and email workflows for Nordic Naturals' regulatory affairs team.

**Schema**: 11 interconnected Notion databases:

| # | Database | Purpose |
|---|----------|---------|
| 1 | PCS Documents | One per product (e.g., "Ultimate Omega") |
| 2 | PCS Versions | Snapshots of claims at a point in time (v1.0, v1.1, v2.0) |
| 3 | Canonical Claims | Deduped claim language (e.g., "Supports heart health") |
| 4 | Formula Lines | Product ingredients and amounts (EPA 400mg, DHA 200mg) |
| 5 | Evidence Packets | Bundles of studies supporting a claim |
| 6 | Evidence Library | Individual studies, reviews, monographs |
| 7 | Claim-Evidence Join | N:M linking claims to evidence packets |
| 8 | PCS Requests | Intake queue for new claims (statuses: DR, IR, PA, AP, RV, RJ, AR) |
| 9 | Revision Events | Change log with before/after versions |
| 10 | PCS References | Citation metadata (DOI, PMID, EndNote ID) |
| 11 | Status Log | Audit trail of review decisions |

**How the two systems connect**:
```
Published study → SQR-RCT quality review → Evidence Library entry
                                                  ↓
                                          Evidence Packet
                                                  ↓
                                          Claim substantiation
```

Future integration: API bridge to auto-pull SQR-RCT quality scores into Evidence Library records.

---

## Key Documentation (already in repo)

| File | What it covers |
|------|---------------|
| `docs/nordic-pcs-onboarding.md` | User guide for Sharon's team (concepts, views, status codes, tasks) |
| `docs/nordic-pcs-workflow-synthesis.md` | Technical design (3 user journeys, 11-DB schema, views to build) |
| `docs/notion-database-map.md` | Full Notion database registry (16 DBs across 3 projects) |
| `docs/dev-roadmap.md` | Cross-project priorities (Nordic SQR-RCT noted as "Supabase migration candidate") |

---

## Recent Changes (for context)

- **Mar 7**: Added Nordic PCS onboarding guide + workflow synthesis docs
- **Mar 5**: Upgraded Nordic SQR-RCT to Next.js 16 + React 19, added security headers (HSTS + CSP)
- **Earlier**: Auth hardening, standardized `NOTION_TOKEN` env var across monorepo

---

## To Pick Up on Local Desktop

1. `git pull origin claude/pedantic-ptolemy-w9zvv`
2. Review `docs/nordic-pcs-workflow-synthesis.md` for the full 11-database schema design
3. Review `docs/nordic-pcs-onboarding.md` for Sharon's team context
4. If working on the SQR-RCT app: `cp apps/nordic-sqr-rct/.env.local.example apps/nordic-sqr-rct/.env.local` and fill in secrets
5. `npm install && npm run dev:sqr-rct` to run locally

---

## Open Questions / Next Steps

- **PCS Notion views**: Schema is done but dashboards/views still need to be built in Notion
- **Supabase migration**: SQR-RCT flagged as candidate for migrating off Notion to Supabase (no work started)
- **SQR-RCT ↔ PCS integration**: No API bridge exists yet between the two systems
