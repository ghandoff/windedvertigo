# Wave 5 — Product Labels

> **Status:** Planning artifact — no application code.
> **Author:** Claude (planning), Garrett (direction)
> **Date:** 2026-04-21
> **Dependencies:** Wave 4.1 (demographic axis restructure), Wave 4.5 (Research Requests activation)

---

## 1. Problem statement & strategic framing

The PCS platform today is **PCS-document-centric**: the PCS PDF (soon the Notion-backed Living PCS, Wave 4.3) is the substantiation-of-record for a *product concept*. But Nordic ships **products**, not PCS documents. A product lives on a shelf, on a retailer's site, and on a lawyer's desk — as a **label**. The label is what the consumer reads, what the regulator inspects, and what a plaintiff attorney will photograph.

Today we have **no first-class record** of what each actual SKU's label says. We trust, without verification, that every label faithfully reflects its backing PCS. That trust has three specific failure modes that Wave 5 addresses:

1. **Claim drift.** PCS says "supports cognitive function" (a structure-function claim acceptable under DSHEA); the label in production says "supports brain health and focus" (acceptable) or worse "improves memory" (implied disease claim — higher risk). There is currently no mechanism to detect this gap.

2. **Ingredient-safety drift.** A new systematic review appears suggesting that children's gummy magnesium supplementation at >160 mg/day risks osmotic diarrhea in the 4-8 age group. Research (Sharon/Gina/Adin/Lauren) reads the paper. They cannot, today, ask the system "which of our labels expose us to this risk?" without a manual label-by-label review. This is exactly the kind of question that leads to a class action if unanswered for 18 months.

3. **Claim-copy cold start.** Every time a new PCS is authored, Marketing has to translate approved claims into consumer-facing copy. This happens by hand, inconsistently, and the result rarely round-trips back to the PCS for re-verification. There is an obvious automation here — but only if we have labels as first-class data.

### Why this reshapes the data model

Adding Labels as a first-class entity reframes the platform from **PCS-centric** to **product-centric**:

```
  PCS-centric (today)                  Product-centric (Wave 5+)

  PCS Document                         Product (implicit, via SKU)
      │                                    │
      ├── Version                           ├── Label ───► Claims (copy variant)
      ├── Formula Lines                     │       ├── Ingredient List
      ├── Claims ───► Evidence              │       ├── Demographic (as-marketed)
      └── Revision History                  │       └── Regulatory framework
                                            │
                                            └── PCS Document (substantiation-of-record)
                                                    └── (existing structure)
```

This doesn't replace anything — it **adds a second anchor**. The PCS remains the substantiation source of truth; the Label becomes the market-facing source of truth. Discrepancies between the two are, by definition, regulatory risk.

---

## 2. Notion schema — `Product Labels` DB

> **Existing entity reuse:** Ingredients, Ingredient Forms, Claims, Canonical Claims, Evidence, PCS Documents are already in the workspace. Labels **relate to** them — we do not duplicate.

### Property schema

