# Wave 7.3.0 — Email-as-Key Migration

> **Status:** Planning artifact — no application code.
> **Author:** Claude (synthesis), Garrett (direction).
> **Date:** 2026-04-22
> **Sits within:** `docs/plans/wave-7-master-architecture.md` §2.6, §3.2, §3.3.
> **Dependencies (shipped):** Wave 7.0.7 (dual-token access/refresh, bcrypt backfill, forced-reset flow), Wave 7.1 (capabilities scaffold).
> **Gates:** Wave 7.2.0 Shared Workspace Shell. Wave 7.3.1 `/login` + magic links. Wave 7.4 Role-aware sidebar.

---

## §1. Context — why this wave, why now

Wave 7 reshapes the workspace around **one door, many roles**. The shape of that door — magic links for external reviewers, email + password for internal users, 2FA for super-user — assumes a **single, stable, deliverable identifier** on every user record. That identifier has to be email. You cannot send a magic link to an alias.

Today the Reviewers DB (`b74c6186-d782-4499-85ac-3dee528a1977`, data source `020a7d2e-1123-43a3-b90d-68f518c9787a`) treats **`Alias`** as the uniqueness contract. Login resolves `alias → reviewer` and issues a JWT whose primary identity claim is also `alias`. Every sensitive code path — `authenticatePcsWrite`, admin checks, `parseReviewerPage`, `/api/auth/login`, `/api/auth/register`, the JWT claim set — is alias-keyed.

The master plan §2.6 calls this out explicitly: **email migration ships first**, before any magic-link or 2FA code is written, because the auth redesign cannot land on an identifier the data layer doesn't yet guarantee. The master plan §3.3 goes further and names this the "single most-likely-to-slip step" in Wave 7 — not because it is technically hard but because it **touches every user record and cannot be rolled forward if data is mis-backfilled**. A wrong email binding locks a user out of their own account. That failure mode is why this wave gets a dry-run step, a confirmation banner, and a one-week burn-in before 7.2.0 is allowed to start.

The product consequences of **not** doing this wave first are concrete:

- **No magic links.** The entire 7.3.1 login redesign for external reviewers (`/invite/{token}`, password-optional, one-click return from email) depends on a unique, present, deliverable email on every reviewer row. Skipping 7.3.0 means either shipping a half-broken magic-link flow or delaying 7.3.1 while we scramble to audit the Reviewer DB mid-flight.
- **No role-aware sidebar.** Wave 7.4 reads from `user.capabilities` (Wave 7.1 shipped) but it also needs a stable per-user localStorage namespace for sticky role preferences and collapsed-section state. That namespace is email-scoped, not alias-scoped, because alias is mutable (display name) and email is not.
- **No 2FA enrollment.** TOTP/WebAuthn factors bind to the user's primary identifier. Super-user 2FA (master plan §2.1) cannot be enrolled against a mutable alias.
- **No SSO / Okta / Azure AD ever.** Every enterprise IdP in existence expects `email` as the unique subject claim. Alias-keyed identity forecloses the option.

Wave 7.3.0 removes that foreclosure. It is reversible end-to-end; the only downstream irreversible step is Wave 7.2.0's decision to stop writing the alias claim. 7.3.0 itself can be rolled back up until that point.

---

## §2. Problem statement

Current auth trusts `alias` as the uniqueness key on the Reviewers DB. That assumption fails in three named ways:

1. **Alias collisions.** Nordic has one Research team (Sharon, Gina, Adin, Lauren) and two incoming RAs. As reviewers grow (Wave 8 community of practice is 30–50 external reviewers), first-name collisions are inevitable. `sharon` today, `sharon2` tomorrow, `sharon-k` next year. There is no way to say "this is the Sharon who scored that study in 2024" without a stable secondary key, and alias is not that key because users rename themselves.
2. **Magic-link infrastructure needs a deliverable identity.** Magic links are `email → token → session`. You cannot mail an alias. If `reviewer.email` is empty or wrong, the magic-link flow silently fails and the reviewer has no path to recovery that does not involve Garrett editing a Notion row by hand.
3. **SSO / IdP integration is foreclosed.** Nordic may eventually want internal users to sign in via the corporate IdP (Okta, Azure AD, Google Workspace for `@nordicnaturals.com`). Every IdP binds on email. A migration to email-as-key today is a no-regret move; a migration three years from now, with 50 reviewers and thousands of scores linked to alias, is a wire-and-splice job.

