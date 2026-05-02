# Wave 7.0.5 T2.5 — Prefix Fallback Hierarchy + Essential-Nutrient Gate

> **Status:** Planning artifact — no application code, no Notion schema edits.
> **Author:** Claude (synthesis), Garrett (direction).
> **Date:** 2026-04-22
> **Inputs:** Gina's 2026-04-22 reply on the Multi-Profile Data Architecture review (prefix-combo rows + essential-nutrient nuance); the three "combo" rows currently in the Claim Prefixes DB.
> **Relates to:** `docs/plans/wave-7.0.5-multi-profile-architecture-refinements.md` (parent), `docs/plans/wave-7-master-architecture.md` (canonical-claim identity), and the `prefixes` / `ingredients` databases wired in `src/lib/pcs-config.js`.

---

## §1. Problem statement

Today's Claim Prefixes DB (`7ed1891c-cd48-405f-b4f4-8384c1a4ed41`) carries three rows whose Name fields enumerate **multiple** prefix phrases separated by slashes:

- "Required for / Plays a critical role in / Supports"
- "Required for / Plays a critical role in / Nutritional Support for"
- "Required for / Plays a critical role in / Nutritional Support for (certain aspects of)"

These combo rows are not cosmetic — they paper over a **fallback hierarchy** that Researchers walk down in their head when authoring a claim. The hierarchy depends jointly on evidence tier, product dose vs. the RCT-backed minimum dose, and whether the Active Ingredient (AI) is an **essential nutrient** (a vitamin, mineral, essential fatty acid, essential amino acid).

Two consequences follow:

1. **The recommender cannot work.** A `recommendPrefix()` helper has no way to pick the right prefix because the preference order is not encoded anywhere — it lives in Gina's head. Downstream, PD and Marketing cannot self-serve a claim draft without a Research round-trip.
2. **The essential-nutrient gate is unenforced.** Today nothing prevents an operator from authoring *"Curcumin is required for healthy sleep"* — a statement Gina flags as legally indefensible because curcumin is not required for anything. The guardrail exists only as tribal knowledge.

This wave designs the schema, algorithm, and UI needed to encode the hierarchy and enforce the gate. No rows are split, no code is written; T2.5's deliverable is this plan plus the set of open questions Gina must answer before implementation starts.

---

## §2. Schema deltas

### Active Ingredients DB

> **TODO for implementer:** confirm the database id via `src/lib/pcs-config.js` (search for `NOTION_PCS_ACTIVE_INGREDIENTS_DB_ID` or the nearest equivalent; the constant may be named `ingredients` in the config map).

| Field                       | Type     | Default | Notes                                                                                                  |
| --------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `Is essential nutrient`     | Checkbox | `false` | Gina backfills `true` for vitamins, minerals, essential fatty acids (EFAs), essential amino acids (EAAs). |

Backfill is a small, bounded edit — the essential-nutrient set is a closed list (a few dozen rows at most). Non-essentials (botanicals, probiotics, peptides, carotenoid extracts, etc.) remain `false` and by construction cannot unlock rank-3 prefixes.

### Claim Prefixes DB

> **DB id:** `7ed1891c-cd48-405f-b4f4-8384c1a4ed41`

| Field                         | Type     | Allowed values   | Notes                                                                                                 |
| ----------------------------- | -------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| `Fallback rank`               | Number   | `1` \| `2` \| `3` | 1 = strongest (`Supports`); 2 = mid (`Nutritional Support for`); 3 = last-ditch (`Required for`).      |
| `Requires essential nutrient` | Checkbox | `true` / `false` | `true` only on rank-3 rows. Recommender filters these out when AI is not essential.                   |
| `Fallback group`              | Text     | free-text key    | Groups atomic prefix rows that share a benefit domain (e.g. `sleep`, `immunity`, `cognitive`).         |