| Property | Type | Rationale |
|---|---|---|
| **SKU** | Title | Natural key. Nordic's own SKU (e.g. `01740-EN`). One label = one SKU. |
| **UPC** | Rich text | Secondary natural key; enables cross-reference with retailer feeds. |
| **Product Name (as-marketed)** | Rich text | The name on the label, which can differ from the PCS "Finished Good Name." Divergence is itself a drift signal. |
| **Label Image** | Files & media | Front + back label scan/photo/PDF. Supports multiple files for multi-panel labels. |
| **Label Version Date** | Date | Revision date printed on the label (if any) + date the file was captured. Drives freshness checks. |
| **Regulatory Framework** | Select | `FDA (US)`, `Health Canada`, `EU EFSA`, `ANVISA (Brazil)`, `FSANZ (AU/NZ)`, `Other`. Critical because claim admissibility varies by jurisdiction. |
| **Market(s)** | Multi-select | Countries/regions the label is distributed in. May differ from regulatory framework (a multi-market label under FDA but sold in Canada under NAFTA). |
| **Demographic (as-marketed)** | Relation → N/A (see below) | The demographic *shown on the label*. Mirrors the four-axis structure from Wave 4.1. See note. |
| **Approved Claims (on label)** | Rich text list (bullet list) | The exact claim copy that appears on the label, one bullet per claim. Not a multi-select — we want the verbatim text for drift diffing. |
| **Ingredient List (as printed)** | Relation → **Ingredients DB** (existing) | Leverages existing `NOTION_PCS_INGREDIENTS_DB`. Order matters (order as printed) — enforced via a derived rollup or a sibling "ingredient sequence" text field. |
| **Ingredient Doses** | Rich text (structured) | Per-ingredient doses as printed. Stored as structured text (e.g. JSON) to preserve unit + amount. Alternative: a Labels-Ingredients join DB if structure becomes a problem — leave as rich text for now, revisit if queries demand it. |
| **DV% Compliance** | Formula / Rollup | Flag when printed % Daily Value doesn't match computed value from dose + DRI table. |
| **PCS Document** | Relation → **PCS Documents DB** (existing) | Many-to-one. Multiple labels (different SKUs/markets) can back one PCS. This is the anchor for drift detection. |
| **Linked Evidence** | Relation → **Evidence Library DB** (existing) | Many-to-many. Populated via fan-out from PCS claims + direct ingredient linkage. Enables the safety cross-check. |
| **Status** | Select | `Active`, `Discontinued`, `In Review`, `Needs Reprint`. Drives which labels participate in drift sweeps. |
| **Last Drift Check** | Date | Timestamp of the most recent automated drift comparison against its PCS. |
| **Drift Findings** | Relation → **PCS Requests DB** (existing) | Open Research Requests originating from drift detection on this label. |
| **Owner** | Person | Who on the Research/RA team is responsible for this label's accuracy. |
| **Notes** | Rich text | Free-form. History of reprint decisions, packaging quirks, etc. |

### A note on demographic

Wave 4.1 restructures PCS demographic into four axes (Biological Sex, Age Group, Life Stage, Lifestyle). **Labels should mirror that exact structure.** The divergence between `Demographic (on PCS)` and `Demographic (as-marketed)` is itself a drift signal — e.g., PCS targets "Adult" but label shows "Teen & Adult" → widens the substantiation burden.

Implement as four multi-selects parallel to the PCS version page, or as a single relation to a shared "Demographic Tag" DB if we want to unify vocabulary across PCS and Labels. **Recommendation:** shared vocabulary via a new `PCS Demographic Tags` DB. Prevents the two sides drifting apart on terminology itself.

### Views

| View name | Filter / sort | Purpose |
|---|---|---|
| **All Active Labels** | Status = Active | Default surface for Research/RA. |
| **By PCS** | Group by PCS Document | Audit: which SKUs are backed by this PCS? |
| **By Ingredient** | Group by Ingredient List (relation) | For the safety cross-check — "which labels contain magnesium citrate?" |
| **By Demographic** | Group by Life Stage + Age Group | For demographic-risk audits (children, prenatal). |
| **By Regulatory Framework** | Group by Regulatory Framework | For jurisdictional compliance reviews. |
| **Drift Review Queue** | Drift Findings is not empty & Status ≠ Discontinued | RA daily triage. |
| **Needs Review** | Last Drift Check > 90 days ago | Surface stale labels for the nightly sweep. |
| **By Owner** | Group by Owner, Sort by Last Drift Check | Personal queue view. |

---

## 3. Updated relation diagram

```
                     PCS Documents ────────┐
                          │                 │
                    Versions    Formula Lines ──► Ingredients ◄── Ingredient Forms
                          │                 │         ▲
                    Claims ──► Evidence Packets ──► Evidence Library
                                                        │
                                                        ▼
                                                   References
                          ┌──────────── Product Labels (NEW Wave 5)
                          │                 │
                          │          ├── Ingredient List (→ Ingredients)
                          └── PCS    ├── Linked Evidence (→ Evidence Library)
                                     ├── Drift Findings (→ PCS Requests)
                                     └── Demographic (→ Demographic Tags, shared w/ Versions)
```

