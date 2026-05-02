#!/usr/bin/env node
/**
 * Verification harness for scripts/audit-reviewer-emails.mjs pure logic.
 * Runs: node tests/audit-reviewer-emails.verify.mjs
 *
 * Tests the email classification + duplicate/case-variance detection
 * functions without touching Notion.
 */

import {
  classifyEmail,
  detectDuplicates,
  detectCaseVariance,
  stripAliasDelimiters,
  CATEGORIES,
} from '../scripts/audit-reviewer-emails.mjs';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  \u2713 ${name}`); }
  catch (e) { failed++; console.log(`  \u2717 ${name}\n      ${e.message}`); }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error(`${msg || 'eq'}: got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);
}

console.log(`\naudit-reviewer-emails pure-logic verification\n${'─'.repeat(60)}`);

// ─── classifyEmail ───────────────────────────────────────────────────────
t('empty email → missing', () => {
  eq(classifyEmail({ email: '', alias: 'X' }).category, CATEGORIES.MISSING);
});

t('null email → missing', () => {
  eq(classifyEmail({ email: null, alias: 'X' }).category, CATEGORIES.MISSING);
});

t('whitespace-only email → missing', () => {
  eq(classifyEmail({ email: '   ', alias: 'X' }).category, CATEGORIES.MISSING);
});

t('"foo" → malformed', () => {
  eq(classifyEmail({ email: 'foo', alias: 'X' }).category, CATEGORIES.MALFORMED);
});

t('"foo@bar" → malformed (no TLD)', () => {
  eq(classifyEmail({ email: 'foo@bar', alias: 'X' }).category, CATEGORIES.MALFORMED);
});

t('"foo@bar.com" → clean', () => {
  eq(classifyEmail({ email: 'foo@bar.com', alias: 'Foo' }).category, CATEGORIES.CLEAN);
});

t('domain-mismatch flag OFF → internal mismatch still clean', () => {
  const r = classifyEmail({ email: 'user@nordicnaturals.com', alias: 'UserX' });
  eq(r.category, CATEGORIES.CLEAN);
});

t('domain-mismatch flag ON → internal mismatch flagged', () => {
  const r = classifyEmail(
    { email: 'user@nordicnaturals.com', alias: 'UserX' },
    { includeDomainMismatch: true }
  );
  eq(r.category, CATEGORIES.DOMAIN_MISMATCH);
});

t('domain-mismatch flag ON → matching alias stripped of delimiters stays clean', () => {
  const r = classifyEmail(
    { email: 'sharon.matheny@nordicnaturals.com', alias: 'SharonMatheny' },
    { includeDomainMismatch: true }
  );
  eq(r.category, CATEGORIES.CLEAN);
});

t('domain-mismatch flag ON → external domain mismatch is NOT flagged', () => {
  const r = classifyEmail(
    { email: 'random@gmail.com', alias: 'SomethingElse' },
    { includeDomainMismatch: true }
  );
  eq(r.category, CATEGORIES.CLEAN);
});

t('email surrounded by whitespace → trimmed and considered clean', () => {
  eq(classifyEmail({ email: '  foo@bar.com  ', alias: 'Foo' }).category, CATEGORIES.CLEAN);
});

// ─── detectDuplicates ────────────────────────────────────────────────────
t('detectDuplicates with 3 rows, 2 sharing email → 1 group of 2', () => {
  const rows = [
    { id: 'a', email: 'x@y.com' },
    { id: 'b', email: 'x@y.com' },
    { id: 'c', email: 'z@y.com' },
  ];
  const dups = detectDuplicates(rows);
  eq(dups.size, 1);
  eq(dups.get('x@y.com').length, 2);
});

t('detectDuplicates with case-variant rows → NOT reported as duplicate', () => {
  const rows = [
    { id: 'a', email: 'Foo@x.com' },
    { id: 'b', email: 'foo@x.com' },
  ];
  const dups = detectDuplicates(rows);
  eq(dups.size, 0);
});

t('detectDuplicates ignores empty emails', () => {
  const rows = [
    { id: 'a', email: '' },
    { id: 'b', email: '' },
    { id: 'c', email: 'z@y.com' },
  ];
  eq(detectDuplicates(rows).size, 0);
});

// ─── detectCaseVariance ──────────────────────────────────────────────────
t('detectCaseVariance catches Foo@x.com + foo@x.com', () => {
  const rows = [
    { id: 'a', email: 'Foo@x.com' },
    { id: 'b', email: 'foo@x.com' },
  ];
  const cv = detectCaseVariance(rows);
  eq(cv.size, 1);
  eq(cv.get('foo@x.com').length, 2);
});

t('detectCaseVariance does not flag exact duplicates', () => {
  const rows = [
    { id: 'a', email: 'foo@x.com' },
    { id: 'b', email: 'foo@x.com' },
  ];
  eq(detectCaseVariance(rows).size, 0);
});

// ─── stripAliasDelimiters ────────────────────────────────────────────────
t('stripAliasDelimiters: "sharon-matheny" → "sharonmatheny"', () => {
  eq(stripAliasDelimiters('sharon-matheny'), 'sharonmatheny');
});

t('stripAliasDelimiters: "A.B.C" → "abc"', () => {
  eq(stripAliasDelimiters('A.B.C'), 'abc');
});

t('stripAliasDelimiters: handles underscores + whitespace', () => {
  eq(stripAliasDelimiters('  a_b c '), 'abc');
});

t('stripAliasDelimiters: non-string → ""', () => {
  eq(stripAliasDelimiters(null), '');
  eq(stripAliasDelimiters(undefined), '');
});

// ─── Summary ─────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(`passed: ${passed}   failed: ${failed}`);
if (failed > 0) process.exit(1);
