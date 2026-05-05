# Claim Vocabulary Redundancy Analysis — 2026-05-03

**Author:** Garrett Jaeger
**Inputs:**
- Lauren's AICS-0004v0.1 INTERNAL USE ONLY — Vitamin D3 Active Ingredient Claims Substantiation (Google Doc `1sIit2mSxVHymm4d-XPFcylgjxCdtSqUo`)
- Live snapshot of `NOTION_PCS_CLAIMS_DB` = `661ffecd-c3f1-4b68-b216-d068df38fa18` (sampled via Notion search, 2026-05-03)
- Live snapshot of `NOTION_AICS_CLAIMS_DB` = `2571a98a-2d2c-4b05-b518-56857b57c85f` (currently empty — DB created today)

**TL;DR:** Lauren's AICS template encodes a clean three-tier vocabulary (Category → Claim Family → Phrasing Variants). The current PCS Claims DB doesn't honor it — variants are stored as standalone claims, no category prefix, and the same claim text appears 2–4× under different page IDs. We can collapse what looks like ~80–100 PCS claim rows into ~25–30 canonical claim families plus a phrasing-variant table. Below: the structure, the evidence, and a proposed migration.

> **2026-05-03 update — the infrastructure already exists.** A deeper inspection of the live Notion workspace turned up four supporting databases that match this report's proposal almost exactly:
>
> - **Canonical Claims DB** (`f6e58750-…`) — Tier-2 canonical claim per Lauren's vocabulary. Has `Canonical claim`, `Canonical key`, `Claim family` (Mood/stress, Sleep, Cognition, Cardiovascular, Muscle, Energy/metabolism, Cellular signaling, Deficiency, Other), `Dedupe decision` (keep-survivor / retire-into-other / archive / actually-different / needs-more-info), `Evidence tier required`. ~25 canonical entries already populated.
> - **Core Benefits DB** (`f8aaa39f-…`) — Tier-1 (slightly finer-grained than the categories cv table). ~25 entries: `bone health`, `cognitive health`, `normal vision`, `joint mobility`, etc.
> - **Claim Prefixes DB** (`7ed1891c-…`) — Tier-1.5 strength axis. Has `Regulatory tier` (Structure-function / Nutritive support / Essentiality / Conditional / Mechanistic), `Qualification level`, `Evidence type`, `Dose sensitivity`. ~18 prefix entries (`Supports`, `Required for/Plays a critical role in/Supports`, `Nutritional support for`, `Helps`, `Helps to maintain`, `One serving`, etc.).
> - **Claim Wording Variants DB** (`52c486b0-…`) — Tier-3 storage. Has `Wording`, `PCS Claim` (single relation back), `Is primary`, `Variant notes`.
>
> So Phase 4.6 is **not "add new structure"** — it's **"backfill the existing structure"**. The PCS Claims DB has `Canonical Claim`, `Core benefit`, `Claim prefix`, and `Wording Variants` properties already wired as relations; they're just unfilled on most rows. The remaining work is a fuzzy-match script that links each raw PCS claim to its canonical entry and splits compound titles into wording variants.

---

## 1. The vocabulary tiers Lauren established

Reading AICS-0004 carefully, every Authorized claim row follows this grammar:

```
{Category}: {Variant 1} / {Variant 2} / {Variant 3} … *
```

- **Tier 1 — Category (the prefix before the colon).** Example values from AICS-0004 alone: `Musculoskeletal`, `Oral Health`, `Immune System`, `Nutrition`, `Biology`. Closed vocabulary. Lauren uses these as the primary axis for "what part of the body / what kind of benefit."
- **Tier 2 — Claim Family (the row itself, identified by `Claim No.`).** Within a category there can be multiple distinct functional contexts. AICS-0004 has **two separate Immune System claims** (Claim 4: "Healthy immunity / Supports a range of natural immune mechanisms / Facilitates critical immune activities / Important for immune system development" vs Claim 5: "Plays a key role in the immune response / Important for the body's innate and adaptive immune response / Seasonal immune support") — these are different mechanisms of substantiation, even though they share a category.
- **Tier 3 — Phrasing Variants (the ` / `-separated alternatives within one claim row).** These are interchangeable label phrasings backed by the same evidence and the same minimum dose. The label writer picks whichever phrasing fits the SKU's tone, and the regulatory provenance is identical.
- **Asterisk suffix (`*`)** = requires FDA/DSHEA disclaimer. This is metadata, not part of the claim text.

