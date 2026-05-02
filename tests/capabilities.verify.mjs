#!/usr/bin/env node
/**
 * Verification harness for src/lib/auth/capabilities.js (Wave 7.1).
 *
 * Pure-module unit tests: `can()`, `canAny()`, `canAll()`,
 * `capabilitiesFor()`, and the `ROLE_CAPABILITY_MAP` invariants.
 *
 * Usage:
 *   node tests/capabilities.verify.mjs
 */

import {
  CAPABILITIES,
  ROLE_CAPABILITY_MAP,
  SUPER_USER_ONLY_CAPABILITIES,
  capabilitiesFor,
  can,
  canAny,
  canAll,
} from '../src/lib/auth/capabilities.js';

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

// ─── CAPABILITIES shape ──────────────────────────────────────────────────
test('CAPABILITIES is frozen', () => {
  assertTrue(Object.isFrozen(CAPABILITIES), 'CAPABILITIES must be frozen');
});
test('CAPABILITIES contains at least 40 keys (44 per plan)', () => {
  const count = Object.keys(CAPABILITIES).length;
  if (count < 40) throw new Error(`expected >=40 capabilities, got ${count}`);
});
test('Each CAPABILITIES value equals its key', () => {
  for (const [k, v] of Object.entries(CAPABILITIES)) {
    if (k !== v) throw new Error(`mismatch: ${k} !== ${v}`);
  }
});

// ─── ROLE_CAPABILITY_MAP shape ───────────────────────────────────────────
test('ROLE_CAPABILITY_MAP has all 5 canonical roles', () => {
  for (const role of ['reviewer', 'researcher', 'ra', 'admin', 'super-user']) {
    if (!ROLE_CAPABILITY_MAP[role]) throw new Error(`missing role: ${role}`);
  }
});
test('ROLE_CAPABILITY_MAP is frozen', () => {
  assertTrue(Object.isFrozen(ROLE_CAPABILITY_MAP));
});
test('super-user contains every capability', () => {
  const superCaps = new Set(ROLE_CAPABILITY_MAP['super-user']);
  for (const cap of Object.keys(CAPABILITIES)) {
    if (!superCaps.has(cap)) throw new Error(`super-user missing ${cap}`);
  }
});
test('admin is a superset of researcher ∪ ra', () => {
  const adminCaps = new Set(ROLE_CAPABILITY_MAP.admin);
  for (const cap of ROLE_CAPABILITY_MAP.researcher) {
    if (!adminCaps.has(cap)) throw new Error(`admin missing researcher cap: ${cap}`);
  }
  for (const cap of ROLE_CAPABILITY_MAP.ra) {
    if (!adminCaps.has(cap)) throw new Error(`admin missing ra cap: ${cap}`);
  }
});
test('Every role capability is a valid CAPABILITIES key', () => {
  for (const [role, caps] of Object.entries(ROLE_CAPABILITY_MAP)) {
    for (const cap of caps) {
      if (!CAPABILITIES[cap]) throw new Error(`role ${role} references unknown cap ${cap}`);
    }
  }
});

// ─── can() ────────────────────────────────────────────────────────────────
test('can() returns false for undefined user', () => {
  assertFalse(can(undefined, 'pcs.claims:author'));
});
test('can() returns false for null user', () => {
  assertFalse(can(null, 'pcs.claims:author'));
});
test('can() returns false for empty capability string', () => {
  assertFalse(can({ roles: ['super-user'] }, ''));
});
test('can() returns true for super-user on any capability', () => {
  const u = { roles: ['super-user'] };
  for (const cap of Object.keys(CAPABILITIES)) {
    if (!can(u, cap)) throw new Error(`super-user denied ${cap}`);
  }
});
test('can() returns true for researcher on pcs.claims:author', () => {
  assertTrue(can({ roles: ['researcher'] }, 'pcs.claims:author'));
});
test('can() returns false for researcher on audit:read-logs', () => {
  assertFalse(can({ roles: ['researcher'] }, 'audit:read-logs'));
});
test('can() returns false for researcher on users:delete (super-only)', () => {
  assertFalse(can({ roles: ['researcher'] }, 'users:delete'));
});
test('can() returns false for admin on users:delete (super-only)', () => {
  assertFalse(can({ roles: ['admin'] }, 'users:delete'));
});
test('can() returns true for admin on users:edit-role', () => {
  assertTrue(can({ roles: ['admin'] }, 'users:edit-role'));
});
test('can() returns true for RA on pcs.requests:resolve-ra', () => {
  assertTrue(can({ roles: ['ra'] }, 'pcs.requests:resolve-ra'));
});
test('can() returns false for RA on pcs.requests:resolve-research', () => {
  assertFalse(can({ roles: ['ra'] }, 'pcs.requests:resolve-research'));
});
test('can() returns true for reviewer on sqr.scores:create-own', () => {
  assertTrue(can({ roles: ['reviewer'] }, 'sqr.scores:create-own'));
});
test('can() returns false for reviewer on pcs.documents:read', () => {
  assertFalse(can({ roles: ['reviewer'] }, 'pcs.documents:read'));
});
// Wave 7.5 Track A — applicability capability keys
test('CAPABILITIES has pcs.applicability:read', () => {
  assertTrue(CAPABILITIES['pcs.applicability:read'] === 'pcs.applicability:read');
});
test('CAPABILITIES has pcs.applicability:edit', () => {
  assertTrue(CAPABILITIES['pcs.applicability:edit'] === 'pcs.applicability:edit');
});
test('researcher can pcs.applicability:read', () => {
  assertTrue(can({ roles: ['researcher'] }, 'pcs.applicability:read'));
});
test('researcher can pcs.applicability:edit', () => {
  assertTrue(can({ roles: ['researcher'] }, 'pcs.applicability:edit'));
});
test('ra can pcs.applicability:edit', () => {
  assertTrue(can({ roles: ['ra'] }, 'pcs.applicability:edit'));
});
test('reviewer cannot pcs.applicability:edit', () => {
  assertFalse(can({ roles: ['reviewer'] }, 'pcs.applicability:edit'));
});
test('admin inherits pcs.applicability:edit via researcher composition', () => {
  assertTrue(can({ roles: ['admin'] }, 'pcs.applicability:edit'));
});
test('can() honors legacy isAdmin fallback → admin caps', () => {
  assertTrue(can({ isAdmin: true }, 'users:edit-role'));
});
test('can() honors legacy pcs role → researcher caps', () => {
  assertTrue(can({ roles: ['pcs'] }, 'pcs.claims:author'));
});
test('can() honors legacy pcs-readonly role (no author)', () => {
  assertFalse(can({ roles: ['pcs-readonly'] }, 'pcs.claims:author'));
  assertTrue(can({ roles: ['pcs-readonly'] }, 'pcs.claims:read'));
});
test('can() uses _caps cache when present', () => {
  const u = { roles: ['reviewer'], _caps: new Set(['pcs.claims:author']) };
  assertTrue(can(u, 'pcs.claims:author'));
  assertFalse(can(u, 'sqr.scores:create-own')); // cache overrides roles
});

