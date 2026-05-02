/**
 * Wave 5.2 — PCS ↔ Label drift detection.
 *
 * Pure module. Compares a Product Label's market-facing substantiation
 * against its backing PCS Document and turns discrepancies into durable
 * Research Request rows via the Wave 4.5.0 `upsertRequest` helper.
 *
 * Five drift categories (see docs/plans/wave-5-product-labels.md §4):
 *
 *   | Drift type              | Compares                             | Severity  |
 *   |-------------------------|--------------------------------------|-----------|
 *   | unauthorized-claim      | label claim with NO 3A match         | Critical  |
 *   | ingredient-drift        | label ingredient set ≠ PCS set       | High      |
 *   | dose-drift              | per-active dose mismatch (±0%)        | High      |
 *   | claim-text-drift        | semantic similarity < 0.85           | Normal    |
 *   | demographic-drift       | label demographic ⊋ PCS demographic  | Normal    |
 *
 * Three triggers feed this module:
 *   1. PCS update  — commitExtraction fans out to backing labels.
 *   2. Label update — createLabel / updateLabel in pcs-labels.js.
 *   3. Nightly sweep — /api/cron/sweep-label-drift.
 *
 * All three converge on detectDriftForLabel(labelId). Detection is:
 *   - Best-effort: never throws. Individual finding failures swallowed.
 *   - Idempotent: re-running on an unchanged label writes zero new rows
 *     because upsertRequest() dedups on (documentId, type, specificField).
 *
 * LLM usage: claim-text similarity runs through callLLM() using the
 * globally-configured provider. Haiku is recommended via LLM_MODEL env
 * for cost; detection tolerates any model that returns the required JSON.
 */

import { getLabel, updateLabel, getLabelsForPcs } from './pcs-labels.js';
import { getDocument } from './pcs-documents.js';
import { getClaimsForVersion } from './pcs-claims.js';
import { getFormulaLinesForVersion } from './pcs-formula-lines.js';
import { getVersion } from './pcs-versions.js';
import { upsertRequest } from './pcs-request-generator.js';
import { callLLM } from './llm.js';

/** Audit tag baked into every drift finding's notes. */
export const LABEL_DRIFT_PROMPT_VERSION = 'v1-initial';

/** Semantic-similarity threshold below which claim copy is "drift". */
export const CLAIM_SIMILARITY_THRESHOLD = 0.85;

/** Severity → Priority enum in pcs-config.js REQUEST_PRIORITIES. */
const SEVERITY_BY_TYPE = {
  'unauthorized-claim': 'Critical',
  'ingredient-drift': 'High',
  'dose-drift': 'High',
  'claim-text-drift': 'Normal',
  'demographic-drift': 'Normal',
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Parsing helpers ────────────────────────────────────────────────────────

/**
 * Labels store `approvedClaimsOnLabel` as newline- or bullet-delimited rich text.
 * Split on newlines, trim, drop empties and bullet prefixes.
 */
export function parseLabelClaims(raw) {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/\r?\n+/)
    .map(line => line.replace(/^\s*[\-\*•·]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * Labels store `ingredientDoses` as structured text (JSON blob, or a
 * newline list like "Vitamin D3: 1000 IU"). Parse to a Map<name, {amount, unit}>.
 * Keys are lowercased for set comparisons; original casing is preserved in value.
 */
export function parseLabelIngredientDoses(raw) {
  const out = new Map();
  if (!raw || typeof raw !== 'string') return out;

  // Try JSON first.
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const row of parsed) {
        const name = String(row.name || row.ingredient || '').trim();
        if (!name) continue;
        out.set(name.toLowerCase(), {
          name,
          amount: Number(row.amount ?? row.dose ?? NaN),
          unit: String(row.unit || row.doseUnit || '').trim(),
        });
      }
      return out;
    }
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        const name = String(k).trim();
        if (typeof v === 'object' && v) {
          out.set(name.toLowerCase(), {
            name,
            amount: Number(v.amount ?? v.dose ?? NaN),
            unit: String(v.unit || v.doseUnit || '').trim(),
          });
        } else {
          const m = String(v).match(/([\d.]+)\s*([A-Za-z%]+)?/);
          out.set(name.toLowerCase(), {
            name,
            amount: m ? Number(m[1]) : NaN,
            unit: m?.[2] || '',
          });
        }
      }
      return out;
    }
  } catch {
    // Fall through to line-based parse.
  }

  // Line-based: "Name: 100 mg"
  for (const line of raw.split(/\r?\n+/)) {
    const m = line.match(/^\s*([^:]+?)\s*:\s*([\d.]+)\s*([A-Za-z%]*)\s*$/);
    if (!m) continue;
    const name = m[1].trim();
    out.set(name.toLowerCase(), {
      name,
      amount: Number(m[2]),
      unit: (m[3] || '').trim(),
    });
  }
  return out;
}

