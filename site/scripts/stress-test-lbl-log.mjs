#!/usr/bin/env node
/**
 * Companion stress test for /api/session/log — the highest-volume
 * runtime endpoint during a live lines-become-loops session.
 *
 * Creates 1 session, joins 100 students, fires 5 log events per student
 * = 500 parallel POSTs against /log. With the new try/catch hardening,
 * any KV failures are swallowed and 200 is returned regardless.
 *
 * Usage:
 *   node site/scripts/stress-test-lbl-log.mjs [base-url]
 */

const BASE = process.argv[2] || "https://www.windedvertigo.com";
const STUDENTS = 100;
const EVENTS_PER_STUDENT = 5;

const E = {
  create: `${BASE}/portfolio/assets/lines-become-loops/api/session/create`,
  join: `${BASE}/portfolio/assets/lines-become-loops/api/session/join`,
  log: `${BASE}/portfolio/assets/lines-become-loops/api/session/log`,
};

function quantile(arr, q) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil(s.length * q) - 1)];
}

async function timedPost(url, body) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const ms = performance.now() - t0;
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, ms, data, error: res.ok ? null : (data?.error ?? `HTTP ${res.status}`) };
  } catch (err) {
    return { ok: false, status: 0, ms: performance.now() - t0, data: null, error: err.message };
  }
}

async function main() {
  console.log(`/log stress: 1 session × ${STUDENTS} students × ${EVENTS_PER_STUDENT} events = ${STUDENTS * EVENTS_PER_STUDENT} POSTs`);
  console.log(`target: ${BASE}\n`);

  // Setup: create 1 session, join 100 students sequentially (so they all exist)
  console.log("▸ setup: create session + 100 joins");
  const create = await timedPost(E.create, { pin: "1234" });
  if (!create.ok || !create.data?.code) {
    console.error("✗ session create failed:", create);
    process.exit(1);
  }
  const code = create.data.code;
  console.log(`  code: ${code}`);

  const joins = await Promise.all(Array.from({ length: STUDENTS }, () => timedPost(E.join, { code })));
  const pids = joins.filter(j => j.ok && j.data?.participantId).map(j => j.data.participantId);
  console.log(`  pids: ${pids.length}/${STUDENTS}`);
  if (pids.length === 0) {
    console.error("✗ no participants joined — aborting");
    process.exit(1);
  }

  // Phase: 5 log events per student, all parallel
  console.log(`\n▸ burst: ${pids.length * EVENTS_PER_STUDENT} parallel POST /log`);
  const t0 = performance.now();
  const logPromises = [];
  const eventTypes = ["scenario_start", "interact", "reflection", "scenario_complete", "click"];
  for (const pid of pids) {
    for (let i = 0; i < EVENTS_PER_STUDENT; i++) {
      logPromises.push(timedPost(E.log, {
        sessionCode: code,
        participantId: pid,
        type: eventTypes[i % eventTypes.length],
        data: { scenario: `scenario-${i}`, step: i },
      }));
    }
  }
  const results = await Promise.all(logPromises);
  const elapsed = performance.now() - t0;
  console.log(`  done in ${Math.round(elapsed)}ms`);

  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  const lat = ok.map(r => r.ms);
  const errs = {};
  for (const f of fail) {
    const k = `${f.status} ${(f.error || "n/a").slice(0, 50)}`;
    errs[k] = (errs[k] || 0) + 1;
  }

  console.log("\n═══ results ═══");
  console.log({
    total: results.length,
    ok: ok.length,
    failed: fail.length,
    success_pct: ((ok.length / results.length) * 100).toFixed(1) + "%",
    p50_ms: Math.round(quantile(lat, 0.5)),
    p95_ms: Math.round(quantile(lat, 0.95)),
    p99_ms: Math.round(quantile(lat, 0.99)),
    max_ms: Math.round(Math.max(...lat, 0)),
    throughput_rps: Math.round(results.length / (elapsed / 1000)),
    errors: errs,
  });

  const verdict = ok.length / results.length >= 0.95;
  console.log(`\nverdict: ${verdict ? "✓ PASS" : "✗ FAIL"} (${verdict ? "≥" : "<"} 95% success)`);
  process.exit(verdict ? 0 : 1);
}

main().catch(err => {
  console.error("fatal:", err);
  process.exit(1);
});