So one Authorized AICS row → one Tier-2 Claim Family with N Tier-3 Phrasing Variants, all sharing the same Tier-1 Category, dose table, and grade.

This is the structure Lauren wants the platform to enforce.

---

## 2. What the live PCS Claims DB looks like

I pulled ~75 distinct titles via Notion search on the PCS Claims data source. The structure is fundamentally different from Lauren's template. Three problems jump out:

### 2.1 Exact-title duplicates with different page IDs

Each row below is one claim; the count is how many separate Notion pages share that exact title.

| Claim title | Duplicate pages |
|---|---:|
| `Supports healthy sleep*` | **4** (`2b039da0`, `ea3c8a90`, `349e4ee7-4ba4-81b4`, `349e4ee7-4ba4-8136`) |
| `Support for healthy bones*` | **3** (`34ae4ee7-…811b`, `…8164`, `…8191`) |
| `Supports mood balance*` | 2 |
| `Supports healthy immunity*` | 2 |
| `Supports healthy vision*` | 2 |
| `May decrease the likelihood of magnesium deficiency*` | 2 |
| `Required for/Plays a critical role in/Nutritional support for a healthy mind and body*` | 2 |
| `Required for/Plays a critical role in/Supports cell/cellular and metabolic health/function*` | 2 |
| `Required for/Plays a critical role in/Supports (normal) muscle activity/function*` | 2 |
| `Required for/Plays a critical role in/Supports cellular energy production*` | 2 |
| `Required for/Plays a critical role in/Supports (healthy) cardiovascular function/heart health*` | 2 |
| `reduces feelings of occasional stress*` | 2 |

That's ≥27 redundant page rows just in the visible sample. Why duplicates exist: each PCS .docx upload creates a new Notion page per claim row, even when the text already exists in the DB. There's no dedupe at the claim level.

### 2.2 Near-duplicates from formatting drift

Same intent, different surface text — these would all collapse into single phrasing variants under Lauren's structure:

| Group | Variants present in DB |
|---|---|
| Magnesium bioavailability | `Highly bioavailable/absorbable form of magnesium` vs `Highly bioavailable/absorbable forms of magnesium` (singular/plural) |
| Magnesium digestive tolerance | `Less likely to cause digestive discomfort than other forms of Mg2+` vs `…Mg²⁺` (ASCII vs Unicode superscript) |
| Mood promotion | `Promotes mood / Promotes positive mood` vs `Promotes mood / Promotes positive mood*` (asterisk drift) |
| Mental relaxation | `Supports mental relaxation / Supports a relaxed state of mind*` vs `Supports mental relaxation/a relaxed state of mind*` (slash-spacing drift) |
| Bone support | `Supports healthy bones*` vs `Support for healthy bones*` (verb-form drift) |
| Mood baseline | `Supports healthy positive mood` vs `Promotes mood / Promotes positive mood` (verb verb drift) |

### 2.3 Pre-merged variants stored as compound titles

Some current rows already encode multiple variants in one title using `/` — but inconsistently. Examples from the live DB:

- `Required for/Plays a critical role in/Supports (normal) muscle/muscular relaxation*`
- `Required for/Plays a critical role in/Supports healthy cardiovascular function/heart health*`
- `Required for/Plays a critical role in/Nutritional support for a healthy mind and body*`

These are doing the same thing as Lauren's ` / `-separated phrasing variants — but with no spaces around the slashes, no category prefix, and embedded inside a single title field instead of being structured. Half of the work is already done; it's just stored as free text.

---

## 3. Proposed three-tier model in the database

Mapping Lauren's grammar onto our existing schema:

| Tier | Storage | Cardinality | Example |
|---|---|---|---|
| **1. Category** | New column `claim_category` (controlled-vocab dropdown, ~15 entries) on `pcs_claims` and `aics_claims`. Already partially modeled by `cv_benefit_categories` (17 rows seeded from Lauren's spec) — just needs to be promoted from a tag to a required field. | ~15 closed values | `Immune System`, `Musculoskeletal`, `Oral Health`, `Cardiovascular`, `Cognitive`, `Sleep`, `Mood`, `Stress Response`, `Digestive`, `Cellular`, `Nutrition`, `Biology` |
| **2. Claim Family** | The existing `pcs_claims` / `aics_claims` row, but with the title field cleaned up to be a *canonical short label*, not the full label-ready phrasing. New column `family_key` for stable cross-doc references. | One row per (Category, Mechanism) pair. ~25–30 total to start. | `immune_system.healthy_immunity`, `immune_system.adaptive_response`, `musculoskeletal.bone_growth_dev` |
| **3. Phrasing Variant** | New child table `pcs_claim_variants` with `(claim_family_id, variant_text, variant_order)`. Operator picks one variant at label-write time. | ~3–8 variants per family | For `immune_system.healthy_immunity`: `"Healthy immunity"`, `"Supports a range of natural immune mechanisms"`, `"Facilitates critical immune activities"`, `"Important for immune system development"` |

The asterisk (FDA/DSHEA disclaimer) becomes a boolean flag `requires_dshea_disclaimer` on the claim family — not part of the text.

The Min Dose × Demographic grid Lauren has in Table 1 already has a home: it's the existing dose tables. No schema change needed there; it just gets attached to the Tier-2 family (so all Tier-3 variants share it).

---

## 4. Concrete dedupe pass on the live data

Here's a first cut at how the visible PCS DB collapses under the proposed model. (I'm working from titles only; final mapping needs to look at each row's references and dose data, but the shape is clear.)

| Proposed Tier-1 Category | Proposed Tier-2 Family | Tier-3 Variants found in current DB | Source rows merged |
|---|---|---|---:|
| Sleep | `sleep.healthy_sleep` | `Supports healthy sleep*`, `Nutritional support for normal sleep` | 5 |
| Musculoskeletal | `musculoskeletal.healthy_bones` | `Supports healthy bones*`, `Support for healthy bones*` | 4 |
| Musculoskeletal | `musculoskeletal.muscle_relaxation` | `Supports (normal) muscle/muscular relaxation`, `Required for/Plays a critical role in/Supports (normal) muscle/muscular relaxation*` | 3 |
| Musculoskeletal | `musculoskeletal.muscle_function` | `Supports (normal) muscle activity/function`, `Required for/Plays a critical role in/Supports (normal) muscle activity/function*` | 3 |
| Cardiovascular | `cardio.heart_function` | `Supports healthy cardiovascular function/heart health`, `Required for/Plays a critical role in/Supports (healthy) cardiovascular function/heart health*` (case + parens drift) | 3 |
| Immune System | `immune.healthy_immunity` | `Supports healthy immunity*` | 2 |
| Mood | `mood.positive_mood` | `Promotes mood / Promotes positive mood`, `Promotes mood / Promotes positive mood*`, `Supports healthy positive mood` | 3 |
| Mood | `mood.mood_balance` | `Supports mood balance*` | 2 |
| Mood | `mood.normal_mood` | `Nutritional support for (certain aspects of) normal mood`, `Supports (certain aspects of) normal mood variants (≥250 mg)` | 2 |
| Stress Response | `stress.healthy_response` | `Magnesium supports a healthy stress response`, `reduces feelings of occasional stress*` | 3 |
| Mental Relaxation | `relaxation.mental` | `Supports mental relaxation / Supports a relaxed state of mind*`, `Supports mental relaxation/a relaxed state of mind*`, `Supports mental relaxation/a relaxed state of mind (≥300 mg)`, `Nutritional support for normal mental relaxation / healthy stress response` | 4 |
| Cognitive | `cognitive.brain_health` | `Nutritional support for normal cognitive/brain health`, `Promotes cognition*` | 2 |
| Cellular | `cellular.metabolic_health` | `Supports cell/cellular and metabolic health/function`, `Required for/Plays a critical role in/Supports cell/cellular and metabolic health/function*` | 3 |
| Cellular | `cellular.energy_production` | `Supports cellular energy production`, `Required for/Plays a critical role in/Supports cellular energy production*` | 3 |
| Vision | `vision.healthy_vision` | `Supports healthy vision*` | 2 |
| Digestive | `digestive.healthy_function` | `Supports healthy digestive function*` | 1 |
| Nutrition | `nutrition.mind_body` | `Nutritional support for a healthy mind and body`, `Required for/Plays a critical role in/Nutritional support for a healthy mind and body*` | 3 |
| Magnesium-specific (delivery-system claim) | `delivery.bioavailable_mg` | `Highly bioavailable/absorbable form of magnesium`, `Highly bioavailable/absorbable forms of magnesium`, `Less likely to cause digestive discomfort than other forms of Mg2+`, `…Mg²⁺` | 4 |
| Vitamin D-specific (delivery-system claim) | `delivery.cholecalciferol_efficacy` | `Cholecalciferol is the more easily utilized/more effective/more efficacious form of supplemental vitamin D` | 1 |
| Activity | `activity.healthy_levels` | `Promotes healthy activity levels*` | 1 |
| Inflammation | `inflammation.healthy_response` | `Healthy response to inflammation*` | 1 |
| Deficiency | `nutrition.magnesium_deficiency` | `May decrease the likelihood of magnesium deficiency*` | 2 |

**Sample-level result:** ~75 visible PCS DB rows collapse to ~22 Claim Families. Extrapolating to the full corpus we should expect to compress by **3–4×**.

---

## 5. The "Required for / Plays a critical role in / Supports" problem

This pattern shows up a *lot* — it's a common claim-prefix family Lauren probably wants to formalize. Looking at the live DB, the same three modal verbs appear together in at least 9 distinct titles:

```
Required for / Plays a critical role in / Supports
```

These three are roughly stronger → weaker substantiation language. They mean different things to a regulator: "Required for" implies essentiality, "Plays a critical role in" implies mechanism, "Supports" implies softer S/F language. They shouldn't actually be interchangeable variants — they should be **three separate Tier-2 families that share a common Tier-1 Category and Tier-3 phrasing pool**.

Recommendation: model `claim_strength` as Tier-1.5 metadata (between Category and Family). Closed values: `essential`, `mechanism`, `support`, `nutrition`, `delivery_system`. The label writer picks the strongest claim the dose + grade combination supports.

This makes Lauren's vocabulary 4-tier actually:

```
Category (Immune System) → Strength (mechanism) → Family (adaptive_response) → Variant ("Plays a key role in the immune response")
```

The current DB has these collapsed because RA reviewers and label writers have been informally combining them. Splitting them out lets dose-by-grade gating work correctly.

---

## 6. Migration plan

### 6.1 Schema additions (Phase 4.6 of Bundle 4 — fits in Budget B retainer)

```sql
-- Adds Tier-1 + Tier-1.5 + Tier-2 stable keys
ALTER TABLE pcs_claims
  ADD COLUMN claim_category text,        -- FK to cv_benefit_categories (already seeded)
  ADD COLUMN claim_strength text,        -- enum: essential, mechanism, support, nutrition, delivery_system
  ADD COLUMN family_key text;            -- e.g. "immune.healthy_immunity"

ALTER TABLE aics_claims
  ADD COLUMN claim_category text,
  ADD COLUMN claim_strength text,
  ADD COLUMN family_key text;

-- Tier-3 storage
CREATE TABLE pcs_claim_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid REFERENCES pcs_claims(id) ON DELETE CASCADE,
  variant_text text NOT NULL,
  variant_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON pcs_claim_variants (claim_id, variant_order);
```

### 6.2 Backfill heuristic (one-time script, dry-run first)

For each existing PCS claim:

1. Strip leading `Required for/Plays a critical role in/` → write that into `claim_strength = 'mechanism'`.
2. Match the remaining text against a category-keyword map (`immune` → Immune System, `bone|skeletal|muscle|joint` → Musculoskeletal, etc.). Write `claim_category`.
3. Compute `family_key` from a normalized version of the remaining text after stripping verbs ("Supports", "Promotes", "Helps").
4. Group by `family_key`. The group's first claim becomes canonical; the others get their full title moved to `pcs_claim_variants` and the row is marked `archived_redundant = true` with a forward link to canonical.

Estimated yield: 70–80% auto-classification on the visible sample. The remainder needs Lauren or RA to review.

### 6.3 UI changes

- Form-driven entry (Bundle 4 P1): the AI dropdown stays, but add **Category → Strength → Family** cascading dropdowns. Variants become a multi-select pulled from `pcs_claim_variants` for the chosen family.
- AICS detail page Regulatory tab: already has a per-claim row; just exposes `claim_category` + `claim_strength` columns.
- PCS doc detail page: claim chips render `{Category}: {variant chosen}` so labels are auditable.

### 6.4 Sequencing

- This is **Phase 4.6** in the roadmap. Best dropped after Bundle 4 P3 (AI master import lands) so the form has both AIs and structured claim families. Estimated 16–24 hours; fits in a single retainer month.
- Hard prerequisite: Lauren confirms the Category list is closed (or proposes additions). Current `cv_benefit_categories` has 17 rows; my analysis suggests we may want to add `Stress Response`, `Sleep`, `Mood`, `Mental Relaxation`, `Cellular Energy`, `Delivery System` if they're not already covered.

---

## 7a. How to flag redundancies in-platform (for Lauren + RES + RA)

While Phase 4.6 ships, the platform already has the **Wave 6.1 Feedback Button** (floating chat-bubble, bottom-right of every PCS page). Use it as the canonical place to flag claim-vocab issues you spot during preview week and beyond:

- **🐛 Bug** — when something is structurally wrong on a claim row (wrong category mapping, duplicate that auto-dedupe should have caught).
- **❓ Confusion** — when a claim's wording or structure doesn't match the AICS template's grammar.
- **💡 Idea** — when you spot a duplicate, a missing variant, or a category gap. Keep notes concrete:

  > *Idea: "Required for/Plays a critical role in/Supports cellular energy production*" looks like the strength-tier "mechanism" of the canonical family `cellular.energy_production`. Possibly merge.*

These submissions land in Slack `#nordic-platform-feedback` in real time and get triaged into the Phase 4.6 backlog. Concrete examples make the auto-classification heuristic 10× better than abstract instructions ever could.

Operator runbook: `docs/runbooks/wave-6.1-feedback-button.md`.

---

## 7. Open questions for Lauren

1. **Is the category list closed at 17 rows in `cv_benefit_categories`,** or does the redundancy work surface gaps you want to fill?
2. **Should `Required for / Plays a critical role in / Supports` be one tier or three?** I argue three (different regulatory weights). You'd know better whether RA treats them differently in claim review.
3. **The asterisk (`*`)** is purely "requires DSHEA disclaimer on label" — correct? Or does it also imply something about substantiation level?
4. **For dedupe:** do you want the migration script to physically merge duplicate Notion pages, or just mark them archived and keep them as references? Physical merge breaks any existing PCS doc that references the now-deleted page.
5. **Variant ordering:** is there a canonical order (most-preferred phrasing first) or are all variants equally valid?

---

## 8. Companion deliverables when Phase 4.6 ships

- **Operator runbook** (`docs/runbooks/phase-4.6-claim-vocab-tiers.md`) explaining how Category/Strength/Family/Variant flow through the form.
- **Lauren-facing CV proposal** — the canonical category + strength enums, in a sharable Google Doc, ready for RA + Research sign-off before backfill runs.
- **Migration audit log** — every claim that got reclassified, with before/after, kept in `claim_migration_log` so Lauren can spot-check the heuristic.

---

## 9. Source data this report is based on

- AICS-0004v0.1 doc snapshot saved to `/tmp/aics-vocab-content.txt` (463 lines, full text).
- PCS Claims DB sample: 75 distinct titles across 4 search queries (`vitamin D`, `claim`, `supports`, `healthy`). Full enumeration would require pagination — the current MCP search tool caps at 25 results per call. A complete dedupe pass should run a `query_data_sources` over the full DB before backfill.