/** Build a PCS-side Map<ingredient-key, {amount, unit}> from formula lines. */
function pcsFormulaToMap(formulaLines) {
  const out = new Map();
  for (const f of formulaLines) {
    // Prefer canonical AI relation id as the key when present; fall back to the
    // AI (Active Ingredient) rich_text name. Lowercase for case-insensitive compare.
    const key = f.activeIngredientCanonicalId
      || (f.ai || f.ingredientForm || '').trim().toLowerCase();
    if (!key) continue;
    out.set(key, {
      name: f.ai || f.ingredientForm || '',
      amount: Number(f.amountPerServing ?? f.elementalAmountMg ?? NaN),
      unit: f.amountUnit || (f.elementalAmountMg != null ? 'mg' : ''),
    });
  }
  return out;
}

/** Same shape but keyed by normalized ingredient name (for label-side matching). */
function pcsFormulaToNameMap(formulaLines) {
  const out = new Map();
  for (const f of formulaLines) {
    const name = (f.ai || f.ingredientForm || '').trim();
    if (!name) continue;
    out.set(name.toLowerCase(), {
      name,
      amount: Number(f.amountPerServing ?? f.elementalAmountMg ?? NaN),
      unit: f.amountUnit || (f.elementalAmountMg != null ? 'mg' : ''),
    });
  }
  return out;
}

// ─── Similarity: LLM-backed ─────────────────────────────────────────────────

const SIMILARITY_SYSTEM_PROMPT = `You are a regulatory-compliance text comparator for US dietary supplement labels.

Given one consumer-facing LABEL CLAIM and a list of APPROVED PCS CLAIMS from the substantiation file, return the single best semantic match and a similarity score in [0,1].

Similarity rubric:
  1.00  Identical meaning and structure (ingredient → benefit → population).
  0.85+ Paraphrase that preserves the causal structure and regulatory admissibility.
  0.70  Same general topic, but narrows/broadens the claim in a non-trivial way.
  0.50  Related ingredient or related benefit, but the claim as worded is different.
  0.00  No meaningful relationship, or PCS list is empty.

Return strict JSON:
{"bestMatch": {"claimNo": "<string or null>", "claimText": "<string>", "similarity": <number>}, "reasoning": "<one sentence>"}

If no PCS claim is meaningfully related (all < 0.50), return bestMatch: null.`;

/**
 * Score one label claim against the PCS claim list. Returns the best match
 * with similarity, or null. Best-effort: on any LLM failure, returns null.
 *
 * Batched at the caller level — detectDriftForLabel runs claims in parallel.
 */
export async function scoreClaimSimilarity(labelClaim, pcsClaims) {
  if (!labelClaim || !Array.isArray(pcsClaims) || pcsClaims.length === 0) {
    return null;
  }
  const userPrompt = JSON.stringify({
    labelClaim,
    pcsClaims: pcsClaims.map(c => ({
      claimNo: c.claimNo || null,
      claimText: c.claim,
      claimBucket: c.claimBucket || null,
      claimStatus: c.claimStatus || null,
    })),
  });
  try {
    const out = await callLLM(SIMILARITY_SYSTEM_PROMPT, userPrompt);
    const match = out?.bestMatch;
    if (!match) return null;
    const similarity = Math.max(0, Math.min(1, Number(match.similarity) || 0));
    return {
      claimNo: match.claimNo || null,
      claimText: String(match.claimText || ''),
      similarity,
    };
  } catch (err) {
    console.warn('[LABEL-DRIFT] similarity LLM call failed:', err?.message || err);
    return null;
  }
}

// ─── Demographic comparison ─────────────────────────────────────────────────

function toSet(arr) {
  return new Set((arr || []).map(x => String(x).trim()).filter(Boolean));
}

/**
 * Diff label vs PCS demographic axes. Axes are the four Wave 4.1a multi-selects
 * (biologicalSex, ageGroup, lifeStage, lifestyle) mirrored on both sides.
 *
 * Label ⊋ PCS ON ANY AXIS = drift (the label is promising a broader audience
 * than the PCS substantiates). Label ⊆ PCS is OK.
 */