There is also a silent fourth failure mode: **audit log legibility.** Today's audit entries carry alias; when a reviewer renames, the audit log becomes a slowly-rotting record of "who-was-`sharon`-when". Email is stable; alias is display-name.

The fix is **not** to delete alias. Alias stays as display-name-on-rubric (the pseudonymization shield between the reviewer's real identity and the scored study). The fix is to stop treating alias as the uniqueness contract and promote email to that role.

---

## §3. What changes

Short version, before the phases:

- **Email becomes the unique-indexed column** on Reviewers — enforced by `createReviewer()` and `updateReviewerProfile()` with a pre-write duplicate check (Notion does not enforce DB-level uniqueness; we enforce it in code).
- **Alias stays unchanged** as display-name-on-rubric. Everywhere the rubric shows "scored by ___", alias still goes there. Alias remains rich_text; no new uniqueness constraint on it.
- **Login accepts email OR alias.** The `/api/auth/login` payload field gets a schema widening: `{ identifier, password }` where `identifier` is email-or-alias, with email preferred when present. A deprecation banner on the login page tells users "use your email going forward; alias login will be removed after Wave 7.5".
- **JWT claim set adds `email`**, additive, alongside `alias`. Nothing reads `email` from the JWT in 7.3.0 — the claim is seeded now so downstream waves (7.2.0, 7.3.1) can consume it without another auth round-trip.
- **New `Email confirmed at` date column** on Reviewers. Written by the Email Confirmation Banner (see §4.3) when a user accepts or supplies their email on next login. This is the audit trail that says "this user has seen the new model and has an email we trust for magic links".
- **New `getReviewerByEmail()` helper** in `src/lib/notion.js`, mirroring `getReviewerByAlias()`.
- **Audit hooks** emit a `email.migration.*` event at every phase boundary.

No URL changes. No UI changes except the banner. No capability changes. The route handlers add a lookup path; they do not change their contract.

---

## §4. Migration phases

Phased carefully. Each phase is independently shippable and individually reversible. Nothing in this wave burns a bridge until the burn-in window (§4.7) closes clean.

### 4.1 Phase 7.3.0a — Read-only audit

Ship a **pure read** diagnostic script: `scripts/audit-reviewer-emails.mjs`. No writes, no mutations, no state changes. It fetches every Reviewer row and emits a diff report covering:

- Rows missing email entirely (`email == null` or empty string).
- Rows with duplicate emails (same email on two or more Reviewer pages).
- Rows with malformed email values — no `@`, no domain, trailing whitespace, contains comma (the `@vercel/blob` sanitizer from Wave 3.6 caught commas in select-option values; emails deserve the same skepticism), contains uppercase in domain (will collide with a lowercase peer after normalization).
- Rows where `email` and `alias` look reversed (`alias` looks like an email; `email` looks like a display name). Low confidence but worth surfacing.
- Rows where email domain is `@nordicnaturals.com` but alias does NOT match the email local-part (suggests someone renamed without updating the email, or vice versa).

**Output:** stdout summary + JSON file at `tmp/audit-reviewer-emails-<ISO>.json` with a row-by-row dump for human review.

**Success criterion:** the report generates without error, and Garrett + the affected user (if any) can read it and agree on what to do about each flagged row.

**Effort:** ~2 hours (script + first dry-run).

### 4.2 Phase 7.3.0b — Resolve ambiguities

Human phase, not a code phase. Garrett and whoever-is-affected (probably 1–5 rows given the current 6-reviewer population) reconcile the audit report:

- For each missing email: is the user reachable? What email do they want to use? For internal users, is it `first.last@nordicnaturals.com`?
- For each duplicate: which row is canonical? The other gets deprecated (not deleted — we preserve historical score attribution) via a `Deprecated at` marker. Two reviewers who legitimately share a mailbox is an open question for §8.
- For each malformed: correct in-place via Notion UI or via a one-shot patch run of the backfill script with `--confirm --reviewer-id=<page_id>`.

**Output:** a clean audit run — zero missing, zero duplicates, zero malformed.

**Effort:** highly variable, realistically 1–4 hours of conversation + Notion edits.

### 4.3 Phase 7.3.0c — Email Confirmation Banner

Ship a one-time banner that appears on next login for any user whose row satisfies **any** of:

- `email` is empty.
- `emailConfirmedAt` is null.
- `email` looks malformed (client-side light check: contains `@`, contains `.` after the `@`, no whitespace).

The banner is **blocking** — the user cannot navigate past it until they confirm or supply their email. This is the catch-net for any reviewer who slipped through 4.1/4.2 and for any brand-new registration between 4.2 and 4.7.

Banner copy (draft; Garrett to finalize):

> **We need to confirm your email before you keep going.**
> Nordic Research is moving to email-based sign-in. This is the email we'll use for your magic-link invitations, password resets, and future sign-in.
> **Email:** [_________________________]
> [ Confirm email ]

On submit, the banner calls a new endpoint `/api/auth/confirm-email` which:

1. Re-validates the email server-side (proper shape, not already claimed by a different reviewer).
2. Updates the reviewer's `Email` property if it changed.
3. Stamps `Email confirmed at = now()`.
4. Emits an audit event `email.migration.confirmed`.
5. Returns `{ ok: true }` and the banner dismisses.

**Component location:** `src/components/auth/EmailConfirmationBanner.js`. Mounted in whatever layout wraps authenticated routes today (pre-Wave-7.2.0, that's the per-surface layout — add it to both `src/app/layout.js` and `src/app/pcs/layout.js` via a small shared wrapper).

**Effort:** ~4 hours (component + endpoint + test).

### 4.4 Phase 7.3.0d — Uniqueness constraint in code

Notion does not enforce DB-level uniqueness. We enforce it in the write helpers:

- `createReviewer(data)` — before the `pages.create` call, query by `Email` (exact match, case-insensitive). If any hit, throw `EmailAlreadyInUseError`. The `/api/auth/register` route catches this and returns a 409 with a helpful message.
- `updateReviewerProfile(reviewerId, patch)` — if `patch` includes an `email` change, query by the new email. If a hit exists AND the hit is a different page id, throw `EmailAlreadyInUseError`.
- `/api/auth/confirm-email` — same pre-write check.

The check is **last-write-wins unsafe** against a racing concurrent write — two simultaneous registrations with the same email could both pass the pre-write query and both write. Acceptable given Nordic's write volume (handful of registrations per week at most) and the backstop that the next login audit would catch the duplicate. If we ever need stricter, Wave 7.3.1's magic-link email send itself is a synchronization point.

**Effort:** ~3 hours (helpers + error class + test + update call sites).

### 4.5 Phase 7.3.0e — Email login path

Widen `/api/auth/login` input schema:

- Accept `{ identifier, password }` where `identifier` is a string.
- Also accept legacy `{ alias, password }` — map to `identifier = alias`.
- Lookup: if `identifier` contains `@`, try `getReviewerByEmail(identifier)` first; fall back to `getReviewerByAlias(identifier)`. Otherwise try alias first, then email.
- Everything else — password check, bcrypt migration, reset-grant flow, dual-token issue — stays identical.

On the client side (the login form in `src/app/page.js` until 7.3.1 extracts it), rename the field from "Alias" to "Email or alias" with a small subtitle "Use your email going forward — alias login will retire in a future update". The form field name stays `alias` in the request body for the legacy path; a new field `identifier` takes precedence if present.

**Effort:** ~2 hours.

### 4.6 Phase 7.3.0f — JWT claim expansion

`signAccessToken()` in `src/lib/auth.js` adds `email` to the claim set alongside the existing `alias`. Everywhere we today issue a token (`/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`), read the reviewer's email from the source record and thread it in.

No consumer reads `email` from the JWT in 7.3.0. The claim is seeded for Wave 7.2.0 + 7.3.1 to consume. `alias` stays in the claim for the full duration of Wave 7 — do not remove it; only Wave 7.5 removes alias-based gates.

**Effort:** ~1 hour (three call sites + test that decoded token contains email).

### 4.7 Phase 7.3.0g — One-week burn-in

No new code. One week in production, observing:

- Login-failure rate (expect flat or down).
- Banner-dismissal rate (expect convergence toward 100% of MAU in week 1).
- Zero occurrences of `EmailAlreadyInUseError` in audit log after the first 48 hours (if we see any, a duplicate slipped through 4.2).
- Zero reports of user-side confusion about the banner.

If any of the four go sideways, we pause the gate on 7.2.0 and triage before proceeding. If all four are clean, Wave 7.2.0 starts.

**Effort:** zero engineering. A Friday-afternoon check for four consecutive Fridays.

---

## §5. Schema deltas

Minimal — the heavy lifting is code and data, not schema.

### Reviewers DB (`b74c6186-d782-4499-85ac-3dee528a1977`, data source `020a7d2e-1123-43a3-b90d-68f518c9787a`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `Email` | Email *(already exists)* | — | No schema change. Uniqueness enforced in code (see §4.4). |
| `Email confirmed at` | Date *(new)* | `null` | Written by `/api/auth/confirm-email` when the user confirms via the banner. Null means "user has not yet seen the new model". |
| `Alias` | Rich text *(already exists)* | — | Unchanged. Remains the display-name used on rubric scoring. No uniqueness constraint added or removed. |

No column deletions. No type changes. The `Email` column was already email-type — we are promoting it to primary key conceptually, not schema-wise.

### Notion enforcement notes

Notion databases don't have DB-level unique constraints — neither does the `Email` property type inherently enforce uniqueness within the DB. This is the same limitation every Notion-backed app hits. Our mitigations:

1. **Pre-write query** in every code path that writes email (§4.4).
2. **Post-write audit** — `scripts/audit-reviewer-emails.mjs` is idempotent; run it on a weekly cron (or as part of the weekly review ritual) and alert on any new duplicates.
3. **No direct Notion UI edits** of email for known users — internal team trained to go through the app's profile page, not Notion, once that surface exists in Wave 7.3.2.

---

## §6. Script specs

Two scripts. Both follow the `scripts/backfill-bcrypt-passwords.mjs` pattern — same env loading, same dry-run/verbose/limit flag set, same end-of-run summary with sample output.

### 6.1 `scripts/audit-reviewer-emails.mjs` (read-only)

**Purpose:** §4.1's diff report. Never writes.

**Flags:**
- `--verbose` — log every row including healthy ones (default: just flag + summary).
- `--json-out=<path>` — override the default `tmp/audit-reviewer-emails-<ISO>.json`.
- `--include-no-consent` — by default skips rows where `Consent = false` (probably abandoned registrations); this flag includes them.

**Output shape (JSON):**
```json
{
  "ranAt": "2026-04-22T12:34:56Z",
  "totalRows": 6,
  "flagged": {
    "missingEmail": [ { "pageId": "...", "alias": "sharon", "firstName": "Sharon" } ],
    "duplicateEmails": [
      { "email": "sharon@nordicnaturals.com", "pageIds": ["...", "..."] }
    ],
    "malformedEmail": [ { "pageId": "...", "email": "sharon@nordicnaturals", "reason": "no TLD" } ],
    "aliasLooksLikeEmail": [ ],
    "domainAliasMismatch": [ ]
  },
  "healthyCount": 5
}
```

**Exit code:** 0 if no flags found; 1 otherwise (so CI / cron can treat it as a test).

### 6.2 `scripts/backfill-reviewer-emails.mjs` (write-only-with-confirm)

**Purpose:** §4.2's surgical one-shot edits. Always writes a single named row; never batch-writes.

**Flags:**
- `--confirm` — required for any write; absent = dry-run with intended diff printed.
- `--reviewer-id=<page_id>` — required; the target row.
- `--email=<value>` — the new email to write.
- `--verbose` — verbose output.

**Behavior:**

1. Fetch the target reviewer.
2. Print the current row state: pageId, alias, firstName, current email.
3. If `--email` is set, run the uniqueness pre-check (§4.4 logic) — reject if another row already has that email.
4. If `--confirm` is absent: print intended diff, exit 0 without writing.
5. If `--confirm` is present: write `Email = <new>` and `Email confirmed at = <now>`. Emit audit event `email.migration.backfill`. Summary.

**Intentional limits:**
- No `--all` flag. No batch mode. Every backfill is a named, logged, one-row operation.
- Does not write to `Alias`. That column is owned by the user's self-service profile.

---

## §7. Code deltas

### `src/lib/notion.js`

- Add `getReviewerByEmail(email)` — mirrors `getReviewerByAlias`. Filter: `{ property: 'Email', email: { equals: email.toLowerCase() } }`.
- Extend `parseReviewerPage()` to expose `emailConfirmedAt`: `p['Email confirmed at']?.date?.start || null`.
- Introduce `EmailAlreadyInUseError` (exported) — thrown by write helpers that detect a duplicate.
- Add pre-write duplicate check to `createReviewer()`.
- Add `updateReviewerEmail(reviewerId, email)` helper used by the banner endpoint + backfill script — queries for duplicates, then updates `Email` and `Email confirmed at` atomically (Notion's single-page update is atomic for our purposes).

### `src/app/api/auth/login/route.js`

- Accept `{ identifier, password }` OR `{ alias, password }`.
- If `identifier.includes('@')`: try email first, alias second. Else try alias first, email second.
- Everything else unchanged.

### `src/app/api/auth/register/route.js`

- Add pre-write email uniqueness check (via `createReviewer` already throwing).
- On `EmailAlreadyInUseError`: return 409 with message "That email is already registered. Try signing in, or use a different email."

### `src/app/api/auth/confirm-email/route.js` (new)

- Authenticated (uses the existing session cookie).
- Validates email shape server-side.
- Pre-write uniqueness check.
- Updates `Email` + stamps `Email confirmed at = now()`.
- Emits audit event.
- Returns `{ ok: true }`.

### `src/lib/auth.js`

- `signAccessToken()` accepts and includes an `email` claim.
- Default to empty string if caller doesn't provide it (no behavior regression).

### `src/components/auth/EmailConfirmationBanner.js` (new)

- Reads `user.email` + `user.emailConfirmedAt` from auth context.
- Renders only when confirmation is needed.
- Blocks navigation (portal / backdrop).
- Posts to `/api/auth/confirm-email`.
- Writes a localStorage key `sqr.email-confirmed.<reviewerId>` on success to reduce re-render churn across tabs.

### Auth context / JWT decoder

- `useAuth()` or equivalent exposes `email` and `emailConfirmedAt` in addition to existing fields.

---

## §8. Verification plan

Per-phase checks, in order:

1. **7.3.0a audit** — run `node scripts/audit-reviewer-emails.mjs --verbose` against production. Expect: report prints, JSON lands in `tmp/`, exit code reflects whether flags exist. Garrett reads the report.
2. **7.3.0b reconciliation** — re-run the audit after each manual fix. Expect: flagged count strictly decreases to zero. Final run exits 0.
3. **7.3.0c banner** — deploy to Preview. Log in as a test reviewer with an empty email. Expect: banner appears, blocks navigation, submission writes to Notion, row updates, `Email confirmed at` stamped, banner dismisses, full app unlocks.
4. **7.3.0d uniqueness** — attempt to register with an email already on another row. Expect: 409 with a legible error.
5. **7.3.0e email login** — log in with `identifier = email@nordicnaturals.com, password = <correct>`. Expect: 200, session issued, JWT decodable.
6. **7.3.0f JWT claim** — decode the access token post-login. Expect: `claims.email === user.email`, `claims.alias === user.alias`.
7. **7.3.0g burn-in** — run the audit cron weekly. Expect: zero new duplicates, zero banner-stuck users.

Smoke-test matrix across reviewer variants:

| Variant | Expected login path |
|---|---|
| Internal user, email present, alias present | email ok · alias ok |
| Internal user, email missing, alias present | alias ok · banner on next visit · after banner, email ok |
| External reviewer, email present, alias present | email ok · alias ok |
| Legacy row, email malformed | alias ok · banner corrects · email ok thereafter |
| New registration (post-7.3.0d) | email ok · alias unique by convention (not enforced) |

---

## §9. Rollback plan

**Alias uniqueness is preserved throughout 7.3.0.** Nothing we do removes alias as a working login key. If any phase reveals a problem:

- **Roll back 7.3.0c banner:** env flag `WAVE_7_3_0_BANNER=false`. Banner renders null. Users fall back to alias login.
- **Roll back 7.3.0d uniqueness:** revert the pre-write check in `createReviewer`. Behavior returns to "first writer wins, later writers silently create a dup". This is strictly worse but not breaking.
- **Roll back 7.3.0e email login path:** `/api/auth/login` ignores `identifier` and falls back to reading `alias`. No session is invalidated.
- **Roll back 7.3.0f JWT email claim:** additive, so rolling back just means new tokens don't carry email. No consumer breaks because no consumer reads it yet.

**Irreversible point:** Wave 7.2.0 is the first time we *stop emitting* the alias claim. 7.3.0 itself is fully reversible up to and including 7.3.0g. The burn-in window exists precisely so we discover any reason to roll back *before* 7.2.0 starts consuming the new claims.

Data rollback: `Email` column existed before 7.3.0 — we do not need to restore it. `Email confirmed at` additions are non-destructive; clearing that column (if truly necessary) forces banners to re-appear but does not lock anyone out.

---

## §10. Effort estimate

| Phase | Description | Hours |
|---|---|---|
| 7.3.0a | Audit script (read-only) | 2 |
| 7.3.0b | Reconcile ambiguities (human-driven) | 1–4 |
| 7.3.0c | Email Confirmation Banner + endpoint | 4 |
| 7.3.0d | Uniqueness constraint in helpers + tests | 3 |
| 7.3.0e | Email login path | 2 |
| 7.3.0f | JWT claim expansion | 1 |
| 7.3.0g | Burn-in (observation only) | 0 |
| **Total engineering** | | **~12–15 hours** |

Calendar time, not engineering time, is the binding constraint: add 7 days for the burn-in window. Realistic wall-clock: **two weeks from kickoff to "green-light 7.2.0"**.

---

## §11. Dependencies

**Inbound (shipped):**

- **Wave 7.0.7** (dual-token access/refresh, bcrypt backfill, forced-reset flow) — we piggyback on the bcrypt script's env-loading pattern and the "Password reset required" precedent for adding a new reviewer-row checkbox/date without drama. Confirms that additive schema changes on Reviewers are low-risk.
- **Wave 7.1** (capabilities scaffold) — already-shipped; no code path is capability-gated in 7.3.0 because the endpoints we touch are auth itself. `requireCapability` is not applicable here.

**Outbound (this wave unblocks):**

- Wave 7.2.0 — needs stable email-on-every-row + JWT email claim.
- Wave 7.3.1 — needs email for magic-link send.
- Wave 7.3.2 — needs email for per-user welcome personalization and profile-edit confirmation loops.
- Wave 7.4 — needs email as the localStorage namespace key for sticky preferences.
- Wave 7.5 — unrelated; capability migration is orthogonal to identifier migration.

---

## §12. Gates for starting Wave 7.2.0

7.2.0 does not start until **all** of the following are true:

1. 7.3.0g burn-in has run **one full week** in production (Monday to Monday).
2. `scripts/audit-reviewer-emails.mjs` exits with code 0 against production (zero flagged rows).
3. Zero `EmailAlreadyInUseError` events in the 48 hours preceding kickoff.
4. Zero Slack reports from Sharon / Gina / Adin / Lauren about banner-related confusion.
5. At least one successful email-path login has been logged for every internal user (`@nordicnaturals.com`). External reviewers are a softer gate — we want at least 80% coverage, not 100%, because some external reviewers may not log in within the week.

If gate 5 falls short for external reviewers, we still start 7.2.0; external reviewers will hit the banner on their next login whenever that is, and the banner still works.

---

## §13. Open questions for Garrett

These are the decisions I am **not** going to make unilaterally. Flag, discuss, then revise the plan before phase 7.3.0c ships.

### Q1. Two reviewers who legitimately share a mailbox — do we forbid this, or support it?

The realistic case: a husband-and-wife academic pair who run one shared inbox `smith.family@gmail.com` and both want to review for Nordic. Cleanest answer is **forbid at registration**: one email = one reviewer. If the couple both want to review, they get separate emails (`mary.smith@…` / `tom.smith@…`). The cost of supporting shared emails is a tangled magic-link UX (whose session does the link create?) and ambiguous audit logs. **Recommend: forbid.** But confirm.

### Q2. Email case sensitivity — normalize to lowercase on write, or preserve casing?

RFC 5321 says the local-part is *technically* case-sensitive; RFC 5321 §2.4 strongly recommends treating it as case-insensitive in practice, which is what every modern provider does. **Recommend: lowercase on write, lowercase on compare.** Store `garrett@windedvertigo.com`, not `Garrett@windedvertigo.com`. Side-effect: one display field is canonicalized on the user's behalf, which some users dislike. Confirm this is OK.

### Q3. Do we require a confirmed-via-mail loop before treating an email as verified?

Strictest version: after the banner, we send a confirmation email with a one-time link; email is verified only when the user clicks it. This catches typos ("I meant `…natural.com` not `…naturals.com`") before they lock the user out on the next password reset or magic link. The cost is a new endpoint, a new template, and a second-step UX the user has to complete. **Recommend: skip for 7.3.0**, rely on the first successful magic-link in 7.3.1 as the implicit verification. But this is a genuine judgment call — if Garrett wants higher safety we can ship it here.

### Q4. Should the banner also force a bcrypt forced-reset for any user whose email change reveals a stale password reset?

If a user's email was wrong for a year, and their password was also compromised in the plain-text window of Wave 7.0.7, the intersection of the two might warrant a forced reset *after* confirming the new email. Cleaner flow: "thanks for confirming your email — we're also going to have you rotate your password now". **Lean: no, keep them separate**, the banner already has one job. But if the audit in 7.3.0a surfaces a user whose email *and* password-reset state are both stale, it's worth a quick re-think.

---

*End of plan.*