No existing relations are modified. Labels **consume** existing entities. The only structural addition beyond Labels itself is the optional shared `PCS Demographic Tags` DB (not strictly required — could be two parallel multi-selects).

---

## 4. PCS ↔ Label drift detection

### What counts as "drift"?

Five concrete drift categories, each a different Request type:

| Drift type | Compares | Acceptable variance | Severity |
|---|---|---|---|
| **Claim text drift** | Label's printed claims vs PCS's approved Claims (3A table). | Paraphrase within regulator-acceptable bounds (LLM-assessed similarity). | High |
| **Unauthorized claim** | Label has a claim that does *not* appear in PCS 3A. | Zero tolerance. | Critical |
| **Ingredient list drift** | Label's ingredient set vs PCS's formula lines. | Order can differ (alphabetical vs composition); presence/absence cannot. | Critical |
| **Dose drift** | Label's printed doses vs PCS formula-line doses. | ±0% on actives; trace for excipients OK. | Critical |
| **Demographic drift** | Label's as-marketed demographic vs PCS demographic. | Label subset-of PCS is OK; label superset-of PCS is drift. | High |

### When does drift get detected?

Three triggers, layered:

1. **On PCS update** — when a new PCS version commits, enumerate backing labels → queue drift check per label.
2. **On Label update** — when a label is created or its claims/ingredients edited → queue drift check.
3. **Nightly sweep** — re-check all Active labels whose `Last Drift Check > 90 days`, to catch cases where the PCS was edited through an unusual path.

All three feed the same drift-check function; they differ only in which labels enter the queue.

### Drift detection pseudocode

```js
// src/lib/label-drift.js (future)
async function detectDriftForLabel(labelId) {
  const label = await getLabel(labelId);
  const pcs = await getDocument(label.pcsDocumentId);
  const pcsClaims = await getClaimsForDocument(pcs.id);
  const pcsFormula = await getFormulaLinesForDocument(pcs.id);

  const findings = [];

  // Claim text drift — uses Claude to assess semantic similarity
  for (const labelClaim of label.approvedClaims) {
    const bestMatch = await findBestClaimMatch(labelClaim, pcsClaims); // LLM-scored
    if (!bestMatch) findings.push({ type: 'unauthorized-claim', labelClaim });
    else if (bestMatch.similarity < 0.85) findings.push({
      type: 'claim-text-drift',
      labelClaim,
      pcsClaim: bestMatch.claim.text,
      similarity: bestMatch.similarity,
    });
  }

  // Ingredient list + dose drift — deterministic set math
  const labelIngredients = new Map(label.ingredientDoses);   // ingredient → dose
  const pcsIngredients = new Map(pcsFormula.map(f => [f.ingredientId, f.dose]));
  for (const [ing, dose] of labelIngredients) {
    if (!pcsIngredients.has(ing)) findings.push({ type: 'ingredient-drift', ing });
    else if (!dosesMatch(dose, pcsIngredients.get(ing))) {
      findings.push({ type: 'dose-drift', ing, labelDose: dose, pcsDose: pcsIngredients.get(ing) });
    }
  }
  for (const ing of pcsIngredients.keys()) {
    if (!labelIngredients.has(ing)) findings.push({ type: 'missing-ingredient', ing });
  }

  // Demographic drift
  const driftDemo = diffDemographic(label.demographic, pcs.demographic);
  if (driftDemo.labelIsSuperset) findings.push({ type: 'demographic-drift', driftDemo });

  // Write findings to PCS Requests (Wave 4.5 mechanism)
  for (const f of findings) {
    await upsertRequestFromDrift({ labelId, pcsId: pcs.id, finding: f });
  }

  await markDriftChecked(labelId);
  return findings;
}
```