export function diffDemographic(labelAxes, pcsAxes) {
  const axes = ['biologicalSex', 'ageGroup', 'lifeStage', 'lifestyle'];
  const drift = {};
  let hasDrift = false;
  for (const axis of axes) {
    const labelSet = toSet(labelAxes?.[axis]);
    const pcsSet = toSet(pcsAxes?.[axis]);
    if (labelSet.size === 0 || pcsSet.size === 0) continue; // insufficient data
    const extras = [...labelSet].filter(v => !pcsSet.has(v));
    if (extras.length > 0) {
      drift[axis] = { label: [...labelSet], pcs: [...pcsSet], extras };
      hasDrift = true;
    }
  }
  return { hasDrift, drift };
}

// ─── Dose comparison ────────────────────────────────────────────────────────

/**
 * ±0% on actives. Only flags when both sides have a numeric amount and they
 * differ (with unit normalization for the common mg/mcg pair). Missing units
 * on either side → treat as mismatch if amounts differ.
 */
export function dosesMatch(labelDose, pcsDose) {
  if (!labelDose || !pcsDose) return true; // incomplete data, cannot assert drift
  const la = Number(labelDose.amount);
  const pa = Number(pcsDose.amount);
  if (!Number.isFinite(la) || !Number.isFinite(pa)) return true;

  const lu = (labelDose.unit || '').toLowerCase();
  const pu = (pcsDose.unit || '').toLowerCase();

  // Normalize mg <-> mcg when one side reports the other.
  const toMcg = (amount, unit) => {
    if (unit === 'mg') return amount * 1000;
    if (unit === 'mcg' || unit === 'ug' || unit === 'µg') return amount;
    return null;
  };
  if (lu && pu && lu !== pu) {
    const la2 = toMcg(la, lu);
    const pa2 = toMcg(pa, pu);
    if (la2 != null && pa2 != null) return Math.abs(la2 - pa2) < 1e-6;
    return false; // different unit dimensions we can't reconcile
  }
  return Math.abs(la - pa) < 1e-6;
}

// ─── Core detection ─────────────────────────────────────────────────────────

/**
 * Run all 5 drift checks on a single label vs its backing PCS.
 *
 * @param {string} labelId
 * @returns {Promise<{labelId:string, findings:Array, stats:object, error?:string}>}
 */
