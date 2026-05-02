# Wave 7.0.5 — Multi-Profile Architecture Refinements (RES-team review synthesis)

> **Status:** Planning artifact — no application code.
> **Author:** Claude (synthesis), Garrett (direction).
> **Date:** 2026-04-21
> **Inputs:** 12 substantive comments from Gina (primary) and one additional RES-team commenter on the Notion page *"Multi-Profile Data Architecture — One Schema, Four Views"* (id `347e4ee74ba481a58badfd228da24dcb`, authored 2026-04-19).
> **Relates to:** `docs/plans/wave-7-master-architecture.md` (parent), `docs/plans/wave-7.1-roles-capabilities.md` (view surfaces), `docs/plans/wave-4.1b-demographic-vocabularies.md` (Lifestyle axis → vegan cross-check), and the `prefixes` / `benefitCategories` / `coreBenefits` / `ingredients` / `ingredientForms` databases wired in `src/lib/pcs-config.js`.

---

## §1. Findings synthesis

The RES team's feedback is not surface-level. It reframes three load-bearing assumptions of the Multi-Profile Data Architecture: (a) what makes a canonical claim unique, (b) who sits at the center of the inter-departmental workflow, and (c) which "tier-2" fields are actually tier-1 for Nordic's vegan-adjacent product lines. Nine findings, in three impact tiers plus one clarification, are each actionable.

### High impact — affects canonical-claim identity

**Finding 1 — `claim_prefixes` needs a `dose_sensitivity` column.**
Gina clarified that the five prefixes in rotation have materially different relationships to dose. Her taxonomy:
- `supports` → **dose_gated**. Dose is part of claim identity — the same claim text at a different dose is a different canonical claim.
- `required for` → **dose_agnostic**. "Illustrates the importance of the nutrient, regardless of dose" — used for mechanistic claims and essential-nutrient framing.
- `nutritional support for` → **dose_qualified**. "When the dose is not high enough to match the doses linked to benefits in research studies, and thus we have to qualify the claim."
- `may support` → **deprecated**. Per Gina's DSHEA advisor, FDA/FTC treat this as equivalent to `supports`; it buys no legal coverage.
- `plays a critical role in` → **dose_agnostic (assumed)**. Mechanistic framing, similar to `required for`. Needs Gina confirmation (see §6).

This is not a cosmetic column. Canonical-claim uniqueness currently hashes `prefix + core_benefit + AI-or-form + demographic`; Gina's model says dose only belongs in that hash when the prefix is `dose_gated`. Getting this wrong either over-splits (treats two `required for` variants at different doses as different claims) or under-splits (collapses two `supports` claims at meaningfully different RCT-backed doses).

**Action:** Add `dose_sensitivity` select column to the Claim Prefixes DB, seed per above, and refactor canonical-claim identity to:
```
canonical_claim_id = hash(
  prefix_id,
  core_benefit_id,
  ai_or_form_id,
  demographic_axis_bundle,
  prefix.dose_sensitivity === 'dose_gated' ? rounded_dose_bucket : null
)
```

**Finding 2 — Dose-aggregation discrepancies are a live problem, not a hypothetical.**
The second RES commenter wrote: *"Different researchers will use a slightly different set of studies to support the claim, and RA will essentially aggregate the doses from those studies or take the minimum dose to arrive at their recommendations for that specific PCS. Very problematic and important that we obviate."*

Translation: two PCSs that reference the same canonical claim today can carry different aggregated minimum doses because Sharon and Adin consulted non-identical study sets. RA then rationalizes after the fact. The architecture has been treating this as a future concern; it's already shipping inconsistency into labels.

**Action:** Add `dose_aggregation_discrepancy` as a new request type in the Wave 4.5 request generator. Nightly job scans for canonical-claim references whose aggregated-minimum-dose values disagree across PCSs; opens a Research Request routed to RA at `severity=High` with both dose values and the source-study sets linked. This *depends on* Finding 1 (we cannot detect discrepancy until canonical identity is correct).

### Medium impact — changes view design

**Finding 3 — Marketing cares about prefix variants, but for a different reason than RA does.**
Direct quote: *"They definitely care about prefix variants. They, more [than] anyone[,] care about prefix variants because how we market the strength of claims determines our culpability in a lawsuit."*