The per-finding `upsertRequestFromDrift` routes to RA with a pre-filled Notion-block diff. This is the Wave 4.5 interop point — Wave 5 assumes Wave 4.5's Research Request generator is live.

---

## 5. Ingredient safety cross-check

This is the "magnesium gummies in children" scenario. The trigger is new information about a specific ingredient at a specific dose range in a specific population. The goal is a durable, crash-safe fan-out across the catalog.

### High-level flow

```
  Trigger: Evidence row added/updated with safety implications
      │
      ▼
  Human flags: "This is a safety signal for ingredient X at dose Y for population Z"
      │
      ▼
  Workflow: find all Labels with Ingredient X, Dose ≥ Y, Demographic ∩ Z ≠ ∅
      │
      ▼
  For each matched Label:
      - Open a Research Request ("Safety-review triggered by Evidence #1234")
      - Route to RA + cc Research
      - Link the Evidence row + the triggering paper
      - Set priority = "Safety" (new priority tier)
      │
      ▼
  Slack: RA lead gets a single digest message listing matched SKUs with severity
      │
      ▼
  On RA resolution: each Label's "Last Safety Review" date stamped
```

### Why this is a Vercel Workflow DevKit workload

**Not** a cron job, **not** an ad-hoc request handler. Specifically:

- **Crash-safe fan-out.** Matching 200 labels means 200 Notion writes. If a deploy happens mid-fan-out, we want the workflow to resume where it left off, not start over.
- **Async human step.** After the workflow opens requests, it should wait — durably, for days or weeks — for RA to resolve each one. When all are resolved, emit a "safety sweep complete" event to Slack. Request handlers cannot do this; cron would have to poll.
- **Retries on Notion/Slack flakes.** Each step can retry with exponential backoff without our code carrying retry logic.

### Workflow sketch (conceptual — not real code)

```ts
// src/workflows/ingredient-safety-sweep.ts (future)
import { workflow, step } from '@vercel/workflow';

export const ingredientSafetySweep = workflow({
  input: z.object({
    evidenceId: z.string(),
    ingredientId: z.string(),
    doseThreshold: z.number(),
    doseUnit: z.string(),
    demographicFilter: DemographicFilterSchema,
    triggeringUserId: z.string(),
  }),
}, async (input, ctx) => {
  // Step 1: enumerate matching labels (idempotent read)
  const matches = await step('enumerate-matches', async () =>
    findLabelsByIngredientDoseAndDemographic(input)
  );

  // Step 2: fan-out — open one Research Request per matched label
  const requests = await step.forEach(matches, async (label) =>
    step(`open-request-${label.id}`, async () =>
      openSafetyReviewRequest({ labelId: label.id, ...input })
    )
  );

  // Step 3: notify RA lead with digest (single Slack message, not 200)
  await step('notify-ra', async () =>
    slackPost({
      channel: '#ra-safety',
      text: buildSafetyDigest(requests, input),
    })
  );

  // Step 4: durable wait for all requests to resolve (days or weeks)
  await step.parallel(requests.map(r =>
    step.waitForWebhook(`request-${r.id}-resolved`, { timeout: '90d' })
  ));

  // Step 5: emit completion event
  await step('notify-complete', async () =>
    slackPost({
      channel: '#ra-safety',
      text: `Safety sweep for ${input.ingredientId} complete. ${requests.length} labels reviewed.`,
    })
  );
});
```

