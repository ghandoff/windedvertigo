# wv-ppcs-impact — Security & GDPR review (D1 architecture)

*Review date: 4 Jun 2026 · scope: the live dashboard wiring after migration off Supabase to Cloudflare D1.*

## Method
Inspected the deployed data path end to end: the D1 database contents and table list,
the Worker source (`src/index.js`), `wrangler.toml`, the static bundle (`public/index.html`),
and the repo for stray secrets. Findings below are from direct inspection, not assertion.

## Verified properties (hardened)
1. **No personal data online.** D1 holds two tables — `metrics` (one aggregate-JSON row) and
   Cloudflare's internal `_cf_KV`. The stored JSON contains **no `@`, no "email", and no names** —
   only counts, percentages, and theme labels (verified by query). Re-identification from these
   aggregates is not feasible.
2. **No credentials anywhere in the live path.** The Worker reaches D1 through an account-scoped
   binding — there is no service key, connection string, or password in `src/index.js`,
   `wrangler.toml`, the bundle, or the browser. (This removes the prior model's dependency on a
   Hyperdrive-stored DB password entirely.)
3. **No injection surface.** `/api/metrics` runs a single fixed statement
   (`select v from metrics where k = 'current'`) with **no user input** interpolated. No other
   routes touch the database.
4. **Single, minimal data surface.** The Worker exposes exactly one data endpoint returning the
   aggregate JSON; everything else is static assets. There is no table-listing, no row API, no
   `private` schema (there is no private data at all).
5. **Unlisted + edge-cached.** `public/index.html` carries `noindex, nofollow`; `/api/metrics` is
   cached at the edge for 10 minutes (also a light DoS buffer).
6. **Repo hygiene.** Added `.gitignore` (excludes `node_modules/`, `.wrangler/`, `supabase/.temp/`,
   `.DS_Store`, `metrics.json`, `scripts/_update.sql`) so caches/refs aren't committed if this is
   pushed to a public repo. No secrets were found in the bundle regardless.

## Residual risks & required actions
| # | Item | Severity | Action |
|---|------|----------|--------|
| A | **The old Supabase project `wv-ppcs` still exists** and still holds the full PII (names, emails, IPs, chat/Commons text) in West-US. Until deleted, the GDPR footprint is unchanged despite the dashboard migration. | **High (until done)** | Delete the Supabase project in the console. This is the single most important GDPR action. |
| B | **Stale Hyperdrive config** `097b7e8f…` holds a `dashboard_reader` connection string to that DB. | Medium | `wrangler hyperdrive delete 097b7e8fc95a4a739a41279eefadc2df` after the D1 deploy is verified. |
| C | **Offline PII store** (`Engagement Evidence/…/PPCS2026_engagement.db` + the Drive folder) holds all identifiers and free-text. | Governance | Restrict Drive access to the wv/PRME team; set a retention/deletion schedule tied to consent; document the lawful basis. Erasure now only needs to touch this one store. |
| D | `/api/metrics` is world-readable (aggregates only). | Low / acceptable | Optional: restrict CORS/referrer to the dashboard origin. Not required — no personal data. |

## GDPR posture (Art. references)
- **Data minimisation (Art. 5(1)(c)) & by design (Art. 25):** the online surface now serves only
  anonymous aggregates — a substantial improvement over hosting pseudonymised PII. Strong.
- **Anonymisation vs pseudonymisation:** the dashboard data is effectively **anonymous** (no key,
  no re-identification path from counts), so the online surface arguably falls outside personal-data
  scope. The *offline* engagement DB remains personal data and is the locus of all GDPR obligations.
- **Storage limitation (Art. 5(1)(e)):** define a retention period for the offline store (item C).
- **Right to erasure (Art. 17):** simplified — there is no online PII to purge; erasure touches only
  the offline DB / Drive.
- **International transfers (Ch. V):** the West-US residency concern that applied to the Supabase PII
  is **moot for the dashboard** (no PII online). It remains relevant only to where the offline store
  lives (Google Drive, US) for EU data subjects — confirm a lawful basis/transfer mechanism there.

## Verdict
The live D1 dashboard wiring is **hardened and low-risk** — no PII, no credentials, no injection
surface, minimal endpoint. The migration's GDPR benefit is only fully realised once the **Supabase
project is deleted (action A)** and the **Hyperdrive config removed (action B)**; the remaining
obligations sit with the **offline** evidence store (action C), which is data-governance, not a
wiring vulnerability.
