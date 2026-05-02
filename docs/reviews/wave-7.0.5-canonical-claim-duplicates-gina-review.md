# Canonical-Claim Duplicate Review — Wave 7.0.5

**For:** Gina
**From:** Garrett / PCS engineering
**Date:** 2026-04-22
**Status:** Awaiting your decisions before we execute any merges

---

## What this is about

A **canonical claim** is our single source-of-truth phrasing for a health benefit tied to a specific active ingredient (AI), form, sensitivity profile, and dose context. Every downstream artifact — formula lines, evidence packets, label copy — eventually traces back to one of these canonical rows in Notion. If we have two rows that *mean the same thing*, any downstream consumer has to guess which one is authoritative, and two different reviewers can end up citing two different "canonical" statements for the same underlying claim. That's the problem we're trying to close out.

In Wave 7.0.5 we shipped a new **canonical identity key** that fingerprints each claim by `prefix : coreBenefit : AI : AI form : sensitivity : dose : demographics`. Running that key across all **94 canonical claims** currently in Notion surfaced **21 groups where two or more rows share the same fingerprint** — in total, **71 rows** fall into a duplicate cluster. Those 21 groups are what this document asks you to review.

**What we need from you:** for each cluster, tell us which row should survive as the canonical, and which should be retired (or whether the cluster is a false positive and all rows are legitimately distinct). Once you mark up this doc, we'll run the Wave 7.0.5 T8.1 merge script to execute your decisions — no automatic merging happens without your sign-off.

---

## How to use this document

For each cluster below:

1. Click the Notion links to open each row side-by-side.
2. Tick the `[ ]` next to the one row you want to keep as the **Survivor**.
3. For the other rows, add a short note if you want the content folded into the survivor (wording you prefer, evidence you want carried over, etc.). If you don't note anything, we'll assume the survivor's content stands as-is and the others are retired (archived, not deleted).
4. If the cluster looks wrong — i.e., the rows really are distinct and the key is too blunt — tick **"Keep all (key needs a nuance tweak)"** and add a one-line note on what distinguishes them. We'll use that to refine the fingerprint.

When you're done, just send the marked-up file back (or drop it in the PCS channel) and we'll take it from there.

---

## Summary at a glance

| Metric | Value |
|---|---|
| Canonical claims inspected | 94 |
| Duplicate-key clusters | 21 |
| Rows inside a cluster | 71 |
| Sensitivity = dose_gated | 23 |
| Sensitivity = dose_agnostic | 37 |
| Sensitivity = dose_qualified | 8 |
| Sensitivity = not_applicable | 26 |

---

## Cluster 1 — The "orphan" cluster (please read first)

**17 rows, key `v1:::::not_applicable::`**

These rows all collapse to the same fingerprint because **they're missing the prefix relation** in Notion. They're not genuine duplicates of each other — they're canonical claims whose taxonomy metadata (prefix, core benefit, AI linkage) was never populated, so the fingerprint comes out empty on every axis. The identity key treats them as identical only because they're all "blank, blank, blank."

**Recommended action:** do **not** merge these. Instead, walk through the list and assign each one a proper prefix + core benefit + AI. Once their metadata is filled in, re-running the audit will either (a) give them their own unique fingerprint, or (b) correctly surface them as duplicates of an existing well-formed canonical row — at which point we'd bring that group back to you in a future pass.