**Key dependencies:**
- `@vercel/workflow` package and Vercel Workflow DevKit (docs: https://vercel.com/docs/workflow) — research current API before implementing.
- `step.waitForWebhook` or equivalent durable-wait primitive — confirm exact name in current Workflow DevKit release before committing to a design.
- Research Request resolution in Notion needs to trigger a webhook back into the workflow. Options: (a) Notion webhooks, (b) a poll-step that checks Notion status every N hours, (c) a manual "mark complete in the UI" button that posts to the webhook URL. Option (c) is most reliable; option (a) depends on Notion's webhook maturity.

**Infrastructure prerequisites (before first workflow lands):**
- Project must be linked: `vercel link` (already done — `.vercel/project.json` present).
- Environment must include `VERCEL_OIDC_TOKEN` for AI Gateway access: `vercel env pull` against the Production scope. Workflow DevKit steps that call LLMs (e.g. the claim-similarity scorer in §4) route through AI Gateway and require this token.
- If any workflow step makes LLM calls, confirm the `ai-gateway` provider is configured (see `src/lib/llm.js`) and that the OIDC token is refreshed on deploy — Vercel handles the refresh automatically for deployed workflows, but local `vercel dev` requires a re-pull after 12 hours.
- Follow up: add a one-line `docs/runbooks/workflow-setup.md` covering the OIDC flow when Wave 5.4 starts.

---

## 6. Label import path

### Interim — Notion "Label Intake" page (start this week)

Create a Notion page at the root of the PCS workspace titled **"Label Intake"**. Structure:

- A table at the top: `SKU | PCS ID | Label File | Date Received | Ingested?`
- One row per label. Research/Gina uploads the label image/PDF into the row's file cell.
- A one-off script, `scripts/ingest-label-intake.mjs`, reads the page, downloads the files, runs vision extraction, creates Product Labels rows, and checks off `Ingested?` when done.

This is **good enough for the first 20 labels Gina is sharing**. It gets Labels data into the system this week, while the proper import UI is still a few weeks out.

### Permanent — `/pcs/admin/labels/imports`

Mirror the existing PCS batch importer (`/pcs/admin/imports`):
- Drag-drop zone for label images (PNG/JPG/PDF)
- Per-file progress bar via existing direct-to-Blob upload
- Stage → extract → commit state machine, using the existing `pcs-import-runner` but with a `labelExtraction` commit path
- Preflight Haiku classifier: "is this a supplement label?" before burning Sonnet on extraction
- Dedup by SKU + label version date

File-by-file effort estimate: medium-small (maybe 60% of the existing PCS importer, since the infra is reusable).

### Label extraction — Claude vision prompt design

Extraction is qualitatively different from PCS extraction. PCS is a structured Word document with tables; labels are **photographs of curved plastic bottles with bad lighting**. Claude Vision (Sonnet 4.5) is the right tool, but the prompt must tolerate:

- Low image quality, oblique angles, glare
- Text that wraps in unusual places
- Regulatory disclaimers in 6pt font
- Multi-panel labels (front, back, side, sometimes a peel-off)

**Prompt structure** (sketch, not final):

```
Role: Extract a supplement product label from the provided images into strict JSON.

Output schema: { productName, brandName, sku, upc, servingSize, netQuantity,
                 ingredients: [{ name, dose, doseUnit, dailyValuePercent, isActive }],
                 claims: [{ text, location: 'front' | 'back' | 'side', prominence: 'primary' | 'secondary' }],
                 directions, warnings, demographicIndicators, regulatoryFramework,
                 manufacturerInfo, lotNumber, expirationDate,
                 confidence: { perField: {...}, overall: number } }

Rules:
1. Extract only text visibly present on the label. Do not infer.
2. For each field, provide a confidence score 0-1.
3. If a field is unreadable, set it to null and note in `confidence.perField` with reason "unreadable".
4. Claims = sentences that attribute a benefit to the product or an ingredient.
   This includes FDA disclaimers even though they're boilerplate.
5. Ingredients = only what appears in the Supplement Facts panel. Do not include
   "Other ingredients" unless explicitly asked.
6. If multiple panels show the same field with different values, flag as
   `confidence: { perField: { <field>: 'conflict' } }` and return both values.

Confidence thresholds:
  - overall < 0.7 → route to human for validation before commit
  - any active ingredient dose < 0.8 → require human confirmation
  - unauthorized-claim detection fires automatically post-commit
```

**Validation gate:** labels with any active ingredient at confidence < 0.8 land in a "Needs human validation" bucket on the dashboard before they hit drift detection. We never auto-commit a dose extraction we're unsure about.

---

## 7. Future automation — claim-copy drafting

Not shipping in Wave 5, but shaping the data model here means we don't have to refactor later.

### User story

A Product Manager at Nordic is launching a new SKU. The PCS is approved, claims 3A are locked. The PM opens the new Label row in Notion, clicks "Draft claim copy," picks the regulatory framework and tone (clinical vs consumer vs athletic), and gets back 3-5 variant headlines per claim, each annotated with the source claim number.

### UX sketch

```
┌──────────────────────────────────────────────────────┐
│ Draft Label Copy — SKU 01740-EN                      │
│                                                      │
│ Backing PCS: PCS-0137v2.1                            │
│                                                      │
│ Regulatory framework: ● FDA  ○ Health Canada  ○ EU   │
│ Tone:                 ○ Clinical  ● Consumer  ○ Athletic│
│ Character budget:     ● short (≤25)  ○ medium  ○ long │
│                                                      │
│ Approved claims to draft from:                       │
│   ☑ Claim 1: supports cognitive function             │
│   ☑ Claim 2: supports cardiovascular health          │
│   ☐ Claim 3: supports immune function                │
│                                                      │
│            [Generate 3 variants per claim]           │
│                                                      │
│ ────────────────────────────────────────────────     │
│ Claim 1 drafts:                                      │
│   1. "Brain support for everyday focus"              │
│   2. "Helps you stay sharp"                          │
│   3. "Cognitive support for a clear mind"            │
│   [Copy all] [Export to doc]                         │
└──────────────────────────────────────────────────────┘
```

Each variant tagged with:
- Source PCS claim number (round-trip traceability)
- LLM confidence that the variant stays within regulatory admissibility for the selected framework
- Warnings if a variant uses verbs on the FDA "disease-claim watch list" (cure, treat, prevent, diagnose, etc.)

### Prompt shape

```
Role: Draft consumer-facing label copy variants from substantiated PCS claims.

Constraints:
- Framework: {FDA/DSHEA | Health Canada NHPD | EU EFSA}
- Tone: {clinical | consumer | athletic}
- Character budget: {short ≤25 | medium ≤40 | long ≤80}
- Preserve the claim's causal structure (ingredient → benefit → population)
- Never add claims not in the source
- Never use disease-claim verbs: treat, cure, prevent, diagnose, heal

Input: approved PCS claim with evidence summary
Output: 3 variants per claim, each annotated with source claim ID
        + self-assessed risk score for the chosen regulatory framework

Safety: never output; always draft. Human approves before publish.
```

Hard rule: **never auto-writes to a label.** Drafts land in a side panel for PM review. The human always presses Copy.

---

## 8. Rollout phases

### Dependencies before Wave 5 can start

- **Wave 4.1 demographic axis restructure** must ship — Labels mirror PCS demographic structure.
- **Wave 4.5 Research Requests activation** must ship — drift findings need the Request generator.
- **Wave 4.3 Living PCS view** is not strictly required but strongly complementary — the Label page will link to the Living PCS view for side-by-side drift comparison.

### Phases within Wave 5

| Phase | Scope | Rough effort |
|---|---|---|
| **5.0 — Schema + interim intake** | Create Product Labels DB with full property schema. Create Demographic Tags DB (shared w/ Wave 4.1). Create Notion "Label Intake" page. Write `scripts/ingest-label-intake.mjs`. Ingest Gina's initial 20 labels. | S |
| **5.1 — Label extraction via Claude Vision** | Build the label extraction module (`src/lib/label-extraction.js`) with the prompt from §6. Wire into the intake script. Add confidence-gating logic. | M |
| **5.2 — Drift detection v1** | Ship the five drift checks from §4 (claim text, unauthorized, ingredient, dose, demographic). Hook into Wave 4.5 Request generator. PCS-update and Label-update triggers only; no nightly sweep yet. | M |
| **5.3 — Permanent import UI** | `/pcs/admin/labels/imports` mirroring the PCS importer. Replaces the manual script. | M |
| **5.4 — Nightly drift sweep + safety workflow** | Cron for daily drift check on stale labels. Workflow DevKit implementation of the ingredient-safety fan-out from §5. | L |
| **5.5 — Claim-copy drafting UI** | The §7 user story, behind a feature flag. Research-team-only until regulatory review. | L |

### Gate between phases

- **5.0 → 5.1:** must have 20 labels loaded (Gina's set) and a Research team member can browse by ingredient.
- **5.1 → 5.2:** must have extraction confidence ≥ 0.85 on overall-score for 18 of the 20 seed labels.
- **5.2 → 5.3:** must have caught at least one drift finding on the 20 seed labels (otherwise the detector is broken or the labels are too aligned to prove the check works — in which case, seed a synthetic drift).
- **5.3 → 5.4:** must have 50+ labels in the system to make the workflow orchestration worth its complexity.
- **5.4 → 5.5:** stretch; gate on product leadership signoff.

---

## 9. Open questions for the user

1. **Demographic Tags DB — shared or parallel?**
   Should we create one `PCS Demographic Tags` DB used by both PCS Versions (Wave 4.1) and Product Labels (Wave 5)? Or keep the four multi-select properties duplicated on each side? Shared is cleaner; parallel is simpler to ship.

2. **Label dose storage — rich text vs join DB?**
   Per-ingredient doses on a label are structured data. We can store them as structured rich text (JSON in a Notion text field) or as a `Labels × Ingredients` join DB with a `Printed Dose` property. Join DB is more queryable but adds a fifth entity for Wave 5. Recommendation: start rich text, promote to join DB in Wave 5.2 if drift detection queries struggle.

3. **Who owns a Label?**
   Is the Owner property meaningful across the team, or does Research always own labels until they go live and then RA owns? Clarify the handoff rule before building the "Owner" filter views.

4. **Retailer feeds?**
   Should Wave 5 also pull product listings from Amazon / Nordic retailer channels to detect labels *being sold* that drift from the label we have on file? This is a significant scope expansion — flagging for now, not scoping.

5. **Ingredient forms integration.**
   The existing Ingredient Forms DB stores form-specific variants (e.g. magnesium citrate vs oxide). Should Label ingredients relate to Ingredient Forms (tighter) or just Ingredients (looser)? Tighter is safer for the safety cross-check (different forms have different NOAELs) but requires labels to specify form, which they don't always.

6. **Regulatory tolerance for claim paraphrasing.**
   The claim-text drift check uses LLM-assessed semantic similarity with a 0.85 threshold. Is that calibrated? RA should review 10-20 real drift findings to sanity-check.

7. **Claim-copy drafting publication pipeline.**
   If Wave 5.5 ships, how do approved variants get to the actual label artwork files? Is there a Nordic design/packaging system we integrate with, or does copy live only in Notion until it's manually handed to the packaging designer?

8. **Safety signal declaration flow.**
   The safety workflow fires when a human declares an Evidence row a safety signal. What's the UX for that declaration? A checkbox on the Evidence page + dose threshold fields? A separate "Safety Alerts" DB? Recommend: a simple "Safety signal" checkbox + structured alert fields on Evidence, rather than a whole new DB.

---

## 10. Cross-wave interop notes

- **Wave 4.1** (demographic axes) blocks Wave 5 schema. Ship 4.1 first.
- **Wave 4.3** (Living PCS) benefits from Wave 5 because the Living PCS view gains a "Related Labels" sidebar.
- **Wave 4.5** (Research Requests) is the glue — Wave 5 drift detection produces Request rows; Wave 4.5's workflow owns the lifecycle and notification.
- **Wave 3.7** (template classification) flows through — a Label whose PCS is `Legacy pre-Lauren` inherits a warning badge, so operators know the substantiation below it is pre-standard.

---

*End of plan.*