`Fallback group` is the join key that lets the recommender load "the ladder of prefixes for this kind of claim" in one query. For the MVP Gina assigns groups by hand (there are under 20 atomic rows after the split); if the set grows past ~50 rows we can revisit automation.

---

## §3. Data migration plan

Each combo row splits into three atomic rows. The middle rank ("Plays a critical role in") carries an ambiguity flagged in §7 Q1 — the table below shows the **proposed** ranking with the ambiguous cell marked `?`.

### Split 1 — `Required for / Plays a critical role in / Supports`

| New row text                    | Fallback rank | Requires essential nutrient | Dose sensitivity (from T1) |
| ------------------------------- | ------------- | --------------------------- | -------------------------- |
| `Supports …`                    | 1             | `false`                     | `dose_gated`               |
| `Plays a critical role in …`    | ?             | `false`                     | `dose_agnostic`            |
| `Required for …`                | 3             | `true`                      | `dose_agnostic`            |

### Split 2 — `Required for / Plays a critical role in / Nutritional Support for`

| New row text                     | Fallback rank | Requires essential nutrient | Dose sensitivity |
| -------------------------------- | ------------- | --------------------------- | ---------------- |
| `Nutritional Support for …`      | 2             | `false`                     | `dose_qualified` |
| `Plays a critical role in …`     | ?             | `false`                     | `dose_agnostic`  |
| `Required for …`                 | 3             | `true`                      | `dose_agnostic`  |

### Split 3 — `Required for / Plays a critical role in / Nutritional Support for (certain aspects of)`

| New row text                                               | Fallback rank | Requires essential nutrient | Dose sensitivity |
| ---------------------------------------------------------- | ------------- | --------------------------- | ---------------- |
| `Nutritional Support for (certain aspects of) …`           | 2             | `false`                     | `dose_qualified` |
| `Plays a critical role in …`                               | ?             | `false`                     | `dose_agnostic`  |
| `Required for …`                                           | 3             | `true`                      | `dose_agnostic`  |

Net effect: **3 combo rows → 9 atomic rows**, each with a rank and a clear essential-nutrient requirement.

**Deduplication note:** splits 1, 2, and 3 each produce a `Plays a critical role in …` row and a `Required for …` row. If the `Fallback group` keys match across splits, the implementer should collapse duplicates into a single atomic row per (phrase, group) pair. The final count may therefore be **fewer than 9** rows depending on group assignment. Confirm collapse policy with Gina during migration.

---

## §4. `recommendPrefix()` algorithm

The helper lives at `src/lib/pcs-prefix-recommender.js` (new file). It is pure — no Notion calls inside the hot path; prefixes are loaded once at boot and cached.

### Signature

```js
/**
 * @param {object} args
 * @param {object} args.activeIngredient      // { id, name, isEssentialNutrient: boolean }
 * @param {string} args.evidenceTier          // 'clinical_rct' | 'clinical_other' | 'preclinical' | 'mechanistic'
 * @param {number} args.doseInProduct         // numeric, same unit as rctMinDose
 * @param {number} args.rctMinDose            // numeric; may be null if no RCT floor exists
 * @param {string} args.fallbackGroup         // e.g. 'sleep'
 * @returns {{ prefix: Prefix, rank: 1|2|3, rationale: string } | { prefix: null, reason: string }}
 */
```

### Pseudocode