export async function detectDriftForLabel(labelId) {
  const stats = { created: 0, updated: 0, skipped: 0, errors: 0, llmCalls: 0 };
  if (!labelId) return { labelId, findings: [], stats, error: 'no labelId' };

  let label;
  try {
    label = await getLabel(labelId);
  } catch (err) {
    return { labelId, findings: [], stats, error: `getLabel failed: ${err?.message || err}` };
  }

  if (!label.pcsDocumentId) {
    return { labelId, findings: [], stats, error: 'label has no backing PCS Document' };
  }

  // Fan-out reads for PCS side. Any failure → bail cleanly (no partial writes).
  let pcs, latestVersion, pcsClaims, pcsFormula;
  try {
    pcs = await getDocument(label.pcsDocumentId);
    if (!pcs?.latestVersionId) {
      return { labelId, findings: [], stats, error: 'PCS document has no latest version' };
    }
    latestVersion = await getVersion(pcs.latestVersionId);
    [pcsClaims, pcsFormula] = await Promise.all([
      getClaimsForVersion(pcs.latestVersionId),
      getFormulaLinesForVersion(pcs.latestVersionId),
    ]);
  } catch (err) {
    return { labelId, findings: [], stats, error: `PCS read failed: ${err?.message || err}` };
  }

  const findings = [];

  // ── 1 & 2: Claim text drift / unauthorized claim ────────────────────────
  const labelClaims = parseLabelClaims(label.approvedClaimsOnLabel);
  // Compare only to 3A (Authorized) claims — those are the ones a label may
  // legitimately reference. Fall back to all claims if no explicit 3A set exists.
  const authorizedClaims = pcsClaims.filter(c =>
    c.claimBucket === '3A' || c.claimStatus === 'Authorized',
  );
  const comparableClaims = authorizedClaims.length > 0 ? authorizedClaims : pcsClaims;

  const similarityResults = await Promise.all(
    labelClaims.map(async (lc) => {
      stats.llmCalls += 1;
      const match = await scoreClaimSimilarity(lc, comparableClaims);
      return { labelClaim: lc, match };
    }),
  );

  for (const { labelClaim, match } of similarityResults) {
    if (!match || match.similarity < 0.5) {
      findings.push({
        type: 'unauthorized-claim',
        labelClaim,
        specificField: `label-claim::${labelClaim.slice(0, 120)}`,
        note: `Label claim has no semantic match in PCS ${pcs.pcsId || ''} (threshold 0.50).`,
      });
    } else if (match.similarity < CLAIM_SIMILARITY_THRESHOLD) {
      findings.push({
        type: 'claim-text-drift',
        labelClaim,
        pcsClaim: match.claimText,
        similarity: match.similarity,
        specificField: `label-claim::${labelClaim.slice(0, 120)}`,
        note: `Label claim paraphrases PCS claim ${match.claimNo || '?'} with similarity ${match.similarity.toFixed(2)} (< ${CLAIM_SIMILARITY_THRESHOLD}).`,
      });
    }
  }

  // ── 3 & 4: Ingredient + dose drift ──────────────────────────────────────
  const labelMap = parseLabelIngredientDoses(label.ingredientDoses);
  const pcsByName = pcsFormulaToNameMap(pcsFormula);

  for (const [key, labelDose] of labelMap) {
    const pcsDose = pcsByName.get(key);
    if (!pcsDose) {
      findings.push({
        type: 'ingredient-drift',
        direction: 'extra-on-label',
        ingredient: labelDose.name,
        specificField: `label-ingredient::${labelDose.name}`,
        note: `Label prints ingredient "${labelDose.name}" which is not in PCS formula lines.`,
      });
      continue;
    }
    if (!dosesMatch(labelDose, pcsDose)) {
      findings.push({
        type: 'dose-drift',
        ingredient: labelDose.name,
        labelDose: `${labelDose.amount} ${labelDose.unit}`.trim(),
        pcsDose: `${pcsDose.amount} ${pcsDose.unit}`.trim(),
        specificField: `label-dose::${labelDose.name}`,
        note: `Label dose ${labelDose.amount} ${labelDose.unit} differs from PCS formula ${pcsDose.amount} ${pcsDose.unit}.`,
      });
    }
  }

  for (const [key, pcsDose] of pcsByName) {
    if (!labelMap.has(key)) {
      findings.push({
        type: 'ingredient-drift',
        direction: 'missing-on-label',
        ingredient: pcsDose.name,
        specificField: `pcs-ingredient::${pcsDose.name}`,
        note: `PCS formula line "${pcsDose.name}" is not printed on the label.`,
      });
    }
  }

  // ── 5: Demographic drift ────────────────────────────────────────────────
  // Labels may not yet carry the four-axis demographic relation (plan says
  // it should mirror PCS Version axes). Best-effort: read any axis keys if
  // the parsed label exposes them; otherwise skip with a note in stats.
  const labelAxes = {
    biologicalSex: label.biologicalSex,
    ageGroup: label.ageGroup,
    lifeStage: label.lifeStage,
    lifestyle: label.lifestyle,
  };
  const pcsAxes = {
    biologicalSex: latestVersion?.biologicalSex,
    ageGroup: latestVersion?.ageGroup,
    lifeStage: latestVersion?.lifeStage,
    lifestyle: latestVersion?.lifestyle,
  };
  const demoResult = diffDemographic(labelAxes, pcsAxes);
  if (demoResult.hasDrift) {
    for (const [axis, d] of Object.entries(demoResult.drift)) {
      findings.push({
        type: 'demographic-drift',
        axis,
        specificField: `demographic-axis::${axis}`,
        note: `Label ${axis}=[${d.label.join(', ')}] supersets PCS ${axis}=[${d.pcs.join(', ')}]. Extras: ${d.extras.join(', ')}.`,
      });
    }
  }

  // ── Write findings through upsertRequest ─────────────────────────────────
  const createdRequestIds = [];
  for (const f of findings) {
    const priority = SEVERITY_BY_TYPE[f.type] || 'Normal';
    const title = `Label drift [${f.type}]: ${label.sku || labelId.slice(0, 8)} ↔ ${pcs.pcsId || pcs.id.slice(0, 8)}`;
    const notes = [
      f.note,
      `Label: ${label.sku || labelId}`,
      `PCS: ${pcs.pcsId || ''} (version ${latestVersion?.version || ''})`,
      `Prompt version: ${LABEL_DRIFT_PROMPT_VERSION}`,
    ].filter(Boolean).join('\n');

    try {
      const res = await upsertRequest({
        documentId: pcs.id,
        versionId: pcs.latestVersionId,
        type: 'label-drift',
        specificField: f.specificField,
        title,
        notes,
        assignedRole: f.type === 'unauthorized-claim' || f.type === 'claim-text-drift' ? 'RA' : 'Research',
        priority,
        source: 'drift-detection',
      });
      stats[res.action] = (stats[res.action] || 0) + 1;
      if (res.id) createdRequestIds.push(res.id);
    } catch (err) {
      stats.errors += 1;
      console.warn(`[LABEL-DRIFT] upsert failed for ${f.type}:`, err?.message || err);
    }
  }

  // ── Stamp the label ─────────────────────────────────────────────────────
  try {
    const nextDriftIds = Array.from(new Set([
      ...(label.driftFindingIds || []),
      ...createdRequestIds,
    ]));
    await updateLabel(labelId, {
      lastDriftCheck: todayIso(),
      driftFindingIds: nextDriftIds,
    });
  } catch (err) {
    stats.errors += 1;
    console.warn('[LABEL-DRIFT] failed to stamp Last Drift Check:', err?.message || err);
  }

  return { labelId, findings, stats };
}