The original plan said Marketing doesn't care about prefixes, on the theory that Marketing only runs frequency and gap analytics. That framing is wrong. Marketing cares about prefix strength for **legal culpability**; RA cares for **regulatory compliance**. They're looking at the same column through different lenses.

**Action:** Marketing view ships in dual-mode:
- **Default:** prefix-stripped rollup for gap and frequency analysis.
- **Audit mode:** prefix-visible, grouped by strength (`supports` > `nutritional support for` > `required for`), for claim-strength review before a campaign or label run.
Surface the mode toggle prominently — Marketing will use audit mode more than the old plan anticipated.

**Finding 4 — Product Development is not at the center; Marketing is.**
Two commenters independently corrected this. One: *"Pretty sure they get their marching orders from MKT now."* Another: *"They ultimately listen to MKT and RES who get some direction from ELT but otherwise make decisions based on emerging consumer markets and ingredient trends. Everything is data-driven, not just based on what PD feels compelled to make."*

The architecture's AI-first PD drilldown stays (PD still lives in ingredient-formulation detail); what changes is the **initial surface for portfolio-gap analysis**. That belongs to Marketing. The upstream flow is:

```
Marketing (gap + consumer-trend signal) → Research (substantiation feasibility) → PD (formulate against defined targets)
```

This implies a new cross-departmental primitive that doesn't exist yet: a **formulation-opportunity request**, originated in Marketing, validated by Research, dispatched to PD. Different shape than the existing Research Request (which is an inward-facing correction, not an outward-facing opportunity).

**Action:** Wave 8.x — model the formulation-opportunity request as a first-class object with its own lifecycle, status machine, and routing policy. Do not fold it into the existing Research Request schema.

**Finding 5 — `source` is first-class, not tier-2, because of vegan lines.**
Direct quote: *"Source can be critically important because we offer a lot of algae based and lanolin options for vegans."* The Active Ingredient Forms DB currently treats `source` as a free-text annotation. For a portfolio that sells EPA from fish oil *and* EPA from algae oil, source is identity-level metadata.

**Action:** Promote `source` to a set of structured columns on Active Ingredient Forms:
- `source_type` — enum: `animal | marine-animal | algae | plant-extract | synthetic | fermentation | mineral`
- `vegan_compatible` — boolean
- `kosher` — boolean
- `halal` — boolean
- `gluten_free` — boolean
- `allergens[]` — multi-select (FDA Big 9 as baseline; see §6 for whether to extend)

And add a drift-detection rule to Wave 5.2: **any formula whose PCS demographic axis includes `Lifestyle = vegan` MUST resolve to AI-Forms where `vegan_compatible = true` across every ingredient.** This ties directly to `wave-4.1b-demographic-vocabularies.md`.

### Low impact — corrections + cleanup

**Finding 6 — Evidence "slight variations across PCS" is a bug, not a feature.**
Commenter: *"The only real variation should be a notation from the researcher as to how the findings reflect on the claim in question."* Lauren had previously flagged the same pattern; Gina's comment confirms it's happening today.

**Action:** Enforce one canonical Evidence row per `(DOI OR PMID)`. Per-PCS researcher annotation lives on the `evidence_packet` join (Evidence × Claim), not as a duplicate Evidence row. Migration must dedupe by DOI with audit trail. **Risk**: false positives where two studies share a DOI but carry different researcher interpretations — the merge script must preserve every annotation onto the join row, not silently drop any. (Wave 9.x.)

**Finding 7 — `may support` needs formal deprecation.**
Gina: *"We have gotten away from that convention because a DSHEA advisor told us that the FDA/FTC treat 'may support' claims the same as 'support' claims."* This is already the RES team's working convention; it's just not in the data.

**Action:** Seed the Claim Prefixes row with `Qualification level = deprecated`. Drift detector flags any live PCS using `may support` and offers operator a choice of upgrade to `supports` (if dose supports it) or downgrade to `nutritional support for` (if not). **This is already done (see §3).**

**Finding 8 — Ergocalciferol examples are confusing the readers.**
Both commenters: *"We literally have no ergocalciferol offerings."* / *"I don't even know of any products featuring ergocalciferol."* Using a non-Nordic example in architecture docs, extraction prompts, and LLM few-shot templates makes the downstream team trust the system less — it reads as if we're describing someone else's portfolio.