```text
function recommendPrefix({ activeIngredient, evidenceTier, doseInProduct, rctMinDose, fallbackGroup }) {
  const candidates = prefixes
    .filter(p => p.fallbackGroup === fallbackGroup)
    .filter(p => !(p.requiresEssentialNutrient && !activeIngredient.isEssentialNutrient))
    .sort((a, b) => a.fallbackRank - b.fallbackRank)

  for (const p of candidates) {
    if (p.fallbackRank === 1) {
      // "Supports" — strongest, requires RCT-level evidence AND product dose >= RCT floor
      if (evidenceTier === 'clinical_rct' && rctMinDose != null && doseInProduct >= rctMinDose) {
        return { prefix: p, rank: 1, rationale: `Dose ${doseInProduct} >= RCT floor ${rctMinDose}; RCT evidence.` }
      }
      continue
    }
    if (p.fallbackRank === 2) {
      // "Nutritional Support for" — used when evidence exists but product dose is sub-therapeutic
      if (rctMinDose != null && doseInProduct < rctMinDose) {
        return { prefix: p, rank: 2, rationale: `Dose ${doseInProduct} below RCT floor ${rctMinDose}; qualifying claim.` }
      }
      continue
    }
    if (p.fallbackRank === 3) {
      // "Required for" — essentials only, last-ditch when rank 1/2 don't fit
      return {
        prefix: p,
        rank: 3,
        rationale: `${activeIngredient.name} is an essential nutrient; mechanistic claim permitted regardless of dose.`,
      }
    }
  }

  return {
    prefix: null,
    reason: `No valid prefix for AI=${activeIngredient.name}, evidence=${evidenceTier}, dose=${doseInProduct}/${rctMinDose}, group=${fallbackGroup}.`,
  }
}
```

### Truth table — Gina's three examples

| AI                   | Is essential? | Dose (product) | RCT min dose | Evidence tier | Recommended prefix             | Rank | Why                                                        |
| -------------------- | ------------- | -------------- | ------------ | ------------- | ------------------------------ | ---- | ---------------------------------------------------------- |
| Vitamin D            | `true`        | 10 IU          | 600 IU       | clinical_rct  | `Required for …`               | 3    | Essential nutrient; dose below RCT floor; ranks 1/2 don't fit. |
| Curcumin             | `false`       | 200 mg         | 600 mg       | clinical_rct  | `Nutritional Support for …`    | 2    | Non-essential; sub-dose; rank 3 locked by essential-nutrient gate. |
| Magnesium glycinate  | `true`        | 400 mg         | 400 mg       | clinical_rct  | `Supports …`                   | 1    | At RCT floor with RCT evidence; strongest claim available. |

### Edge cases

- **No RCT floor exists.** `rctMinDose === null` → rank 1 is disqualified; rank 2 is also disqualified (needs a floor to compare against); recommender falls through to rank 3 if essential, else returns `{ prefix: null }`.
- **Evidence below RCT.** Rank 1 requires `evidenceTier === 'clinical_rct'`; non-RCT evidence falls through to rank 2 or 3.
- **Non-essential AI, sub-dose, no rank 2 row in group.** Returns `{ prefix: null, reason: … }`. The UI surfaces this as "no claim available at this dose — either raise dose to RCT floor or drop the claim."

---

## §5. UI integration

### Location

Claim-authoring UI — search for the form component under `src/components/pcs/` (grep for `Claim` or `prefix` in JSX) and wire the recommender into its `onChange` cascade. The current file name should be confirmed during implementation; the Research team's claim-entry screen is the target.

### Behavior

1. **Recommendation surfaces as the form populates.** When operator selects an AI and enters a dose, the form calls `recommendPrefix()` and shows the recommended prefix above the prefix dropdown as *"Recommended: `Nutritional Support for …` — product dose 200 mg is below RCT floor 600 mg; `Required for` unavailable because curcumin is not an essential nutrient."*
2. **Operator can override.** The prefix dropdown remains fully enabled. Picking a non-recommended prefix triggers a **yellow, non-blocking warning**: *"You picked `Supports`; recommender says `Nutritional Support for`. Reason for override?"* — with a text field that is saved to the claim's audit log.
3. **List views flag mismatches.** Claim list views (Research queue, Marketing audit mode, PD drilldown) render a small warning icon next to any claim whose stored prefix disagrees with a fresh `recommendPrefix()` call. Icon is dim, non-blocking, and hover-expands to show the recommended alternative.
4. **Audit trail.** Every override writes a row to the Claim Audit Log DB (`user_id`, `claim_id`, `recommended_prefix`, `chosen_prefix`, `reason`, `timestamp`). Legal asks for this; it also gives Research a source for "why are we drifting from the recommender" retros.

