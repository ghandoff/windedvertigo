# Handoff Notes — Cross-Environment Context

When Cowork or Claude Code finishes a significant session, drop a note here so the other environment picks up with full context. Most recent first.

---

## 2026-03-28 — ops auth fixed, hardened, design system integrated (Claude Code)

**What happened:**
- **Auth fix (critical):** Root cause — `page.tsx` was a `'use client'` static component. Next.js prerendered it at build time (`○`). On Vercel, static pages bypass middleware entirely (served from CDN). The middleware was correct but never ran. Fixed by converting to server component calling `auth()` → forces dynamic rendering (`ƒ`) → middleware now executes.
- Added sign-out button + user email display in header
- Made header date dynamic (was hardcoded "mar 28")
- Imported `@windedvertigo/tokens/index.css` — shared brand palette, semantic colors, spacing, typography, accessibility primitives
- Replaced all hardcoded hex colors with ops-specific CSS custom properties via `@theme inline`
- Removed unnecessary `'use client'` from 7 presentational components (now server components, smaller JS bundle)
- Simplified `tailwind.config.ts` — moved colors to CSS-native `@theme` block (Tailwind v4 pattern)
- Created 6 API routes: `/api/finance`, `/api/projects`, `/api/team`, `/api/calendar`, `/api/tasks`, `/api/dispatch`
- Extracted TypeScript interfaces to `lib/types.ts` (shared by components + API routes)

**What's deployed:**
- Auth-protected dashboard at ops.windedvertigo.com — redirects to /login if no session
- Google SSO with @windedvertigo.com domain restriction + ALLOWED_EMAILS allowlist
- Sign-out button + user email in header
- Dynamic date in header
- 6 API endpoints returning static data (ready for live data integration)
- Shared design tokens from `@windedvertigo/tokens`

**Middleware deprecation note:**
Next.js 16 warns `middleware.ts` is deprecated in favor of `proxy.ts`. The middleware still works for dynamic routes. CRM uses the same pattern. Not migrating yet — `proxy` convention is too new and the CRM would need to migrate simultaneously.

**Data layer architecture recommendation:**

The ops dashboard needs live data from QuickBooks, Gusto, Notion, and Google Calendar. The ops Next.js app should NOT hold OAuth tokens for these services — that's Cowork's job via MCPs.

**Recommended: Cowork dispatch → Cloudflare KV → Ops reads**

1. Cowork dispatch tasks (weekly-cfo-review, invoice-processor, etc.) already run on schedule with MCP access to QuickBooks, Gusto, Notion, GCal.
2. After each run, dispatch pushes a pre-computed "dashboard snapshot" JSON blob to Cloudflare KV (one key per data domain: `ops:finance`, `ops:projects`, `ops:team`, etc.).
3. Ops API routes read from KV at request time (sub-10ms). If KV key is empty/missing, return the static fallback from `lib/data.ts`.
4. Optional: a manual "refresh" button in the dashboard triggers an on-demand KV update via a dispatch task.

**Why this approach:**
- Cowork already has the MCPs and runs on schedule — no new auth tokens needed
- KV reads are fast and cheap — dashboard stays snappy
- Data freshness matches business cadence (daily invoices, weekly CFO review)
- Ops never needs direct access to QuickBooks/Gusto APIs
- Static fallback means the dashboard always renders even if KV is empty

**What needs doing next:**
- [ ] Verify OAuth flow in browser (Garrett: visit ops.windedvertigo.com incognito → should redirect to /login)
- [ ] Set up Cloudflare KV namespace for ops data
- [ ] Build Cowork dispatch task to push dashboard snapshot to KV after weekly-cfo-review
- [ ] Update API routes to read from KV with static fallback
- [ ] Connect wv-ops Vercel project to GitHub for auto-deploy on push

---

## 2026-03-28 — ops dashboard deployed (Cowork → Claude Code)

**What happened:**
- Built ops command center as new monorepo workspace (`ops/`)
- Configured Vercel project `wv-ops` with custom domain `ops.windedvertigo.com`
- Set up Auth.js v5 Google OAuth (shared with CRM)
- Cloudflare DNS CNAME added for ops subdomain
- Three deploys to fix build issues:
  1. First deploy failed: PostCSS config used Tailwind v3 syntax (`tailwindcss` as plugin)
  2. Second deploy failed: `globals.css` used `@tailwind` directives + `@apply` — Tailwind v4 needs `@import "tailwindcss"` and chokes on `@apply` with certain utility classes
  3. Third deploy succeeded after converting to plain CSS values

**What's deployed:**
- Login page with Google SSO button at ops.windedvertigo.com
- Dashboard shell with placeholder "awaiting data" cards
- Edge middleware checking session cookie for auth

**What needs doing next (Claude Code):**
- [ ] Verify Google OAuth flow works end-to-end (Garrett needs to test in browser)
- [ ] Address Next.js 16 middleware deprecation warning (`middleware.ts` → `proxy.ts`)
- [ ] Wire QuickBooks data into financial dashboard cards (API routes)
- [ ] Wire Gusto payroll data into team/payroll cards (API routes)
- [ ] Connect Vercel project to GitHub repo for auto-deploy on push
- [ ] Consider: should ops share Auth.js config with CRM via `packages/auth`?

**Key files:**
- `ops/lib/auth.ts` — Auth.js v5 config
- `ops/middleware.ts` — edge auth (deprecated convention, works for now)
- `ops/app/globals.css` — Tailwind v4 with `@import "tailwindcss"`
- `ops/postcss.config.mjs` — uses `@tailwindcss/postcss`
- `scripts/deploy-ops.sh` — Vercel deploy script

**Vercel env vars (set in dashboard, not in repo):**
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, AUTH_SECRET, AUTH_TRUST_HOST, AUTH_URL, ALLOWED_EMAILS

**Commits:**
- `5da6b98` — feat(ops): add ops command center as monorepo workspace
- `f4db54e` — fix(ops): use @tailwindcss/postcss for Tailwind v4
- `37d14a2` — fix(ops): use Tailwind v4 CSS import and remove @apply directives
