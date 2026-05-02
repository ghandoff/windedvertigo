# Wave 4.1b — Demographic Controlled Vocabularies

> **Status:** Planning artifact — no application code.
> **Author:** Claude (planning), Garrett (direction)
> **Date:** 2026-04-21
> **Dependencies:** Wave 4.1a (four-axis architecture, in-flight), Lauren's canonical value lists (pending; Notion intake page `34ae4ee7-4ba4-81d2-9c98-e8000a69d084`)
> **Blocks on:** Lauren response to the demographic questionnaire
> **Unblocks:** Wave 4.5 request-router uses demographic as a routing axis; Wave 5 label demographic drift check needs shared vocabulary.

---

## §1. Problem statement

Wave 4.1a splits the flat `demographic` multi-select into four orthogonal axes (Biological Sex, Age Group, Life Stage, Lifestyle). The axes themselves are structural — each is a Notion `multi_select` with no enumerated options.

That works, but it leaves a gap: two researchers authoring a new PCS could enter `"Pediatric 4-12y"` and `"Pediatric (4-12)"` into the Age Group axis and the system would treat them as different values. Cross-PCS queries, label drift checks, and ingredient-safety fan-outs all break when vocabulary drifts.

Wave 4.1b closes that gap by populating each axis's `multi_select` with Lauren's canonical value list, constraining the extractor prompt to that list, and adding a governance mechanism for adding new values intentionally.

### Why this is a separate wave

Wave 4.1a is shippable without vocabulary because the architectural change (four fields instead of one) has value on its own — it stops co-mingling sex/age/stage/lifestyle into one list. Wave 4.1b adds **quality gates** to what's already a cleaner shape. Splitting lets 4.1a ship while Lauren's input is gathered.

---

## §2. Inputs required from Lauren

The questionnaire at `https://www.notion.so/34ae4ee74ba481d29c98e8000a69d084` asks for the canonical values per axis. The plan below assumes the response includes at minimum:

- A finalized **Biological Sex** list (expected ~3 values: Male, Female, Any)
- A finalized **Age Group** list (expected 5-8 values; open question: whether brackets carry explicit age ranges in their names)
- A finalized **Life Stage** list (expected 8-12 values; physiological-phase vocabulary)
- A finalized **Lifestyle** list (expected 3-7 values; Nordic's target-customer categories)
- Confirmation of the Age Group vs. Life Stage distinction (our proposed framing: chronological vs. physiological)
- Confirmation of whether the Lifestyle axis is aspirational (target segments) or descriptive (indicated populations)
- Any FM-prefix activity types for Table A (side-scope)

If Lauren pushes back on any axis being redundant (e.g. "Age Group and Life Stage always co-vary in practice — just use Life Stage"), we adapt the plan: either collapse axes or keep them and accept correlated data.

---

## §3. Deliverables

### 3.1 Notion schema — enum-constrained multi-selects

For each of the four Versions DB properties added in Wave 4.1a:
- `Biological Sex` (multi_select) → add Lauren's values as allowed options
- `Age Group` (multi_select) → add values
- `Life Stage` (multi_select) → add values
- `Lifestyle` (multi_select) → add values

**Color scheme:** pick a consistent palette so the UI is glanceable. Suggested:
- Biological Sex → pink/blue/gray (conventional)
- Age Group → a spectrum from blue (young) to orange (old)
- Life Stage → green (reproductive-stage-first: pregnancy, lactation) + blue (general)
- Lifestyle → purple (aspirational) / gray (descriptive)

Colors are a light-touch decision — user can override in Notion directly. Pre-pick sensible defaults so Lauren doesn't have to.

### 3.2 Extractor prompt — enum constraint

Update `src/lib/pcs-pdf-import.js` extraction prompt to include the four allowed-value lists inline, with explicit instructions:

```
Demographic extraction — each axis is optional. For each populated axis,
every returned value MUST be drawn from the corresponding allowed list below.
If a value in the source document doesn't match an allowed list, emit it
under a sibling `demographicUnknowns: { <axis>: [value, ...] }` field
rather than forcing a mapping.

Biological Sex allowed: [Male, Female, Any]
Age Group allowed: [list from Lauren]
Life Stage allowed: [list from Lauren]
Lifestyle allowed: [list from Lauren]
```

The `demographicUnknowns` escape hatch is important — it prevents the extractor from silently losing data when a PCS uses a demographic term outside the canonical list. Research can then decide whether to add the term to the canonical list or correct the PCS.

### 3.3 Governance — adding new values

The canonical lists will change over time. Decide the process:

- **Option A (permissive):** Notion-only — anyone with write access to the Versions DB can add a select option on the fly. Low friction, high drift risk.
- **Option B (gated):** Only Lauren (Template-owner role from Wave 4.5) can add canonical values. A `demographicUnknowns` value on an import auto-generates a Research Request routed to Lauren. She either adds the value or edits the PCS.
- **Option C (committee):** New values require approval in a "Demographic Vocabulary Change Request" flow. Heavy-weight.

**Recommendation: Option B.** Matches Wave 4.5's routing pattern and keeps vocabulary drift under the template owner's control without a whole new process.

### 3.4 Backfill — align existing data with the new vocabulary

Wave 4.1a ships a best-guess backfill that splits the old flat `demographic` into the four axes. That backfill writes values as-extracted — no enum validation. Wave 4.1b needs a second pass:

1. For each Version row, walk its four axis properties.
2. For each value, check if it's in the canonical list for that axis.
3. If yes: keep it (no action).
4. If no: append it to `demographicUnknowns.<axis>` on the Version, clear it from the axis property, and generate a Research Request routed to Lauren titled `"Demographic vocabulary mismatch — <PCS ID>"`.

New backfill script: `scripts/backfill-demographic-vocab.mjs`. Mirrors the `--dry-run`/`--limit` pattern from `scripts/backfill-template-classification.mjs`.

### 3.5 Classifier update (Wave 3.7 signal 2)

`src/lib/pcs-template-classifier.js` signal 2 is currently "demographic multi-axis (≥2 axes populated)." Add a sub-signal:

- Positive: ≥2 axes populated AND all values are in canonical vocab
- Warning (doesn't affect template version, but surfaces in `signals.negative`): any `demographicUnknowns` present
- Negative: 0-1 axes populated

### 3.6 UI — axis chips with hover tooltips

Wherever the PCS document/version view renders demographic chips (see Wave 4.1a output), add:
- Chip color inherited from Notion multi-select color
- Hover tooltip showing the axis name + the value's description (if any is set in Notion's property description)
- A small warning dot when `demographicUnknowns` is non-empty, linking to the relevant Research Request

### 3.7 Extractor unknowns handling

In the commit path (`commitExtraction`), when the extraction contains `demographicUnknowns`, wire into Wave 4.5's request generator:

```
if (extraction.demographicUnknowns) {
  for (const [axis, values] of Object.entries(extraction.demographicUnknowns)) {
    for (const value of values) {
      await upsertRequest({
        type: 'low-confidence',         // or a new 'vocab-mismatch' type if we add it
        specificField: `demographic.${axis}`,
        assignedRole: 'Template-owner',
        notes: `PCS contains a demographic value "${value}" in axis "${axis}" that is not in the canonical Lauren v1.0 vocabulary. Decide: add to vocabulary, or correct the PCS.`,
      });
    }
  }
}
```

If Wave 4.5 is not yet live at the time Wave 4.1b ships, fall back to writing `demographicUnknowns` to the Version row as a text field and a warning in the Slack notification. Wave 4.5 activation then migrates those into proper Research Requests.

---

## §4. Rollout sequence

| Step | Action | Gate |
|---|---|---|
| **4.1b.0** | Lauren responds to the questionnaire with canonical lists for the four axes | Human |
| **4.1b.1** | Apply Notion multi-select options (via MCP or migration script); confirm schema | Schema migration produces no write errors |
| **4.1b.2** | Update extractor prompt with allowed-value lists + `demographicUnknowns` escape hatch. Bump `PROMPT_VERSION` to `v2.3-vocab` | Build + tests pass |
| **4.1b.3** | Run `scripts/backfill-demographic-vocab.mjs --dry-run` on all existing Versions; review the `demographicUnknowns` output with Lauren | Lauren agrees dry-run output is correct |
| **4.1b.4** | Run backfill for real (writes to Versions + generates Research Requests) | No errors; Research Request queue populated |
| **4.1b.5** | Update classifier signal 2; re-run `scripts/backfill-template-classification.mjs` to refresh templateSignals | No unexpected template-version downgrades |
| **4.1b.6** | UI chip update + warning dot for unknowns | Visual review |
| **4.1b.7** | Retire the old flat `demographic` property on the Versions DB — finally | All UI reads verified to use the four-axis data |

Step 4.1b.7 is the clean-up that finally deletes the legacy field. Worth doing separately: it's a destructive change that can't be undone without a restore.

---

## §5. Open questions

1. **Age Group naming.** Brackets with explicit ranges (`"Pediatric 4-12y"`) or plain names (`"Pediatric"`)? Explicit is more precise for safety fan-out but more brittle to future re-bracketing.

2. **Single cross-axis value when a PCS target is e.g. "Prenatal women."** Does that populate Biological Sex=Female + Life Stage=Prenatal (two axes) or is there a combined shortcut? Recommendation: two axes — enforces the orthogonal-axis model consistently.

3. **Unisex / "all adults" default.** Should Biological Sex default to `Any` when unspecified, or stay empty? Empty is semantically more honest ("we didn't look into sex-specificity") but adds noise. Recommendation: stay empty, don't auto-populate.

4. **Lifestyle axis cardinality.** If Lauren returns a long Lifestyle list (>10 values), the axis may be too granular — consider a two-tier structure (broad category + specific tag). Defer until Lauren's list is in.

5. **Vocabulary change log.** Should we log additions/removals of canonical values somewhere (Notion page, git-tracked CSV)? Light-weight option: a `docs/vocabularies/demographic-history.md` markdown file edited by whoever ratifies a change. Heavy option: a Notion "Vocabulary Changes" DB. Start light; promote if churn gets high.

6. **Extractor fallback when `demographicUnknowns` is heavy.** If a single PCS extraction produces 8+ unknown demographic values, something's wrong (wrong doc type, extractor regression, or genuinely outside our vocab scope). Propose: threshold at 5 unknowns per doc — above that, flag the whole extraction for human review rather than committing with `demographicUnknowns` populated.

7. **Does Wave 4.3 (Living PCS) wait for this?** Wave 4.3's Table 1 section renders demographic chips. 4.3 can ship against 4.1a (unconstrained chips) and upgrade to vocabulary-aware chips when 4.1b lands — the chip component reads the axis values regardless of whether they're enum-constrained. Recommendation: Wave 4.3 doesn't block on 4.1b.

---

## §6. Cross-wave interop

- **Wave 4.1a** — provides the four-axis structure. 4.1b populates its options.
- **Wave 4.5** — consumes `demographicUnknowns` via the request generator. 4.1b ships after 4.5 generator is live, or with a graceful fallback if it's not yet.
- **Wave 5 (Labels)** — the label demographic drift check compares `label.demographic.<axis>` to `pcs.demographic.<axis>` using the same vocabulary. A vocabulary drift (e.g. label says `"Children"`, PCS says `"Pediatric 4-12y"`) is flagged as a mismatch. 4.1b's canonical vocab is what makes this comparison meaningful.
- **Wave 3.7 classifier** — signal 2 upgrades to check vocabulary compliance in addition to multi-axis population.

---

## §7. Effort estimate

Small-medium wave. Most of the work is migration and governance, not new code:

- Schema migration: ~30 min (MCP-driven)
- Extractor prompt update: ~30 min + prompt testing on 2-3 PCS docs
- Backfill script: ~2 hours
- Classifier + UI updates: ~2 hours
- Rollout coordination with Lauren: variable (depends on her response time)
- Legacy field retirement (4.1b.7): ~30 min once verified

Estimated total: **one working day** once Lauren's input is in hand. The bulk of calendar time is waiting for vocabulary input.

---

*End of plan.*