---

## §6. Effort estimate

| Phase                                                           | Estimate |
| --------------------------------------------------------------- | -------- |
| Notion schema edits + Gina collab to classify essential nutrients | 30 min   |
| Split 3 combo rows into atomic rows (9 rows, ranks populated) via MCP | 30 min   |
| Implement `recommendPrefix()` helper                            | 60 min   |
| Unit tests (`tests/prefix-recommender.verify.mjs`)              | 30 min   |
| UI integration (form, list icons, override audit)               | 90 min   |
| **Total**                                                       | **~4 h** |

Assumes Gina's open questions (§7) are answered before implementation starts. If Q1 is unresolved, the split step stalls.

---

## §7. Open questions for Gina

1. **Is "Plays a critical role in" rank 1 (equivalent to `Supports`) or rank 2 (equivalent to `Nutritional Support for`)?** The phrase reads mechanistic, which argues for a separate rank; but we need a single numeric rank to sort candidates. Recommend: rank 2, dose_agnostic, non-essential-gated — but confirm.
2. **For essential nutrients at or above the RCT dose, is `Required for` ever preferred over `Supports`, or does `Supports` always win when evidence is strong?** Current algorithm says `Supports` always wins rank 1; we never reach rank 3 for an at-dose essential. Is that correct?
3. **Are there essential nutrients where `Required for` is inappropriate regardless?** e.g. fiber is required for healthy bowel function, but *"fiber required for weight loss"* would be overreach. If yes, we need an (AI × benefit domain) allowlist, not a single AI-level flag.
4. **The 17 orphan canonical claims (no prefix on file):** do we default them to rank-1 `Supports` templates during a one-time backfill, or hold for case-by-case Research review? Defaulting is faster but lossy; per-claim review is slower but safer.

---

## §8. Dependencies

| Wave / task                                   | Status   | Relationship                                                                 |
| --------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| T1 — `dose_sensitivity` on Claim Prefixes DB  | Shipped  | Per-rank rows inherit dose sensitivity; hash input.                          |
| T2 — canonical-claim identity key             | Shipped  | Rank-aware prefix still hashes via the same canonical-claim identity.        |
| T6 — AI Form source attributes                | Shipped  | Recommender reads AI's essential-nutrient flag, form-level attributes.       |
| **T2.5 — this wave**                          | Planning | Ships schema + recommender + UI.                                             |
| T8.1 — duplicate-merge executor               | Future   | Independent; can run in parallel.                                            |

---

## §9. Acceptance criteria

- [ ] **Schema.** Active Ingredients DB has `Is essential nutrient` checkbox; all essential nutrients classified by Gina.
- [ ] **Schema.** Claim Prefixes DB has `Fallback rank`, `Requires essential nutrient`, and `Fallback group` fields populated on all rows.
- [ ] **Migration.** The 3 combo rows are replaced by atomic rows (target: 9 rows; may collapse to fewer if duplicates across splits share a fallback group — confirm with Gina).
- [ ] **Code.** `src/lib/pcs-prefix-recommender.js` exports `recommendPrefix()` with the algorithm in §4.
- [ ] **Tests.** `tests/prefix-recommender.verify.mjs` covers:
  - Gina's 3 truth-table examples (vitamin D / curcumin / magnesium glycinate).
  - Essential-nutrient gate: curcumin at any dose never returns rank 3.
  - No-match fallback: returns `{ prefix: null, reason }` with an informative message.
  - Null `rctMinDose` edge case.
- [ ] **UI.** Claim-authoring form shows recommended prefix + rationale; override fires a yellow warning and writes an audit row.
- [ ] **UI.** List views render a dim warning icon next to claims whose stored prefix disagrees with a live `recommendPrefix()` call.
- [ ] **Audit.** Legal-visible audit trail captures every prefix override with operator, timestamp, recommended vs. chosen, and free-text reason.