/**
 * Enumerate all Active labels with a stale drift-check and run detection.
 * Intended for the nightly cron. `limit` caps the batch to stay under the
 * Vercel function timeout (default 10 labels × ~5 LLM calls each).
 *
 * A label is "stale" when lastDriftCheck is null OR older than `staleDays`.
 */
export async function detectDriftForAllActiveLabels({
  limit = 10,
  staleDays = 90,
  deadlineMs = null,
  log = () => {},
} = {}) {
  const { getAllLabels } = await import('./pcs-labels.js');
  const all = await getAllLabels();

  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const stale = all.filter(l => {
    if (l.status !== 'Active') return false;
    if (!l.pcsDocumentId) return false;
    if (!l.lastDriftCheck) return true;
    const t = Date.parse(l.lastDriftCheck);
    return Number.isFinite(t) && t < cutoff;
  });

  log(`[sweep] ${all.length} labels total, ${stale.length} stale Active labels eligible`);

  const batch = stale.slice(0, limit);
  const results = [];
  for (const label of batch) {
    if (deadlineMs && Date.now() > deadlineMs) {
      log(`[sweep] deadline reached, stopping at ${results.length}/${batch.length}`);
      break;
    }
    try {
      const r = await detectDriftForLabel(label.id);
      log(`[sweep] ${label.sku || label.id}: ${r.findings.length} findings, ${r.stats.created} created, ${r.stats.updated} updated, ${r.stats.errors} errors${r.error ? `, error: ${r.error}` : ''}`);
      results.push(r);
    } catch (err) {
      log(`[sweep] ${label.sku || label.id}: FATAL ${err?.message || err}`);
      results.push({ labelId: label.id, findings: [], stats: { errors: 1 }, error: String(err?.message || err) });
    }
  }

  const totals = results.reduce((acc, r) => {
    acc.created += r.stats.created || 0;
    acc.updated += r.stats.updated || 0;
    acc.errors += r.stats.errors || 0;
    acc.llmCalls += r.stats.llmCalls || 0;
    acc.findings += (r.findings?.length || 0);
    return acc;
  }, { labelsProcessed: results.length, created: 0, updated: 0, errors: 0, llmCalls: 0, findings: 0 });

  // Ballpark cost estimate: Haiku 4.5 ~ $1/M input tokens, $5/M output.
  // Per-similarity call ~500 input + 60 output tokens → ~$0.00080 / call.
  totals.estimatedCostUsd = Number((totals.llmCalls * 0.0008).toFixed(4));
  totals.staleCount = stale.length;
  totals.labelsRemaining = Math.max(0, stale.length - results.length);
  return totals;
}

/**
 * Fan-out entry point for the PCS-update trigger. Best-effort, never throws.
 * Enumerates labels whose pcsDocumentId === documentId and queues drift checks.
 *
 * Runs serially — each drift check spawns its own parallel LLM calls inside;
 * we avoid firing all labels in parallel to keep Notion rate-limit-friendly.
 */
export async function detectDriftForPcsDocument(documentId, { log = () => {} } = {}) {
  const totals = { labelsProcessed: 0, created: 0, updated: 0, errors: 0, llmCalls: 0, findings: 0 };
  if (!documentId) return totals;
  try {
    const labels = await getLabelsForPcs(documentId);
    log(`[pcs-update] ${labels.length} backing labels for PCS ${documentId}`);
    for (const label of labels) {
      try {
        const r = await detectDriftForLabel(label.id);
        totals.labelsProcessed += 1;
        totals.created += r.stats.created || 0;
        totals.updated += r.stats.updated || 0;
        totals.errors += r.stats.errors || 0;
        totals.llmCalls += r.stats.llmCalls || 0;
        totals.findings += r.findings.length;
      } catch (err) {
        totals.errors += 1;
        log(`[pcs-update] label ${label.id} FAILED: ${err?.message || err}`);
      }
    }
  } catch (err) {
    log(`[pcs-update] enumeration failed: ${err?.message || err}`);
    totals.errors += 1;
  }
  return totals;
}
