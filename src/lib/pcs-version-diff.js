/**
 * PCS extraction diff — structural comparison between an existing PCS
 * Document's current state and a fresh extraction.
 *
 * Emitted when re-importing via conflict action 'link' (i.e. a version bump)
 * so operators can see at a glance what regulatorily changed without
 * eyeballing two JSON blobs.
 *
 * Pure module — no Notion/SDK imports. Caller is responsible for fetching
 * the `existing` snapshot (claims, formulaLines, document, version).
 *
 * Added 2026-04-19 as part of the batch-import feature (v1, Wave 2, Feature 8).
 */

const MAX_ITEMS = 100;

/**
 * Normalize a claim string for cross-version matching. Lowercase, strip a
 * trailing asterisk (common PCS footnote marker), strip a leading regulatory
 * prefix word (best-effort: whatever word precedes the core benefit),
 * collapse whitespace.
 *
 * @param {string} claim
 * @returns {string}
 */
function normalizeClaimKey(claim) {
  if (!claim) return '';
  let s = String(claim).trim().toLowerCase();
  // Strip trailing asterisk(s)
  s = s.replace(/\*+$/, '').trim();
  // Strip common leading prefix words (Supports, Helps support, Promotes,
  // Maintains, Contributes to, etc.) — best-effort, just the first phrase.
  s = s.replace(/^(helps\s+(to\s+)?support|helps\s+support|helps\s+maintain|helps\s+promote|helps?\s+(to\s+)?|supports?|promotes?|maintains?|contributes\s+to|plays\s+a\s+(critical\s+)?role\s+in|is\s+(essential|important|required|needed)\s+for)\s+/i, '');
  // Collapse whitespace.
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Normalize an (ai, aiForm) tuple into a lookup key.
 *
 * @param {string} ai
 * @param {string} aiForm
 * @returns {string}
 */
function normalizeFormulaKey(ai, aiForm) {
  const a = (ai || '').trim().toLowerCase();
  const b = (aiForm || '').trim().toLowerCase();
  return `${a}||${b}`;
}

/** @param {number} n @param {string} one @param {string} many */
function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Compare two primitive-ish values — treats null/undefined/'' as equal.
 *
 * @param {*} a
 * @param {*} b
 * @returns {boolean}
 */
function changed(a, b) {
  const na = a === undefined || a === null || a === '' ? null : a;
  const nb = b === undefined || b === null || b === '' ? null : b;
  if (na === null && nb === null) return false;
  if (Array.isArray(na) && Array.isArray(nb)) {
    if (na.length !== nb.length) return true;
    const sa = [...na].map(String).sort();
    const sb = [...nb].map(String).sort();
    return sa.some((v, i) => v !== sb[i]);
  }
  return na !== nb;
}

/**
 * Build a small "change" descriptor string for human display.
 *
 * @param {string} field
 * @param {*} before
 * @param {*} after
 * @returns {string}
 */
function changeLine(field, before, after) {
  const fmt = v => {
    if (v === null || v === undefined || v === '') return '∅';
    if (Array.isArray(v)) return `[${v.join(', ')}]`;
    return String(v);
  };
  return `${field}: ${fmt(before)} → ${fmt(after)}`;
}

/**
 * Diff claims keyed by normalized claim text.
 *
 * @param {Array} existing
 * @param {Array} incoming
 * @returns {{added: Array, removed: Array, modified: Array}}
 */
function diffClaims(existing, incoming) {
  const exMap = new Map();
  for (const c of existing || []) {
    const key = normalizeClaimKey(c.claim);
    if (key) exMap.set(key, c);
  }
  const inMap = new Map();
  for (const c of incoming || []) {
    const key = normalizeClaimKey(c.claim);
    if (key) inMap.set(key, c);
  }

  const added = [];
  const removed = [];
  const modified = [];

  for (const [key, newClaim] of inMap) {
    const oldClaim = exMap.get(key);
    if (!oldClaim) {
      added.push({
        claim: newClaim.claim,
        claimNo: newClaim.claimNo ?? null,
        claimBucket: newClaim.claimBucket ?? null,
        claimStatus: newClaim.claimStatus ?? null,
        prefix: newClaim.prefix ?? null,
      });
      continue;
    }
    const changes = [];
    if (changed(oldClaim.claimBucket, newClaim.claimBucket)) {
      changes.push(changeLine('bucket', oldClaim.claimBucket, newClaim.claimBucket));
    }
    if (changed(oldClaim.claimStatus, newClaim.claimStatus)) {
      changes.push(changeLine('status', oldClaim.claimStatus, newClaim.claimStatus));
    }
    if (changed(oldClaim.prefix, newClaim.prefix)) {
      changes.push(changeLine('prefix', oldClaim.prefix, newClaim.prefix));
    }
    if (changed(oldClaim.minDoseMg, newClaim.minDoseMg)) {
      changes.push(changeLine('minDoseMg', oldClaim.minDoseMg, newClaim.minDoseMg));
    }
    if (changed(oldClaim.maxDoseMg, newClaim.maxDoseMg)) {
      changes.push(changeLine('maxDoseMg', oldClaim.maxDoseMg, newClaim.maxDoseMg));
    }
    if (changed(oldClaim.claim, newClaim.claim)) {
      // Normalized match hit but raw text shifted — note the wording shift.
      changes.push(changeLine('wording', oldClaim.claim, newClaim.claim));
    }
    if (changes.length > 0) {
      modified.push({
        before: {
          id: oldClaim.id || null,
          claim: oldClaim.claim,
          claimNo: oldClaim.claimNo ?? null,
          claimBucket: oldClaim.claimBucket ?? null,
          claimStatus: oldClaim.claimStatus ?? null,
          prefix: oldClaim.prefix ?? null,
        },
        after: {
          claim: newClaim.claim,
          claimNo: newClaim.claimNo ?? null,
          claimBucket: newClaim.claimBucket ?? null,
          claimStatus: newClaim.claimStatus ?? null,
          prefix: newClaim.prefix ?? null,
        },
        changes,
      });
    }
  }

  for (const [key, oldClaim] of exMap) {
    if (!inMap.has(key)) {
      removed.push({
        id: oldClaim.id || null,
        claim: oldClaim.claim,
        claimNo: oldClaim.claimNo ?? null,
        claimBucket: oldClaim.claimBucket ?? null,
        claimStatus: oldClaim.claimStatus ?? null,
      });
    }
  }

  return { added, removed, modified };
}

/**
 * Diff formula lines keyed by normalized (ai, aiForm).
 *
 * @param {Array} existing
 * @param {Array} incoming
 * @returns {{added: Array, removed: Array, modified: Array}}
 */
function diffFormulaLines(existing, incoming) {
  const exMap = new Map();
  for (const f of existing || []) {
    const key = normalizeFormulaKey(f.ai, f.aiForm);
    if (key !== '||') exMap.set(key, f);
  }
  const inMap = new Map();
  for (const f of incoming || []) {
    const key = normalizeFormulaKey(f.ai, f.aiForm);
    if (key !== '||') inMap.set(key, f);
  }

  const added = [];
  const removed = [];
  const modified = [];

  for (const [key, newLine] of inMap) {
    const oldLine = exMap.get(key);
    if (!oldLine) {
      added.push({
        ai: newLine.ai ?? null,
        aiForm: newLine.aiForm ?? null,
        amountPerServing: newLine.amountPerServing ?? null,
        amountUnit: newLine.amountUnit ?? null,
      });
      continue;
    }
    const changes = [];
    if (changed(oldLine.amountPerServing, newLine.amountPerServing)) {
      changes.push(changeLine('amount', oldLine.amountPerServing, newLine.amountPerServing));
    }
    if (changed(oldLine.amountUnit, newLine.amountUnit)) {
      changes.push(changeLine('unit', oldLine.amountUnit, newLine.amountUnit));
    }
    if (changed(oldLine.percentDailyValue, newLine.percentDailyValue)) {
      changes.push(changeLine('%DV', oldLine.percentDailyValue, newLine.percentDailyValue));
    }
    if (changed(oldLine.fmPlm, newLine.fmPlm)) {
      changes.push(changeLine('FM PLM', oldLine.fmPlm, newLine.fmPlm));
    }
    if (changes.length > 0) {
      modified.push({
        before: {
          id: oldLine.id || null,
          ai: oldLine.ai ?? null,
          aiForm: oldLine.aiForm ?? null,
          amountPerServing: oldLine.amountPerServing ?? null,
          amountUnit: oldLine.amountUnit ?? null,
          percentDailyValue: oldLine.percentDailyValue ?? null,
          fmPlm: oldLine.fmPlm ?? null,
        },
        after: {
          ai: newLine.ai ?? null,
          aiForm: newLine.aiForm ?? null,
          amountPerServing: newLine.amountPerServing ?? null,
          amountUnit: newLine.amountUnit ?? null,
          percentDailyValue: newLine.percentDailyValue ?? null,
          fmPlm: newLine.fmPlm ?? null,
        },
        changes,
      });
    }
  }

  for (const [key, oldLine] of exMap) {
    if (!inMap.has(key)) {
      removed.push({
        id: oldLine.id || null,
        ai: oldLine.ai ?? null,
        aiForm: oldLine.aiForm ?? null,
        amountPerServing: oldLine.amountPerServing ?? null,
        amountUnit: oldLine.amountUnit ?? null,
      });
    }
  }

  return { added, removed, modified };
}

/**
 * Document-level field diff.
 *
 * @param {object} existing - { finishedGoodName, fmt, sapMaterialNo, skus, productName, demographic, biologicalSex, ageGroup, lifeStage, lifestyle }
 * @param {object} incoming - same shape
 * @returns {{changedFields: Array<{field: string, before: *, after: *}>}}
 */
function diffDocument(existing, incoming) {
  const fields = [
    'finishedGoodName', 'fmt', 'sapMaterialNo', 'skus', 'productName',
    // Demographic axes (Wave 4.1a) + legacy flat field
    'demographic', 'biologicalSex', 'ageGroup', 'lifeStage', 'lifestyle',
  ];
  const changedFields = [];
  for (const f of fields) {
    if (changed(existing?.[f], incoming?.[f])) {
      changedFields.push({ field: f, before: existing?.[f] ?? null, after: incoming?.[f] ?? null });
    }
  }
  return { changedFields };
}

/**
 * Truncate a diff array to MAX_ITEMS; signal truncation via the returned flag.
 *
 * @template T
 * @param {T[]} arr
 * @returns {{list: T[], truncated: boolean}}
 */
function cap(arr) {
  if (!arr || arr.length <= MAX_ITEMS) return { list: arr || [], truncated: false };
  return { list: arr.slice(0, MAX_ITEMS), truncated: true };
}

/**
 * Compute a structural diff between an existing PCS Document's current
 * state and a new extraction. Used when re-importing via conflict
 * action 'link' to show operators what's changing regulatorily.
 *
 * `existing` shape:
 *   {
 *     claims: [{ id, claim, claimNo, claimBucket, claimStatus, prefix, minDoseMg, maxDoseMg }],
 *     formulaLines: [{ id, ai, aiForm, amountPerServing, amountUnit, percentDailyValue, fmPlm }],
 *     document: { finishedGoodName, fmt, sapMaterialNo, skus, productName, demographic }
 *   }
 *
 * `newExtraction` shape (from extractFromPdf): has top-level `document`,
 * `version`, `claims`, `formulaLines`.
 *
 * @param {object} existing
 * @param {object} newExtraction
 * @returns {object}
 */
export function computeExtractionDiff(existing, newExtraction) {
  const exClaims = existing?.claims || [];
  const inClaims = newExtraction?.claims || [];
  const exFormula = existing?.formulaLines || [];
  const inFormula = newExtraction?.formulaLines || [];

  // Flatten the incoming extraction's document/version into a single record
  // to match `existing.document` shape.
  // Wave 4.1a — incoming `version.demographic` may be either the new axes object
  // (preferred) or a legacy flat array. Normalize to the document snapshot shape.
  const incomingDemographic = newExtraction?.version?.demographic;
  const demographicIsAxesObject = incomingDemographic && typeof incomingDemographic === 'object' && !Array.isArray(incomingDemographic);
  const inDoc = {
    finishedGoodName: newExtraction?.document?.finishedGoodName ?? null,
    fmt: newExtraction?.document?.fmt ?? null,
    sapMaterialNo: newExtraction?.document?.sapMaterialNo ?? null,
    skus: newExtraction?.document?.skus ?? null,
    productName: newExtraction?.version?.productName ?? null,
    demographic: demographicIsAxesObject ? null : (incomingDemographic ?? null),
    biologicalSex: demographicIsAxesObject ? (incomingDemographic.biologicalSex ?? null) : null,
    ageGroup:      demographicIsAxesObject ? (incomingDemographic.ageGroup      ?? null) : null,
    lifeStage:     demographicIsAxesObject ? (incomingDemographic.lifeStage     ?? null) : null,
    lifestyle:     demographicIsAxesObject ? (incomingDemographic.lifestyle     ?? null) : null,
  };

  const claimsDiff = diffClaims(exClaims, inClaims);
  const formulaDiff = diffFormulaLines(exFormula, inFormula);
  const docDiff = diffDocument(existing?.document || {}, inDoc);

  // Truncate large arrays — we cap removed + modified (added is usually the
  // smaller list during a version bump, but still defensive-cap it too).
  const claimsRemoved = cap(claimsDiff.removed);
  const claimsModified = cap(claimsDiff.modified);
  const claimsAdded = cap(claimsDiff.added);
  const formulaRemoved = cap(formulaDiff.removed);
  const formulaModified = cap(formulaDiff.modified);
  const formulaAdded = cap(formulaDiff.added);

  const anyTruncated = claimsRemoved.truncated || claimsModified.truncated || claimsAdded.truncated
    || formulaRemoved.truncated || formulaModified.truncated || formulaAdded.truncated;

  const totalClaims = claimsDiff.added.length + claimsDiff.removed.length + claimsDiff.modified.length;
  const totalFormula = formulaDiff.added.length + formulaDiff.removed.length + formulaDiff.modified.length;
  const totalDoc = docDiff.changedFields.length;

  let summary;
  if (totalClaims === 0 && totalFormula === 0 && totalDoc === 0) {
    summary = 'No material changes detected.';
  } else {
    const parts = [];
    parts.push(`${plural(claimsDiff.added.length, 'claim added', 'claims added')}`);
    parts.push(`${claimsDiff.removed.length} removed`);
    parts.push(`${claimsDiff.modified.length} modified`);
    let s = parts.join(', ') + '; ';
    s += `${plural(totalFormula, 'formula line changed', 'formula lines changed')}`;
    s += `; ${plural(totalDoc, 'document field updated', 'document fields updated')}`;
    summary = s;
  }

  return {
    claims: {
      added: claimsAdded.list,
      removed: claimsRemoved.list,
      modified: claimsModified.list,
      ...(anyTruncated ? { truncated: claimsRemoved.truncated || claimsModified.truncated || claimsAdded.truncated } : {}),
    },
    formulaLines: {
      added: formulaAdded.list,
      removed: formulaRemoved.list,
      modified: formulaModified.list,
      ...(anyTruncated ? { truncated: formulaRemoved.truncated || formulaModified.truncated || formulaAdded.truncated } : {}),
    },
    document: {
      changedFields: docDiff.changedFields,
    },
    summary,
    ...(anyTruncated ? { truncated: true } : {}),
  };
}
