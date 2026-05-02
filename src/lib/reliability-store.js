/**
 * Ephemeral in-memory store for AI Reliability runs.
 *
 * Per the Phase 7 plan, this is intentionally process-local — Vercel
 * function instances are short-lived, so the history may reset between
 * deploys or after an idle period. That's an acceptable trade-off for the
 * MVP: a new Notion DB or persistent blob would be overkill before we know
 * how often the harness gets used.
 *
 * Keyed by `prompt version + model fingerprint`-style buckets so we can
 * still compare apples-to-apples across runs that share inputs.
 */

const MAX_RECORDS = 200;

// global preserved across HMR + lambda reuse during a single instance lifetime.
const g = globalThis;
if (!g.__sqrReliabilityStore) {
  g.__sqrReliabilityStore = { records: [] };
}

function bucketKey({ rubricVersion, modelFingerprint }) {
  return `${rubricVersion || 'unknown'}::${modelFingerprint || 'unknown'}`;
}

export function recordReliabilityRun(record) {
  const store = g.__sqrReliabilityStore;
  const enriched = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bucket: bucketKey({
      rubricVersion: record.rubricVersion,
      modelFingerprint: record.modelFingerprint,
    }),
    ...record,
  };
  store.records.unshift(enriched);
  if (store.records.length > MAX_RECORDS) store.records.length = MAX_RECORDS;
  return enriched;
}

export function listReliabilityRuns({ mode, studyId, rubricVersion, limit = 50 } = {}) {
  const store = g.__sqrReliabilityStore;
  let out = store.records;
  if (mode) out = out.filter((r) => r.mode === mode);
  if (studyId) out = out.filter((r) => r.studyId === studyId);
  if (rubricVersion) out = out.filter((r) => r.rubricVersion === rubricVersion);
  return out.slice(0, limit);
}

export function summarizeReliabilityRuns() {
  const store = g.__sqrReliabilityStore;
  const summary = { repetition: [], 'position-shuffle': [], 'gold-standard': [] };
  for (const r of store.records) {
    if (summary[r.mode]) summary[r.mode].push({ kappa: r.kappa, status: r.status, timestamp: r.timestamp });
  }
  return summary;
}
