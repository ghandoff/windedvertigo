# Phase 4.6 — Claim Mapping Review (Operator Runbook)

> **Audience:** Lauren Bosio + RES + RA team
> **Surfaces:**
>   - `/pcs/canonical-claims/backfill-review` — review the regex matcher's PCS Claim → Canonical mapping proposals
>   - `/pcs/ingredients/[id]` — see each active ingredient's dose-graded claim catalog (NEW Phase 4.6 D.1 section)
>   - Wave 6.1 Feedback Button (bottom-right of every PCS page) — flag misclassifications
> **Capability gate:** `pcs.canonical:edit` (researcher / RA / admin / super-user — i.e. all Nordic team members)
> **Status:** Live as of 2026-05-03.

---

## What this is for

The PCS Claims database has 469 raw claims that came in as free-text titles before Lauren's standardized vocabulary existed. Phase 4.6 introduced the canonical claim grammar (Category → Strength → Family → Variants) and a fuzzy-matching script that proposed how each free-text claim maps to its canonical form.

The **Claim Mapping Review** queue is where you review those proposals and approve / flag them. Approving writes the relations to Notion (Canonical Claim, Claim prefix, Core benefit, Wording Variants) — the same fields you'd manually edit on a claim's detail page, just batched.

## Status at preview launch (2026-05-03)

- **469** total PCS Claims
- **93** already linked to a canonical (34 manual + 59 auto-applied at confidence ≥ 0.99)
- **120** pending high-confidence (matcher score ≥ 0.7) — your primary review queue
- **252** unmatchable — no canonical match found by the regex; needs new canonical entries OR manual classification

---

## Steps — using the Backfill Review queue

1. Navigate to **PCS → Review → Claim Mapping Review** in the sidebar (`/pcs/canonical-claims/backfill-review`).
2. Top of page shows stat cards (total / applied / pending high / pending low / unmatchable).
3. Filter chips select the queue:
   - **Pending (high confidence)** — start here. Score ≥ 0.7. Most are likely correct.
   - **Pending (low)** — score 0.5–0.7. Worth a glance but most need manual editing.
   - **Unmatchable** — no candidate found. Either there's no canonical for this concept yet (create one), OR the claim text is too unusual.
   - **Applied** — read-only audit view of what's been done.
4. Each row is a card:
   - **Left side:** the original PCS claim's free-text title + page ID.
   - **Right side:** the proposed canonical / prefix / benefit, plus a confidence score chip and the wording variants the matcher would split out.
5. Click **✓ Approve as proposed** to commit the mapping. Notion writes happen instantly:
   - PCS claim's `Canonical Claim` relation → set
   - PCS claim's `Claim prefix` relation → set
   - PCS claim's `Core benefit` relation → set
   - For each variant in the title: a new row in the **Claim Wording Variants** DB, linked back, with `Is primary` set on the first.
6. The row disappears from the queue (optimistic update). Refresh to confirm.

### Examples

**Confidence 1.00 — perfect after prefix extraction:**

```
Original:  "Required for/Plays a critical role in/Supports cellular energy production*"
Proposed:  Canonical: "Supports cellular energy production"
           Prefix:    "Required for/Plays a critical role in/Supports"
           Confidence 1.00 → Approve
```

**Confidence 0.85 — false positive (matcher hit on shared "healthy"):**

```
Original:  "Supports healthy bones*"
Proposed:  Canonical: "Supports healthy sleep*"  ← WRONG
           Prefix:    "Supports"
           Confidence 0.85 → DO NOT Approve. Use the feedback button to flag.
```

The matcher uses normalized Levenshtein over the post-prefix remainder. It can match on shared words even when the meaning is wrong. Confidence ≥ 0.99 is generally safe; 0.7–0.99 needs your eye; below 0.7 almost always needs manual editing.

---

## Flagging misclassifications

Don't fight the queue — **use the Feedback Button** (bottom-right corner, chat-bubble icon) for:

- "This proposed canonical is wrong, should be X"
- "This claim has no canonical yet — should be a new one called Y"
- "This 'Required for / Plays a critical role in / Supports' claim was approved at the wrong canonical"

Flags land in Slack `#nordic-platform-feedback` in real time. Garrett triages them into the next iteration of the matcher (and eventually Bundle C: an LLM-assisted classifier seeded by your approvals).

See `docs/runbooks/wave-6.1-feedback-button.md` for the full feedback workflow.

---

## Dose-Graded Ingredient Catalog (Phase 4.6 D.1)

**Where:** `/pcs/ingredients/[id]` — the existing active ingredient detail page now has a "Dose-Graded Claim Catalog" section above the Forms table.

**What it shows:** For each demographic age group (Toddlers 1-3, Children 4-8, Pre-teen, Teen, Adults), the claims authorized at each minimum dose, sorted ascending. Cumulative-tier rule: at any chosen dose, all claims with min-dose ≤ that dose are authorized.

**Why this matters (Gina's 2026-04-17 Slack):**

> "at 600 IU vit D3 we can say 'supports bone health, normal mood'; at 1000 IU we add 'supports immune health'."

The catalog makes that visible at a glance. Future Phase D.2 (2027 SOW) will turn this projection into a generator: pick an active ingredient, get a draft AICS .docx auto-rendered with all the per-demographic dose-graded claims pre-populated.

**Empty state:** if no AICS Document exists for this ingredient yet, the section shows an amber "no AICS doc found" card with a link to the AICS upload flow. Once the AICS lands, the catalog auto-populates.

**Magnesium specifically:** the 4 magnesium PCSs flagged on 2026-04-19 (PCS-0051 Kids Calm Gummies, PCS-0081 Magnesium Gummies, PCS-0126 Magnesium Complex, PCS-0137 Magnesium Glycinate) need to be re-uploaded under Lauren's new template before the magnesium catalog populates. Gina mentioned in DM 2026-05-01 she's drafting the magnesium AICS manually — once that's uploaded, this view will reflect it.

---

## What this DOES NOT do (yet)

- **Does not auto-classify new PCS .docx uploads.** That's Bundle C — gated on you approving ~50 mappings here so the LLM has training examples.
- **Does not generate a new AICS .docx.** That's Phase D.2 — 2027 SOW.
- **Does not enforce the cumulative-tier rule on the form-driven entry path.** Operators can still pick a dose-claim combination that violates it; the catalog is read-only audit, not gate.
- **Does not edit the proposed mapping inline.** If the proposal is wrong, decline and edit the canonical claim directly via `/pcs/canonical-claims/[id]`. (Future iteration adds inline editing in the queue.)

---

## Related

- `src/lib/canonical-claim-matcher.js` — the matcher that produces proposals
- `src/lib/ingredient-claim-catalog.js` — the dose-graded projection
- `scripts/backfill-claim-vocab-tiers.mjs` — batch dry-run of the same matcher (CLI)
- `docs/reviews/claim-vocab-redundancy-2026-05-03.md` — the analysis that motivated Phase 4.6
- `docs/runbooks/wave-6.1-feedback-button.md` — flag misclassifications inline
- `docs/runbooks/aics-onboarding.md` — uploading AICS docs (the input data for the catalog)
