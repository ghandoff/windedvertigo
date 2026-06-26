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
- auth: **google sign-in** restricted to the `windedvertigo.com` workspace. the
  worker runs the oauth code flow itself (no cloudflare access dependency); the
  google "internal" consent screen limits sign-in to the org, and the worker
  re-checks the `hd` claim. the **signed-in email is the reviewer**, recorded
  server-side on every action — it cannot be asserted by the client.

modelled on `apps/ppcs-impact` (same worker + d1 + assets-binding shape).

## auth — google oauth (windedvertigo.com only)

- one **google oauth client** (web application), consent screen **internal**, with
  authorised redirect uri `https://windedvertigo.com/tools/coding-verifier/api/auth/callback`.
- config: `GOOGLE_CLIENT_ID` (a `vars` entry — not sensitive) + secrets
  `GOOGLE_CLIENT_SECRET` and `SESSION_SECRET`.
- to add/remove reviewers: nothing here — anyone with a `@windedvertigo.com`
  google account can sign in. (narrow it later by switching to an explicit
  allowlist in the worker or a cloudflare access policy.)

## routes

| method | path | purpose |
|---|---|---|
| GET | `/api/auth/login` | redirect to google (signed csrf state) |
| GET | `/api/auth/callback` | exchange code, verify claims, set `cv_session` |
| GET | `/api/logout` | clear session |
| GET | `/api/session` | `{ ok, email }` |
| GET | `/api/claims?status=&engagement=` | list (pending first) |
| GET | `/api/claims/:id` | single claim + its audit trail |
| POST | `/api/claims/:id/verify` | → verified (reviewer = session email) |
| POST | `/api/claims/:id/flag` | `{ note }` (required) → flagged |
| POST | `/api/claims/:id/adjudicate` | `{ ruling, chosen? }` → adjudicated |
| GET | `/api/stats` | dashboard tally |
| GET | `/api/export?format=csv\|json` | full dump for the methods log |

## first-time setup (each step needs explicit approval)

> **merged ≠ deployed.** committing this code does not make it live. nothing below
> runs until approved; CI does **not** auto-deploy this app.

```bash
cd apps/coding-verifier
npm install

# 2 · create the d1 database (eu primary)        — DONE: wv-coding-verifier (WEUR)
npx wrangler d1 create wv-coding-verifier --location weur

# 3 · apply the schema                            — DONE
npm run db:init
# 3b · relax reviewer (enum → any email) for org-wide google sign-in
npx wrangler d1 execute wv-coding-verifier --remote --file=migrations/0003_relax_reviewer.sql

# 4 · load the seed (review seed.json first)       — DONE
npm run db:seed

# 5 · oauth config + secrets
#   set GOOGLE_CLIENT_ID in wrangler.jsonc vars (from the google oauth client)
npx wrangler secret put GOOGLE_CLIENT_SECRET --name wv-coding-verifier
npx wrangler secret put SESSION_SECRET --name wv-coding-verifier   # already set

# 6 · deploy
npm run deploy
```

verify live (signed out, expect the sign-in page + json gates):

```bash
B=https://windedvertigo.com/tools/coding-verifier
curl -s -o /dev/null -w "page %{http_code}\n" $B/
curl -s $B/api/session            # {"ok":false,"email":null}
curl -s $B/api/claims             # {"error":"unauthorised"}
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
