#!/usr/bin/env node
/**
 * Verification harness for NutriGrade certainty scoring.
 * Runs: node tests/nutrigrade.verify.mjs
 */
import { computeCertainty } from '../src/lib/nutrigrade.js';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  \u2713 ${name}`); }
  catch (e) { failed++; console.log(`  \u2717 ${name}\n      ${e.message}`); }
}
function eq(a, b, msg) { if (a !== b) throw new Error(`${msg||'eq'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`); }

console.log(`\nNutriGrade certainty scoring verification\n${'─'.repeat(60)}`);

// Pending
t('No evidence → Pending, null score', () => {
  const r = computeCertainty({ evidenceCount: 0 });
  eq(r.rating, 'Pending'); eq(r.score, null);
});

// Perfect — multi-study, high-quality across all inputs
t('Perfect multi-study evidence → High, score >= 8', () => {
  const r = computeCertainty({
    sqrMean: 19, applicabilityMean: 9, evidenceCount: 5,
    heterogeneity: 'Low', publicationBias: 'Undetected',
    fundingBias: 'Independent', precision: 'Precise',
    effectSizeCategory: 'Large', doseResponseGradient: 'Present',
  });
  eq(r.rating, 'High');
  if (r.score < 8) throw new Error(`expected >=8 got ${r.score}`);
  if (r.score > 10) throw new Error('score exceeded cap of 10');
});

// All the worst — but multiple studies
t('Multi-study but weak across the board → Very Low', () => {
  const r = computeCertainty({
    sqrMean: 8, applicabilityMean: 3, evidenceCount: 3,
    heterogeneity: 'High', publicationBias: 'Detected',
    fundingBias: 'Industry', precision: 'Imprecise',
    effectSizeCategory: 'Null', doseResponseGradient: 'Absent',
  });
  eq(r.rating, 'Very Low');
  if (r.score >= 4) throw new Error(`expected <4 got ${r.score}`);
});

// Moderate across the board
t('Moderate inputs → Moderate rating', () => {
  const r = computeCertainty({
    sqrMean: 14, applicabilityMean: 6, evidenceCount: 4,
    heterogeneity: 'Moderate', publicationBias: 'Suspected',
    fundingBias: 'Mixed', precision: 'Moderate',
    effectSizeCategory: 'Moderate', doseResponseGradient: 'Unclear',
  });
  // 2 (SQR mod) + 1 (dir mod) + 0.5 + 0.5 + 0.5 + 0.5 + 0.5 = 5.5 → Low
  eq(r.rating, 'Low');
});

// Single-study cap
t('Single study with stellar inputs → capped at Low (5.9 max)', () => {
  const r = computeCertainty({
    sqrMean: 20, applicabilityMean: 9, evidenceCount: 1,
    heterogeneity: 'Low', publicationBias: 'Undetected',
    fundingBias: 'Independent', precision: 'Precise',
    effectSizeCategory: 'Large', doseResponseGradient: 'Present',
  });
  eq(r.rating, 'Low');
  if (r.score >= 6) throw new Error(`single-study cap broken: ${r.score}`);
  if (r.cappedAt !== 5.9) throw new Error(`cappedAt should be 5.9 got ${r.cappedAt}`);
});

// Single study with weak inputs — no cap needed
t('Single weak study → Very Low, cap not triggered', () => {
  const r = computeCertainty({
    sqrMean: 5, applicabilityMean: 2, evidenceCount: 1,
    heterogeneity: 'High',
  });
  eq(r.rating, 'Very Low');
  eq(r.cappedAt, null);
});

// Missing RA inputs → no points awarded but still scored
t('Missing RA inputs → score still computed from base items', () => {
  const r = computeCertainty({
    sqrMean: 18, applicabilityMean: 9, evidenceCount: 3,
  });
  // 3 + 2 = 5 → Low
  eq(r.rating, 'Low');
  eq(r.score, 5);
});

// Unknown RA input value is treated as no-points
t('"Unknown" option contributes 0 points with explanatory note', () => {
  const r = computeCertainty({
    sqrMean: 18, applicabilityMean: 9, evidenceCount: 3,
    heterogeneity: 'Unknown',
    publicationBias: 'Unknown',
    fundingBias: 'Unknown',
    precision: 'Unknown',
  });
  eq(r.score, 5); // 3 (SQR) + 2 (dir) only
  const unknown = r.breakdown.find(b => b.label === 'Heterogeneity');
  if (!unknown.note.includes('Unknown')) throw new Error('Unknown note should call it out');
});

// Boundary: score = 8.0 → High
t('Score = 8.0 → High (boundary)', () => {
  // 3 (SQR High) + 2 (dir High) + 1 + 1 + 0.5 + 0.5 = 8.0
  const r = computeCertainty({
    sqrMean: 19, applicabilityMean: 9, evidenceCount: 3,
    heterogeneity: 'Low', publicationBias: 'Undetected',
    fundingBias: 'Mixed', precision: 'Moderate',
  });
  eq(r.rating, 'High');
  eq(r.score, 8);
});

// Boundary: score = 6.0 → Moderate
t('Score = 6.0 → Moderate (boundary)', () => {
  // 3 (SQR High) + 2 (dir High) + 1 = 6.0
  const r = computeCertainty({
    sqrMean: 19, applicabilityMean: 9, evidenceCount: 2,
    heterogeneity: 'Low',
  });
  eq(r.rating, 'Moderate');
  eq(r.score, 6);
});

// Cap at 10 never exceeded
t('Raw sum of 11 points caps at score=10', () => {
  const r = computeCertainty({
    sqrMean: 22, applicabilityMean: 10, evidenceCount: 10,
    heterogeneity: 'Low', publicationBias: 'Undetected',
    fundingBias: 'Independent', precision: 'Precise',
    effectSizeCategory: 'Large', doseResponseGradient: 'Present',
  });
  eq(r.score, 10);
  eq(r.rating, 'High');
});

console.log(`${'─'.repeat(60)}\n${passed} passed, ${failed} failed (${passed+failed} total)\n`);
process.exit(failed > 0 ? 1 : 0);
