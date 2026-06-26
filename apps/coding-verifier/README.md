# coding-verifier — evidence verification console

a small, password-gated internal tool for adjudicating **double-coded research
claims**. each queue item carries the two blind coder excerpts (plus an optional
cARL direct-read excerpt) and the source location; the app keeps a running tally
of claims and adjudications, and writes an append-only audit trail.

built for the **amna at 10** desk review, but the `engagement` field makes it
reusable for future desk reviews.

## data governance

- holds **aggregate evaluation excerpts only** — quotes from evaluation
  summaries/conclusions, source-file names, and page references.
- **no participant-level or special-category data** is stored, and none is
  imported by the seed.
- the app cannot open local Drive files — it shows the source file path + page so
  a named human opens it and confirms the quote verbatim (the ✅ gate). an
  optional `drive_link` field can hold a share URL.
- d1 primary region: **western europe (`weur`)** requested at create time; the
  actual region is recorded here after creation if CF cannot honour the hint.

## stack

- cloudflare worker (`src/index.js`, vanilla js) — routes `/tools/coding-verifier/*`
- d1 (sqlite) — `claims` + `audit_log`
- static front-end (`assets/index.html`, single file, no build step)
- auth: shared password (worker secret `APP_PASSWORD`) + signed-cookie session
  (HMAC over `SESSION_SECRET`). reviewer (garrett / jamie) is stamped on every
  action — it is attribution, not a security boundary.

modelled on `apps/ppcs-impact` (same worker + d1 + assets-binding shape).

## routes

| method | path | purpose |
|---|---|---|
| POST | `/api/login` | check password, set `cv_session` cookie |
| GET | `/api/logout` | clear session |
| GET | `/api/session` | is the cookie valid? |
| GET | `/api/claims?status=&engagement=` | list (pending first) |
| GET | `/api/claims/:id` | single claim + its audit trail |
| POST | `/api/claims/:id/verify` | `{ reviewer }` → verified |
| POST | `/api/claims/:id/flag` | `{ reviewer, note }` (note required) → flagged |
| POST | `/api/claims/:id/adjudicate` | `{ reviewer, ruling, chosen? }` → adjudicated |
| GET | `/api/stats` | dashboard tally |
| GET | `/api/export?format=csv\|json` | full dump for the methods log |

## first-time setup (each step needs explicit approval)

> **merged ≠ deployed.** committing this code does not make it live. nothing below
> runs until approved; CI does **not** auto-deploy this app.

```bash
cd apps/coding-verifier
npm install

# 2 · create the d1 database (eu primary)
npx wrangler d1 create wv-coding-verifier --location weur
#   → copy the printed database_id into wrangler.jsonc (replaces PENDING_CREATE)

# 3 · apply the schema
npm run db:init

# 4 · load the seed (review seed.json first)
npm run db:seed

# 5 · set the secrets (you choose the password; it never enters the repo)
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET   # a long random string

# 6 · confirm the route in the cloudflare dashboard, then deploy
npm run deploy
```

verify live:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://windedvertigo.com/tools/coding-verifier/
```

## local development

```bash
npm run db:init:local      # schema into the local sqlite
npm run db:seed:local      # seed into the local sqlite
npx wrangler dev           # serve at http://localhost:8787/tools/coding-verifier/
```

for local dev, set `APP_PASSWORD` and `SESSION_SECRET` in a `.dev.vars` file
(gitignored) so login works without remote secrets.

## schema

see `migrations/0001_init.sql`. `claims` holds the queue (status: pending →
verified / flagged / adjudicated); `audit_log` is append-only — never overwritten.