| # | Current title | Page | Suggested next step |
|---|---|---|---|
| 1 | Promotes healthy activity levels | [open](https://www.notion.so/0781aaa732f84fdc9926e628f278ccd7) | Assign prefix + benefit + AI |
| 2 | Supports cellular energy production | [open](https://www.notion.so/17afefaa287d40ca9dbb48e1a70feda9) | Assign prefix + benefit + AI |
| 3 | Supports a healthy stress response | [open](https://www.notion.so/27970437-90c3-49d4-bf19-800ddc652a85) | Assign prefix + benefit + AI |
| 4 | Supports bone / skeletal health | [open](https://www.notion.so/319e4ee74ba4813a8c9ecd9306d99b23) | Assign prefix + benefit + AI |
| 5 | Supports healthy sleep | [open](https://www.notion.so/38070ba4e20a4ad2af0659700356393a) | Assign prefix + benefit + AI |
| 6 | Supports (healthy) cardiovascular function / heart health | [open](https://www.notion.so/529ed4302b474d1aa478a33956515d97) | Assign prefix + benefit + AI |
| 7 | Supports a healthy mind and body | [open](https://www.notion.so/6c34c01f7e3a47c5ad8c630e5953427c) | Assign prefix + benefit + AI |
| 8 | Supports normal muscle relaxation | [open](https://www.notion.so/733f3ae1b7d148a990320418c3f5e42e) | Assign prefix + benefit + AI |
| 9 | Supports mental relaxation / a relaxed state of mind | [open](https://www.notion.so/7bbf6f2cdb1d4cd68a0ad39dcc90b00d) | Assign prefix + benefit + AI |
| 10 | Supports normal muscle function / activity | [open](https://www.notion.so/87981e1fb4894c87b05d882ba50ccf52) | Assign prefix + benefit + AI |
| 11 | Supports normal cognitive / brain health | [open](https://www.notion.so/91ade78117bf40f8b5ee5ff128338aab) | Assign prefix + benefit + AI |
| 12 | Supports normal cell/cellular signaling | [open](https://www.notion.so/92c3030263e743d19f6acfb28896d79c) | Assign prefix + benefit + AI |
| 13 | Supports mood balance | [open](https://www.notion.so/9708b593efdf4ae8a0a545bcb751e51b) | Assign prefix + benefit + AI |
| 14 | Highly bioavailable/absorbable form of magnesium | [open](https://www.notion.so/9c7578c71f40459cab09451f4fd82500) | Assign prefix + benefit + AI |
| 15 | Less likely to cause digestive discomfort than other forms of Mg2+ | [open](https://www.notion.so/a96e5979692a4e849e888ca099e17e88) | Assign prefix + benefit + AI |
| 16 | Supports normal sleep | [open](https://www.notion.so/e1a2dda7671041e2b8bce0a151406493) | Assign prefix + benefit + AI |
| 17 | Supports cell/cellular and metabolic health/function | [open](https://www.notion.so/e79a0afbc9d0497f87c98187e446d68a) | Assign prefix + benefit + AI |

**Note on titles 8/10 and 9 and 14:** these look thematically close to some of the real duplicate clusters below (muscle relaxation, mental relaxation, bioavailable magnesium). Once you backfill their taxonomy they may fall naturally into those groups. Worth a visual check while you're in there.

---

## Clusters 2–10 — Real semantic duplicates

These clusters are the ones where rows share the same prefix, same core benefit, and same AI — they collided on the fingerprint because they genuinely appear to be saying the same thing. Please pick a survivor for each.

### Cluster 2 — "normal muscle/muscular relaxation" (6 rows, dose_agnostic)

*Why these collided: same prefix, same core benefit (muscle relaxation), same AI, and sensitivity = dose_agnostic.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…db6ea4931ce0` | normal muscle/muscular relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481368d3bdb6ea4931ce0) |
| [ ] | `…d1f92005fbd3` | normal muscle/muscular relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481458c1cd1f92005fbd3) |
| [ ] | `…c7dcb6c6f9f8` | normal muscle/muscular relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481968840c7dcb6c6f9f8) |
| [ ] | `…e49facf95487` | normal muscle/muscular relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba4819bab32e49facf95487) |
| [ ] | `…c1c5838058ba` | normal muscle/muscular relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481d5bb95c1c5838058ba) |
| [ ] | `…d6897555039c` | normal muscle/muscular relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481d78726d6897555039c) |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

### Cluster 3 — "normal mental relaxation" (4 rows, dose_agnostic)

*Why these collided: same prefix, same core benefit (mental relaxation), same AI, dose_agnostic.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…d59913cf8193` | normal mental relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba48117b85ad59913cf8193) |
| [ ] | `…d8df710e5d66` | normal mental relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba48189a9d4d8df710e5d66) |
| [ ] | `…f2155f653b29` | normal mental relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481c09727f2155f653b29) |
| [ ] | `…e23e983d2067` | normal mental relaxation* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481e2a2ede23e983d2067) |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

### Cluster 4 — "a healthy mind and body" (3 rows, dose_agnostic)

*Why these collided: same prefix, same core benefit (mind+body), same AI, dose_agnostic.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…de711c3a9a33` | a healthy mind and body* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481008f93de711c3a9a33) |
| [ ] | `…cc0c4cbfb772` | a healthy mind and body* | _tbd_ | [open](https://www.notion.so/348e4ee74ba48124bb67cc0c4cbfb772) |
| [ ] | `…d46529de6ca3` | a healthy mind and body* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481f78a32d46529de6ca3) |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

### Cluster 5 — "cellular energy production" (3 rows, dose_agnostic)

*Why these collided: same prefix, same core benefit (cellular energy), same AI, dose_agnostic.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…dcef6a1b2468` | cellular energy production* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481128861dcef6a1b2468) |
| [ ] | `…ea65b7fe1d39` | cellular energy production* | _tbd_ | [open](https://www.notion.so/348e4ee74ba4816d86f8ea65b7fe1d39) |
| [ ] | `…fc4e20ba6e0b` | cellular energy production* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481bab06bfc4e20ba6e0b) |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

### Cluster 6 — "NA" (3 rows, not_applicable)

*Why these collided: same prefix, same core benefit, same AI, sensitivity = not_applicable. The title literally being "NA" suggests these may be placeholders — worth checking whether any of them should actually be archived outright.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…f65d2d133241` | NA | _tbd_ | [open](https://www.notion.so/348e4ee74ba481129e75f65d2d133241) |
| [ ] | `…f4b0ae62910a` | NA | _tbd_ | [open](https://www.notion.so/348e4ee74ba4816a924ef4b0ae62910a) |
| [ ] | `…ca35282b5954` | NA | _tbd_ | [open](https://www.notion.so/348e4ee74ba481f89464ca35282b5954) |
| [ ] | **Archive all three** — note: ___________________ |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

### Cluster 7 — "Highly bioavailable/absorbable forms of magnesium" (3 rows, not_applicable)

*Why these collided: same prefix, same core benefit (bioavailability), same AI (magnesium), not_applicable sensitivity.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…f44fb1ab0b9f` | Highly bioavailable/absorbable forms of magnesium* | _tbd_ | [open](https://www.notion.so/348e4ee74ba4812b8281f44fb1ab0b9f) |
| [ ] | `…c481cec6c3d9` | Highly bioavailable/absorbable forms of magnesium* | _tbd_ | [open](https://www.notion.so/348e4ee74ba4813bac23c481cec6c3d9) |
| [ ] | `…d1c4ba09d2be` | Highly bioavailable/absorbable forms of magnesium* | _tbd_ | [open](https://www.notion.so/348e4ee74ba4817cb10dd1c4ba09d2be) |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

*Heads up: orphan row #14 in Cluster 1 is also about bioavailable magnesium and likely belongs in this group once it's backfilled.*

### Cluster 8 — "cell/cellular health/function" (3 rows, dose_agnostic)

*Why these collided: same prefix, same core benefit (cell health), same AI, dose_agnostic.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…fd15310b81c3` | cell/cellular health/function* | _tbd_ | [open](https://www.notion.so/348e4ee74ba4814f9ffffd15310b81c3) |
| [ ] | `…fe491f53cdf0` | cell/cellular health/function* | _tbd_ | [open](https://www.notion.so/348e4ee74ba4818d846efe491f53cdf0) |
| [ ] | `…e8cca3cf710c` | cell/cellular health/function* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481f1a645e8cca3cf710c) |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

### Cluster 9 — "normal cognitive/brain health" (3 rows, dose_agnostic)

*Why these collided: same prefix, same core benefit (cognitive/brain), same AI, dose_agnostic.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…c26e80186459` | normal cognitive/brain health* | _tbd_ | [open](https://www.notion.so/348e4ee74ba48179a190c26e80186459) |
| [ ] | `…fffc6d470e63` | normal cognitive/brain health* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481c4a452fffc6d470e63) |
| [ ] | `…c53c9ed6b245` | normal cognitive/brain health* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481c9b7bac53c9ed6b245) |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

### Cluster 10 — "normal muscle activity/function" (3 rows, dose_agnostic)

*Why these collided: same prefix, same core benefit (muscle function), same AI, dose_agnostic.*

| Survivor? | Short ID | Current title | Created | Page |
|---|---|---|---|---|
| [ ] | `…d7eb54f4e421` | normal muscle activity/function* | _tbd_ | [open](https://www.notion.so/348e4ee74ba4817fa687d7eb54f4e421) |
| [ ] | `…cf4ca3d566d8` | normal muscle activity/function* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481aaa8c7cf4ca3d566d8) |
| [ ] | `…caec58f3c66f` | normal muscle activity/function* | _tbd_ | [open](https://www.notion.so/348e4ee74ba481e39af3caec58f3c66f) |
| [ ] | **Keep all (key needs a nuance tweak)** — note: ___________________ |

---

## Clusters 11–21 — Not yet itemized

The dry-run output truncated after Cluster 10 ("…and 11 more"). These 11 additional clusters exist and contribute to the 71-row total, but we didn't capture their page IDs in the first pass.

**To surface them:** re-run the audit locally with

```
node scripts/backfill-canonical-claim-keys.mjs --dry-run
```

and capture the full output to a file. Once we have it, we'll append an **Addendum** to this document (same format as Clusters 2–10) so you can review them alongside the rest.

If you'd prefer, we can also treat Clusters 2–10 as a first-pass batch, execute those merges, then come back with the remaining 11 as a second review — whichever pacing works better for you.

---

## How to decide which row survives

If you don't have a strong opinion, these heuristics almost always give a reasonable answer:

1. **Prefer the oldest row** — it's most likely to have the longest history of downstream references.
2. **Prefer the row with the most downstream links** — if one row is pointed at by more formula lines, evidence packets, or label copy, merging *into* that row causes the least disruption.
3. **Prefer the row with the most complete metadata** — full demographics, populated evidence block, attached citations.
4. **Prefer the cleaner title** — if one row has a slightly nicer canonical phrasing, make that the survivor and fold the rest into it.

If two rows are genuinely tied, flip a coin — the merge script preserves history on both sides either way, so you're not losing information, just picking which page ID becomes "the" ID going forward.

---

## What happens next

1. You walk through Clusters 1–10 above, tick survivors, add notes where useful.
2. You (or we) re-run the audit to pull Clusters 11–21 and do a second pass.
3. Engineering implements **Wave 7.0.5 T8.1** — the merge-execution script — which takes your decisions as input and:
   - archives the non-survivor rows in Notion (not deleted; recoverable),
   - rewires every downstream reference (formula lines, evidence packets, etc.) to point at the survivor,
   - logs every change in an audit trail we can hand back to you for sign-off.
4. We re-run the canonical-key audit and confirm the duplicate count drops to zero for the clusters you signed off on.

No merges happen without your explicit go-ahead on a per-cluster basis. If anything in here is unclear or the framing feels off, just flag it and we'll adjust before any data moves.

Thanks, Gina — this review is the unblocker for getting the canonical-claim layer clean enough that everything downstream stops being ambiguous.
