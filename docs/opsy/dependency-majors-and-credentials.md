# Dependency majors + monitoring credentials — follow-up plan
_compiled by Opsy, 2026-06-30. Companion to the 2026-06-29 weekly dependency review._

Three "optional leftover" tracks. **wrangler is done** (staged); the **majors are deliberately not auto-bumped** (all break live functionality and can't be tested in the sandbox); the **credentials are yours to add** (sensitive tokens — Opsy can document but not set them).

---

## 1. harbour-apps wrangler — DONE (staged, needs your install + commit)

All 23 harbour-apps worker pins bumped `→ ^4.105.0` (were mostly `^4.81.1`, a few `^4.0.0`/`^4.92.0`). Same safe HIGH-severity bump already applied to the wv workers.

Finish + lock it in (commit promptly — uncommitted edits get wiped by branch switches):
```
cd ~/Projects/harbour-apps
npm install
git add -A
git commit -m "chore: bump wrangler to 4.105.0 across harbour-apps workers"
```
If `npm install` leaves the resolved version behind (it was conservative on the wv side), force it:
```
npm install wrangler@4.105.0 --save-dev --workspaces
```

---

## 2. SDK + stripe majors — assessment (do NOT blind-bump)

All three break live code. Recommended order: **stripe + anthropic-sdk first** (mechanical, lower risk, clears most remaining HIGH findings), **AI SDK 7 last and on its own** (highest risk — it's the wv-claw agent core).

### A. `ai` 6→7 + `@ai-sdk/anthropic` 3→4 — port / wv-claw — **HIGH risk**
Current: `ai ^6.0.174`, `@ai-sdk/anthropic ^3.0.74`. Bump together (same release train). Breaking changes that matter here:
- **ESM-only** — `require()` unsupported; port needs `"type": "module"` or `.mjs`. Node 22+.
- **Stream helpers moved** — `result.toUIMessageStreamResponse()` / `toTextStreamResponse()` deprecated → top-level `createUIMessageStreamResponse` / `createTextStreamResponse`.
- **Tool approval moved** — `needsApproval` on `tool()` → `toolApproval` on `generateText`/`streamText`/`ToolLoopAgent`; `experimental_customProvider` → `customProvider`.
- **`experimental_prepareStep` removed** → use `prepareStep`.
- **System-message handling changed** — set `allowSystemInMessages: true` to keep older persisted chats working.
- **OpenTelemetry** → `@ai-sdk/otel`, registered globally.
- Official **v7 codemods** automate most renames/imports; the runtime/ESM/approval/stream/multi-step semantics need a manual pass.
- **Plan:** dedicated branch → run codemods → manual review → smoke-test wv-claw end-to-end (tool loops, streaming) before merge. Don't pair with other changes.

### B. `@anthropic-ai/sdk` drift in harbour-apps — **MEDIUM risk**
`depth-chart` 0.52, `rubric-co-builder` 0.52, `vertigo-vault` 0.73 → latest ~0.106 (port is already on 0.96). These are pre-1.0; the messages/tool-use API shifted a lot across 0.5x→0.7x→0.9x, so the old apps may already be silently broken. No single migration guide (pre-1.0 churn).
- **Plan:** align all three to one version (matching port's `0.96` minimises surface, or go to latest) → smoke-test each app's Claude calls, especially any tool-use. Low-medium effort per app.

### C. `stripe` 17→22 in harbour-apps (9 apps) — **MEDIUM risk (payment code)**
9 apps on `^17.x` (`packages/stripe` is a loose `>=14`) → 22.x. Mostly mechanical per the v22 guide:
- TS types now compiler-generated — remove any `/// <reference types="stripe/types" />`; `Stripe.errors.StripeError` is no longer a type (use `typeof …` / `Stripe.ErrorType`).
- Callback-style service methods removed (use async/await — you likely already do); no API-key/host args to service methods; per-request host override removed (set in client config).
- The SDK's pinned Stripe **apiVersion** bumps — check for any hardcoded `apiVersion`.
- **Plan:** bump `packages/stripe` + the 9 apps together → regenerate types → test checkout/webhook flows in **Stripe test mode**. Stripe ships an upgrade codemod/skill that handles most of it.

> Neon (`@neondatabase/serverless`) and Notion (`@notionhq/client`) in port are already on current majors (v1 / v5) — no action.

---

## 3. Surface the 6 locked monitoring checks — your action (sensitive tokens)

Add each as a **Secret** on the **wv-port** worker (Cloudflare → wv-port → Settings → Variables and Secrets — the page you used for `GOOGLE_IMPERSONATE_SUBJECTS`). Use **least-privilege / read-only** scopes — these are for monitoring only. Exact env names are what Opsy's health check reports as "awaiting credential":

| Check | Secret name(s) | Where to get it | Scope |
|---|---|---|---|
| **cf-worker-analytics** | `CLOUDFLARE_API_TOKEN` | CF → My Profile → API Tokens → Create | Account Analytics:Read + Workers Scripts:Read. **Also unblocks the wv-site KV cache fix** — highest-value, do first. |
| **stripe-webhooks** | `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (use a **Restricted key**) | Read-only on Events/Webhooks. Payments currently unmonitored — high value. |
| **supabase-nordic** | `SUPABASE_NORDIC_URL`, `SUPABASE_NORDIC_SECRET_KEY` | URL = `https://nzdfpfrnilreqzmthpui.supabase.co` (confirmed); key from Supabase → that project → Settings → API → service_role/secret key | service_role (server-side). NB: this "nordic" project actually holds the PPCS tables. |
| **vercel-deployments** | `VERCEL_API_TOKEN` | Vercel → Account Settings → Tokens → Create | Scope to the team; read is enough. Watches nordic's deploys. |
| **github-actions** | `GITHUB_TOKEN` | GitHub → Settings → Developer settings → Fine-grained PAT | Read-only: Actions + Contents. |
| **neon-pools** | `NEON_API_KEY` | Neon console → Account Settings → API Keys → Create | Read-only. Would also confirm whether supabase-pilot slowness is pool saturation. |

Once added (a redeploy applies them), the next health check picks them up and those six stop showing as skipped — closing the visibility gaps the weekly digest keeps flagging.
