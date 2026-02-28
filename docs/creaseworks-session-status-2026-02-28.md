# Creaseworks Session Status — 2026-02-28

## What Was Done This Session

### 1. Migrations 028–033 Prepared & Partially Applied
- **028** (reflection_credits) and **029** (photo_consents) — applied to Neon ✅
- **030** (leaderboard), **031** (tinkering_tier), **032** (cover_images), **033** (stripe_price_id) — scripts ready, **not yet applied** to Neon
- Migration 033 fixes a critical checkout bug: `packs_catalogue.stripe_price_id` column didn't exist but the checkout route referenced it

### 2. Checkout Flow Fix
- Added `stripe_price_id TEXT` column to `packs_catalogue`
- Populated all 6 pack prices (test mode):
  - classroom starter → `price_1T5EZ2D50swbC2DglU1gwqio` ($4.99)
  - new baby sibling → `price_1T5EZ3D50swbC2Dgl1hyJoy5` ($4.99)
  - rainy day rescue → `price_1T5EZ4D50swbC2DgddSTnMgt` ($4.99)
  - summer play camp → `price_1T5EZ5D50swbC2DglQtrSnbg` ($4.99)
  - the whole collection → `price_1T5EZ6D50swbC2DgpaTfaJ3N` ($14.99)
  - co-design essentials → `price_1T5bqmD50swbC2DgkKdiEHwH` ($49.99)

### 3. End-to-End Smoke Test
- `scripts/smoke-test.mjs` — tests 29 routes (public, protected, admin, API)
- Validates HTTP status codes, `<title>` tags, and `og:title` meta tags
- Run: `node apps/creaseworks/scripts/smoke-test.mjs [base-url]`

### 4. SEO Metadata Pass
Added `export const metadata: Metadata` to 10 routes:
- packs, playbook, community (with openGraph)
- gallery (with openGraph), profile, checkout/success
- playbook/portfolio, playbook/reflections, reflections/new, admin

Routes that already had metadata (9): /, /login, /onboarding, /matcher, /sampler, /scavenger, /admin/campaigns, /admin/invites, /campaign/[slug]

Routes skipped (redirect-only, no metadata needed): /team, /runs, /playbook/runs, /runs/new

### 5. Error Boundaries
Created 7 route-specific `error.tsx` files:
- packs, playbook, profile, admin, checkout, gallery, community
- Consistent pattern: contextual heading, reassuring copy, dev-only error display, try again + contextual fallback link
- Pre-existing: global `error.tsx` at app root

### 6. Docs Reorganization
- Moved `CLAUDE.md` from repo root to `docs/`
- All planning/research docs now live in `docs/`:
  - creaseworks-engagement-system.md
  - creaseworks-paywall-strategy.md
  - creaseworks-image-sync-scope.md
  - creaseworks-audit-2026-02-27.md
  - notion-database-map.md
  - Creaseworks-Neurodiversity-Design-Guide.docx
  - creaseworks-ui-ux-critique.docx

---

## Outstanding / Pending

### Migrations 030–033 Need to Be Applied
Run from monorepo root:
```bash
node apps/creaseworks/scripts/apply-migrations-028-032.mjs
```
Requires `DATABASE_URL` env var pointing to Neon. The script skips already-applied migrations (028/029) and applies 030–033.

### Smoke Test Needs a Run
After starting dev server:
```bash
node apps/creaseworks/scripts/smoke-test.mjs
# or against production:
node apps/creaseworks/scripts/smoke-test.mjs https://creaseworks.windedvertigo.com
```

### Wave 3 Plan (from magical-brewing-hummingbird.md)
- **Phase 1**: Admin playdate preview with pack-based filter toggles — not started
- **Phase 2**: Profile "your journey" redesign with owned packs + recommendations — not started
- **Phase 3**: Engagement system sprint 1 (credits foundation) — DB tables ready (pending migration), queries/UI not started
- **Phase 4**: Engagement system sprint 2 (photo consent + upsells) — not started

---

## Learnings & Gotchas

### 1. Neon Serverless Driver: One Statement Per HTTP Call
`@neondatabase/serverless` sends one SQL statement per HTTP call. Multi-statement SQL files must be split before execution. The `splitStatements()` function must strip `--` comments **before** splitting on `;` because semicolons inside comments cause false splits.

### 2. VM Sandbox Has No Outbound Network
This Claude sandbox cannot make HTTP calls to external services (Neon, Vercel, Stripe, etc.). All scripts that require network access must be run by the user locally. Scripts and migrations can be prepared here but executed outside.

### 3. Next.js Metadata API
- Root layout uses `title: { template: "%s — creaseworks", default: "creaseworks" }`
- Route pages export `metadata: Metadata` for static routes or `generateMetadata()` for dynamic ones
- The template means route metadata only needs the page-specific part (e.g., `title: "packs"` becomes "packs — creaseworks")

### 4. Error Boundary Pattern
- Must be `"use client"` components
- Receive `{ error, reset }` props where `reset()` re-renders the route segment
- Development-only error display via `process.env.NODE_ENV === "development"`
- Brand colors use CSS custom properties: `var(--wv-redwood)`, `var(--wv-cadet)`, etc.

### 5. Working Directory Convention
All terminal commands should run from the **windedvertigo monorepo root** (`windedvertigo/`) to support work across all three projects:
- `apps/creaseworks/` — creaseworks platform
- `apps/site/` — windedvertigo.com static site
- `apps/nordic-sqr-rct/` — nordic SQR-RCT project

---

## Key IDs Reference

### Pack IDs (Postgres UUID)
| Pack | ID |
|------|-----|
| classroom starter | `91753e91-54eb-43ad-a9ab-e4fdc015ae08` |
| co-design essentials | `b535a022-90c0-4e14-b92b-54a43e7aac76` |
| new baby sibling | `36f5e2d2-39f8-4fa5-8419-8435a19f5023` |
| rainy day rescue | `9419aa6d-7fc2-4699-a78d-cbf8547c0fee` |
| summer play camp | `03eaa0b6-c4fa-4fb2-b16e-69970e4f9910` |
| the whole collection | `9f5e9e28-4ab9-4553-8697-88eb80656a91` |

### Notion DB IDs
- Playdates: `b446ffd5-d166-4a31-b4f5-f6a93aadaab8`
- Packs: `beb34e7b-86cd-4f20-b9be-641431b99e5f`

### Vercel
- Team: `team_wrpRda7ZzXdu7nKcEVVXY3th`
- creaseworks: `prj_EoDpRvw1kdAqcGVrcaYclfWFeX7b`
- windedvertigo-site: `prj_k02f1LutCsQLZEDIyM2xYJ1PGPCx`
- nordic-sqr-rct: `prj_laAl3qm5w20CrtIjO2klc9dj180z`

### Git
- HEAD: `c1fd22c` on `main`
- Repo: `ghandoff/windedvertigo` (GitHub → Vercel auto-deploy)