// ─── canAny / canAll ──────────────────────────────────────────────────────
test('canAny() returns false for empty array', () => {
  assertFalse(canAny({ roles: ['super-user'] }, []));
});
test('canAny() returns false for undefined user', () => {
  assertFalse(canAny(undefined, ['pcs.claims:read']));
});
test('canAny() true when one of many matches', () => {
  assertTrue(canAny({ roles: ['researcher'] }, ['audit:read-logs', 'pcs.claims:author']));
});
test('canAny() false when none match', () => {
  assertFalse(canAny({ roles: ['reviewer'] }, ['audit:read-logs', 'pcs.claims:author']));
});
test('canAll() returns true for empty array (vacuous)', () => {
  assertTrue(canAll({ roles: ['reviewer'] }, []));
});
test('canAll() returns false for undefined user on non-empty list', () => {
  assertFalse(canAll(undefined, ['pcs.claims:read']));
});
test('canAll() true when all match', () => {
  assertTrue(canAll({ roles: ['admin'] }, ['pcs.claims:author', 'users:edit-role']));
});
test('canAll() false when any missing', () => {
  assertFalse(canAll({ roles: ['researcher'] }, ['pcs.claims:author', 'users:edit-role']));
});

// ─── capabilitiesFor ──────────────────────────────────────────────────────
test('capabilitiesFor([]) returns empty set', () => {
  assertEq(capabilitiesFor([]).size, 0);
});
test('capabilitiesFor unions multiple roles', () => {
  const caps = capabilitiesFor(['researcher', 'ra']);
  assertTrue(caps.has('pcs.claims:author'));       // researcher
  assertTrue(caps.has('pcs.requests:resolve-ra')); // ra
});
test('capabilitiesFor ignores unknown roles', () => {
  const caps = capabilitiesFor(['researcher', 'mystery-role']);
  assertTrue(caps.has('pcs.claims:author'));
});
test('capabilitiesFor(undefined) returns empty set', () => {
  assertEq(capabilitiesFor(undefined).size, 0);
});

// ─── SUPER_USER_ONLY_CAPABILITIES ────────────────────────────────────────
test('SUPER_USER_ONLY_CAPABILITIES contains expected keys', () => {
  for (const cap of ['users:delete', 'users:assume-role', 'audit:read-logs-all', 'schema:edit']) {
    if (!SUPER_USER_ONLY_CAPABILITIES.has(cap)) throw new Error(`missing ${cap}`);
  }
});
test('Every SUPER_USER_ONLY cap is absent from admin', () => {
  const adminCaps = new Set(ROLE_CAPABILITY_MAP.admin);
  for (const cap of SUPER_USER_ONLY_CAPABILITIES) {
    if (adminCaps.has(cap)) throw new Error(`admin should not hold super-only ${cap}`);
  }
});

// ─── Run ─────────────────────────────────────────────────────────────────
console.log(`\nWave 7.1 capabilities verification\n${'─'.repeat(60)}`);
for (const t of tests) {
  try {
    t.fn();
    passed++;
    console.log(`  \u2713 ${t.name}`);
  } catch (err) {
    failed++;
    console.log(`  \u2717 ${t.name}`);
    console.log(`      ${err.message}`);
  }
}
console.log(`${'─'.repeat(60)}\n${passed} passed, ${failed} failed (${tests.length} total)\n`);
process.exit(failed > 0 ? 1 : 0);