**Action:** Replace all vitamin-D ergocalciferol examples with Nordic-real cases:
- **AI-Form variation:** magnesium citrate vs glycinate vs malate.
- **Strain specificity:** *Bacillus coagulans* BC30, BB02.
- **Bioavailability:** EPA from fish oil vs algae oil (doubles as the vegan-compat illustration).

### Clarification

**Finding 9 — The original "prefix changes dose" framing confused the RES team itself.**
Commenter: *"Can't figure out what she meant by this."* When the authoring team can't parse their own framing, downstream engineers definitely won't. Rewrite §1 of the architecture doc using Gina's `dose_sensitivity` model as the explicit organizing concept. Finding 1 gives us the language to do this.

---

## §2. Actionable tickets

| # | Title | Affected DB/file | Change (concise) | Wave | Depends on |
|---|---|---|---|---|---|
| T1 | Add `dose_sensitivity` to Claim Prefixes | Notion `Claim Prefixes` DB; `src/lib/pcs-config.js` prefixes shape | New select column; seed 5 values per Finding 1 | **In flight (done)** | — |
| T2 | Refactor canonical-claim identity | canonical-claim builder + any hasher; drift detector | Conditional dose inclusion per `prefix.dose_sensitivity === 'dose_gated'` | **Wave 7.x** | T1 |
| T3 | Dose-aggregation discrepancy request type | Wave 4.5 request generator | New type `dose_aggregation_discrepancy`, severity=High, routed to RA | **Wave 5.2.x** | T1, T2 |
| T4 | Marketing view dual-mode | Marketing view component (future) | Default prefix-stripped + audit mode prefix-visible toggle | **Wave 7.x** | — |
| T5 | Formulation-opportunity request primitive | new DB + status machine | MKT → RES → PD cross-departmental object | **Wave 8.x** | T4 nice-to-have |
| T6 | Promote `source` to structured columns on AI Forms | `ingredientForms` DB + `pcs-config.js` | Add `source_type`, `vegan_compatible`, kosher/halal/gluten_free, `allergens[]` | **Wave 5.2.x** | — |
| T7 | Vegan-compat drift rule | Wave 5.2 drift detector | Lifestyle=vegan ⇒ all AI-Forms must be `vegan_compatible` | **Wave 5.2.x** | T6 |
| T8 | Evidence canonical uniqueness + dedup migration | Evidence DB + `evidence_packet` join | Enforce one row per DOI/PMID; migrate annotations onto join | **Wave 9.x** | — |
| T9 | Deprecate `may support` in data + detector | Claim Prefixes + drift detector | `Qualification level = deprecated` + flag live PCSs | **In flight (done)** | T1 |
| T10 | Replace ergocalciferol examples | Architecture doc, extraction prompts, few-shots | Swap to Mg form / BC30 / EPA source examples | **Wave 7.x** | — |
| T11 | Rewrite architecture doc §1 using `dose_sensitivity` framing | Notion page `347e4ee7…` | Rewrite opening section | **Wave 7.x** | T1 |

---

## §3. Immediate actions (completed or in flight)

- ✅ **Added `dose_sensitivity` column** to Claim Prefixes DB (T1).
- ✅ **Set `may support` row to `Qualification level = deprecated`** (T9 data half).
- 📝 **This plan doc** — `docs/plans/wave-7.0.5-multi-profile-architecture-refinements.md`.

---

## §4. Queued for later waves

- **Wave 5.2.x — Drift detector enhancements**
  - T3 (dose-aggregation discrepancy request)
  - T6 (source structural columns)
  - T7 (vegan-compat cross-check)
- **Wave 7.x — Canonical-claim + view refactors**
  - T2 (canonical-claim identity refactor; **blocks** T3)
  - T4 (Marketing dual-mode)
  - T10 (example cleanup)
  - T11 (architecture doc rewrite)
- **Wave 8.x — Cross-departmental workflow**
  - T5 (formulation-opportunity request primitive; re-orients the org flow MKT → RES → PD)
- **Wave 9.x — Evidence canonical migration**
  - T8 (DOI-based dedup with annotation preservation)

---

## §5. Cross-wave interop diagram

The refinements chain. Nothing downstream can run correctly until T1 (dose_sensitivity seed) is in the data:

```
               ┌─────────────────────────────┐
               │ T1  dose_sensitivity column │  ◄── SHIPPED
               │     on Claim Prefixes       │
               └──────────────┬──────────────┘
                              │
            ┌─────────────────┴─────────────────┐
            ▼                                   ▼
 ┌──────────────────────┐           ┌──────────────────────────┐
 │ T2  canonical-claim  │           │ T11  architecture doc    │
 │     identity refactor│           │      §1 rewrite          │
 │     (Wave 7.x)       │           │      (Wave 7.x)          │
 └──────────┬───────────┘           └──────────────────────────┘
            │
            ▼
 ┌──────────────────────────┐
 │ T3  dose-aggregation     │
 │     discrepancy request  │
 │     (Wave 5.2.x)         │
 └──────────────────────────┘

 ┌──────────────────────────┐      ┌──────────────────────────┐
 │ T6  source columns       │ ───► │ T7  vegan-compat         │
 │     on AI Forms          │      │     drift rule           │
 │     (Wave 5.2.x)         │      │     (Wave 5.2.x)         │
 └──────────────────────────┘      └──────────────────────────┘
     (independent chain; enabled by Wave 4.1b Lifestyle axis)

 ┌──────────────────────────┐
 │ T4  Marketing dual-mode  │
 │     (Wave 7.x)           │
 └──────────────┬───────────┘
                │  informs
                ▼
 ┌──────────────────────────┐
 │ T5  formulation-         │
 │     opportunity request  │
 │     (Wave 8.x)           │
 └──────────────────────────┘

 ┌──────────────────────────┐
 │ T8  Evidence canonical   │  (standalone; Wave 9.x)
 │     uniqueness migration │
 └──────────────────────────┘
```

**Critical path:** T1 → T2 → T3. Everything gated on canonical-claim correctness lives on this spine. **Second independent spine:** T6 → T7, gated only on the Wave 4.1b Lifestyle axis already being in place.

---

## §6. Open questions for Gina (follow-up comments)

1. **`plays a critical role in`** — is it `dose_agnostic` (our assumption), or does it have a different rule? Affects T1 seed.
2. **`dose_qualified` prefixes** — can these only attach to a canonical claim that already exists at a higher RCT-proven dose, or can they stand alone? This determines whether the drift detector should refuse new `nutritional support for` claims that lack a sibling `supports` claim.
3. **Vegan-compat cross-check (T7)** — strict (block or require operator override) or advisory (surface warning in drift but don't block publication)?
4. **`source_type` enum (T6)** — should `fermentation` be a separate value from `synthetic`? Our lean is yes (they answer different consumer questions), but confirm.
5. **Allergen list** — FDA Big 9 as the baseline, or Nordic-specific extension (e.g., shellfish for some omega-3 sources, even where the finished form is shellfish-free)? We'd rather capture more than we surface.

---

## §7. Risks

- **Dose_sensitivity seeding is Gina's interpretation.** RA may contest specific assignments when they come online. Mitigation: ship the column + current seeds, but make the mapping editable per-prefix from a super-user admin surface so RA can challenge values without a code deploy.
- **Evidence canonical migration (T8) is the highest-risk data move in this set.** Two studies sharing a DOI but carrying different researcher annotations is rare but not zero; a naive merge erases per-researcher context. Migration script MUST lift every distinct annotation onto the `evidence_packet` join before consolidating the Evidence row, and should dry-run into a staging table with a human-reviewable diff.
- **Re-framing PD's role (Finding 4, T5) is organizationally sensitive.** Before we model the formulation-opportunity request as a first-class primitive, Garrett should confirm the MKT → RES → PD flow with the actual department heads. It's possible the commenters are describing a recent shift rather than a long-standing convention, and PD may still see themselves as central. An architecture that names the flow wrong *loudly* will cost more than one that stays generic.
- **T4 Marketing audit mode is cheap to build and easy to get wrong.** The grouping order (`supports` > `nutritional support for` > `required for`) reads as strength-ranked, but `required for` is mechanistic and isn't strictly weaker. Consider a non-linear display (two columns: "quantitative claims" vs "mechanistic claims") before defaulting to a single descending-strength list.

---

## §8. Deliverable status

This document is the §3 deliverable. T1 and the data half of T9 are already in the Claim Prefixes DB. T2, T10, T11 are the natural next Wave 7.x tickets to queue once Garrett confirms §6 questions with Gina.
