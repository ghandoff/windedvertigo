#!/usr/bin/env node
/**
 * Verification harness for src/lib/llm-adapter.js (Wave 10.1).
 *
 * Pure-module unit tests: registry, walk semantics, telemetry aggregation.
 *
 * Note: telemetry is recorded ONLY for the strategy that answered (or 'none'
 * if all deferred). Deferring strategies do not produce per-strategy records.
 * This keeps the migration tracker focused on which seam actually serves
 * traffic; per-strategy attempt counts can be reintroduced later.
 *
 * Usage:
 *   node tests/llm-adapter.verify.mjs
 */

import {
  registerStrategy,
  listRegisteredTasks,
  extract,
  getTelemetrySummary,
  _resetForTests,
} from '../src/lib/llm-adapter.js';

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) { tests.push({ name, fn }); }
function assertEq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || 'assertion'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
function assertTrue(v, msg) { assertEq(v, true, msg); }
function assertFalse(v, msg) { assertEq(v, false, msg); }
function assertThrows(fn, msg) {
  let threw = false;
  try { fn(); } catch { threw = true; }
  if (!threw) throw new Error(`${msg || 'assertion'}: expected throw, got none`);
}

// Helper: build a deterministic strategy that returns a fixed value
function detStrategy(value) {
  return { type: 'deterministic', run: async () => ({ ok: true, value }) };
}
// Helper: deferring strategy
function deferStrategy(type = 'deterministic') {
  return { type, run: async () => ({ ok: false, deferToNext: true }) };
}
// Helper: throwing strategy
function throwStrategy(type = 'deterministic') {
  return { type, run: async () => { throw new Error('boom'); } };
}
// Helper: fake Claude
function fakeClaudeStrategy(value) {
  return { type: 'claude', model: 'claude-fake', run: async () => ({ ok: true, value }) };
}

// ─── registerStrategy ────────────────────────────────────────────────────
test('registerStrategy happy path adds to registry', async () => {
  _resetForTests();
  registerStrategy('task-a', [detStrategy('a')]);
  const tasks = listRegisteredTasks();
  assertTrue(tasks.includes('task-a'), 'task-a should be registered');
});
test('registerStrategy rejects empty taskName', () => {
  _resetForTests();
  assertThrows(() => registerStrategy('', [detStrategy('x')]), 'empty name');
  assertThrows(() => registerStrategy(null, [detStrategy('x')]), 'null name');
});
test('registerStrategy rejects empty strategies array', () => {
  _resetForTests();
  assertThrows(() => registerStrategy('task-x', []), 'empty array');
  assertThrows(() => registerStrategy('task-x', null), 'null arr');
});
test('registerStrategy rejects strategy without run()', () => {
  _resetForTests();
  assertThrows(() => registerStrategy('task-x', [{ type: 'deterministic' }]), 'no run');
});
test('registerStrategy rejects unknown strategy.type', () => {
  _resetForTests();
  assertThrows(
    () => registerStrategy('task-x', [{ type: 'magic', run: async () => ({ ok: true }) }]),
    'unknown type'
  );
});

// ─── extract: single deterministic ───────────────────────────────────────
test('extract: single deterministic returning ok returns value', async () => {
  _resetForTests();
  registerStrategy('task-det', [detStrategy('hello')]);
  const r = await extract('task-det', { foo: 1 });
  assertTrue(r.ok, 'should be ok');
  assertEq(r.value, 'hello', 'value passthrough');
  assertEq(r.strategy, 'deterministic', 'strategy attribution');
  assertTrue(r.telemetry !== null, 'telemetry attached');
});

// ─── extract: chain walk ─────────────────────────────────────────────────
test('extract: deterministic-defers-then-claude → claude answers', async () => {
  _resetForTests();
  registerStrategy('task-chain', [deferStrategy('deterministic'), fakeClaudeStrategy(42)]);
  const r = await extract('task-chain', 'payload');
  assertTrue(r.ok, 'should be ok');
  assertEq(r.value, 42, 'claude answered');
  assertEq(r.strategy, 'claude', 'attribution to claude');
});

// ─── extract: no strategies ──────────────────────────────────────────────
test('extract: no strategies registered returns ok:false', async () => {
  _resetForTests();
  const r = await extract('does-not-exist', {});
  assertFalse(r.ok, 'unregistered task should fail');
  assertTrue(typeof r.error === 'string', 'error string set');
});

// ─── extract: all defer ──────────────────────────────────────────────────
test('extract: all strategies defer returns ok:false', async () => {
  _resetForTests();
  registerStrategy('task-all-defer', [deferStrategy('deterministic'), deferStrategy('oss-llm'), deferStrategy('claude')]);
  const r = await extract('task-all-defer', {});
  assertFalse(r.ok, 'all-defer should fail');
  assertTrue(/deferred or failed/.test(r.error), 'error mentions deferred');
});

// ─── extract: throwing strategy is skipped ───────────────────────────────
test('extract: throwing strategy does not abort walk', async () => {
  _resetForTests();
  // Silence console.warn from the adapter for this case
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    registerStrategy('task-throw', [throwStrategy('deterministic'), fakeClaudeStrategy('recovered')]);
    const r = await extract('task-throw', {});
    assertTrue(r.ok, 'should recover via next strategy');
    assertEq(r.value, 'recovered', 'fallback answered');
  } finally {
    console.warn = origWarn;
  }
});

// ─── getTelemetrySummary ─────────────────────────────────────────────────
test('getTelemetrySummary: aggregates counts and ok rate', async () => {
  _resetForTests();
  registerStrategy('t1', [detStrategy('x')]);
  registerStrategy('t2', [deferStrategy('deterministic'), fakeClaudeStrategy('y')]);
  await extract('t1', {});
  await extract('t1', {});
  await extract('t2', {});
  const summary = getTelemetrySummary();
  const t1Det = summary.find((s) => s.taskName === 't1' && s.strategy === 'deterministic');
  const t2Claude = summary.find((s) => s.taskName === 't2' && s.strategy === 'claude');
  if (!t1Det) throw new Error('missing t1::deterministic in summary');
  if (!t2Claude) throw new Error('missing t2::claude in summary');
  assertEq(t1Det.count, 2, 't1 deterministic counted twice');
  assertEq(t1Det.okRate, 1, 't1 ok rate = 1');
  assertEq(t2Claude.count, 1, 't2 claude counted once');
  assertEq(t2Claude.okRate, 1, 't2 claude ok rate = 1');
});

// ─── _resetForTests ──────────────────────────────────────────────────────
test('_resetForTests clears registry and telemetry', async () => {
  _resetForTests();
  registerStrategy('temp', [detStrategy('z')]);
  await extract('temp', {});
  _resetForTests();
  assertEq(listRegisteredTasks().length, 0, 'registry cleared');
  assertEq(getTelemetrySummary().length, 0, 'telemetry cleared');
});

// ─── Run ─────────────────────────────────────────────────────────────────
console.log(`\nWave 10.1 LLM adapter verification\n${'─'.repeat(60)}`);
for (const t of tests) {
  try {
    const result = t.fn();
    if (result instanceof Promise) await result;
    passed++;
    console.log(`  ✓ ${t.name}`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${t.name}`);
    console.log(`      ${err.message}`);
  }
}
console.log(`${'─'.repeat(60)}\n${passed} passed, ${failed} failed (${tests.length} total)\n`);
process.exit(failed > 0 ? 1 : 0);
