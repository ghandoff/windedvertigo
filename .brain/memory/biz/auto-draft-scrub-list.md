# Auto-Draft Scrub List — BIZ-Q1

Authoritative rule definitions for the pre-submission QC gate.
Implemented in `port/app/api/rfp-radar/[id]/qc-review/route.ts`.
A `pass` verdict requires zero unresolved **blocking** items.

---

## Blocking Items (high severity — fail the bundle)

### (a) Unsourced Figure
**Rule:** Currency amounts and magnitude figures in the draft that cannot be
traced to a source line are a hard fail. Plain large integers ≥ 1,000 that
lack a source are surfaced as **warnings** (not hard blocks).

"Traceable to a source" means one of:
- Inline citation bracket: `[1]`, `[2]` etc. OR markdown footnote anchor `[^1]`, `[^2]`
- Parenthetical year reference: `(2023)`, `(IDB, 2024)`
- Explicit attribution: "per ToR", "per RFP", "source:", "ref 3", "fn 2"

**Currency / magnitude figures (hard block):** Anything with a currency prefix
(`$`, `€`, `£`, `¥`, `USD`, `EUR`, `MXN`, `BRL`, `COP`) or a magnitude qualifier
(`million`, `billion`) without a traceable source fails QC.

**Canonical regression case:** A draft containing `$20M` with no citation must
fail QC, regardless of how plausible the figure is.

**Scale figures (warning only):** Plain integers ≥ 1,000 without currency or
magnitude (e.g. "40,000+ educators", "45,000 professionals") are reported as
warnings but do **not** block submission. These are often own-IP scale claims
that do not require external sourcing.

**Resolution (blocking):** Add a citation, replace with a sourced figure from a
BD asset, or remove the figure entirely.

---

### (b) Unverified CV / Experience Claim
**Rule:** Any team member name appearing in the draft must match a `verified`-
confidence entry in the canonical CV roster (`collective_cv` table, Supabase).

**CV confidence tiers:**
| Tier          | Condition |
|---------------|-----------|
| `verified`    | `last_verified_at` is within `expires_after_days` (default 90 days) |
| `needs-review`| `last_verified_at` exists but has expired |
| `draft`       | `last_verified_at` has never been set |

A name mentioned in the draft that resolves to a `needs-review` or `draft` CV
is a hard fail. `not-found` (name in draft, no row in collective_cv) is also
a hard fail.

**Name alias map** (these must resolve to the canonical name for CV lookup):
- `James` → `Jamie Galpin`
- `James Galpin` → `Jamie Galpin`

Always use `Jamie Galpin` in proposal text. A draft mentioning `James` or
`James Galpin` will be flagged and the CV checked against `Jamie Galpin`'s
canonical entry.

**Resolution:** Run `/cv verify` in the dashboard or click "✓ My CV is current"
in the Slack notification, then re-run QC.

---

### (c) Structure vs. ToR Mismatch
**Rule:** Phase count, timeline, page limit, or word limit in the draft must
not contradict the approved ToR requirements stored in `rfp_requirements`
(`kind='deliverable'`, `approved_at IS NOT NULL`).

Checked fields per approved deliverable row:
- `word_limit`: draft word count must not exceed the limit (5% tolerance)
- `page_limit`: estimated page count (≈ 300 words/page) must not exceed limit
- `required_sections[]`: every section label in the array must appear somewhere
  in the draft (case-insensitive)

**Resolution:** Trim the draft, restructure to stay within limits, or add the
missing required section.

---

## Warnings (lower severity — surface but do not block)

### De-templated Bio
Patterns: `[Client]`, `TBD`, `Client: Unknown`, `Organisation: Unknown` in
any bio or experience paragraph. Indicates a template that wasn't fully
populated.

### Voice / Antithesis
Document opens with a weak passive or impersonal construction:
`It is`, `There is/are`, `This proposal will`, `This document is`.
winded.vertigo voice is active and direct; review the opener.

### Unanswered Question
`clarifyingQuestions` array items from the proposal draft that remain
unresolved in the bundle. Surface these so the writer can address or remove
them before submission.

---

## Severity Summary

| Item | Severity | Blocks submission? |
|------|----------|-------------------|
| Unsourced currency/magnitude figure | high | yes |
| Unsourced scale figure (≥ 1,000, no currency/magnitude) | low | no |
| Unverified CV claim | high | yes |
| Structure vs. ToR mismatch | high | yes |
| De-templated bio | low | no |
| Voice / antithesis | low | no |
| Unanswered question | low | no |
