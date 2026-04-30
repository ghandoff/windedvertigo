#!/usr/bin/env node
/**
 * Stress test for lines-become-loops session API under realistic webinar load.
 *
 * Simulates: 25 facilitators create sessions, then 100 students (4 per
 * session) all hammer /join simultaneously — the actual moment of peak
 * load when a webinar opens registration.
 *
 * Captures: success rate, p50/p95/p99 latency, error breakdown, KV-write
 * fail observability (the new try/catch should let joins succeed even
 * when KV is throttled).
 *
 * Usage:
 *   node site/scripts/stress-test-lbl.mjs [base-url]
 *
 * Defaults to https://www.windedvertigo.com.
 *
 * Note: this WILL consume real Cloudflare KV writes against the
 * production worker. Sessions have a TTL and will expire. Don't run
 * this within a few minutes of an actual webinar to avoid KV quota
 * collision.
 */

const BASE = process.argv[2] || "https://www.windedvertigo.com";
const SESSIONS = 25;
const STUDENTS_PER_SESSION = 4;

const ENDPOINTS = {
  create: `${BASE}/portfolio/assets/lines-become-loops/api/session/create`,
  join: `${BASE}/portfolio/assets/lines-become-loops/api/session/join`,
};

function quantile(arr, q) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * q) - 1;
  return sorted[Math.max(0, idx)];
}

function summarize(name, results) {
  const ok = results.filter(r => r.ok);
  const fail = results.filter(r => !r.ok);
  const lat = ok.map(r => r.ms);
  const errors = {};
  for (const f of fail) {
    const k = `${f.status} ${f.error?.slice(0, 50) ?? "n/a"}`;
    errors[k] = (errors[k] || 0) + 1;
  }
  return {
    name,
    total: results.length,
    ok: ok.length,
    failed: fail.length,
    success_pct: ((ok.length / results.length) * 100).toFixed(1) + "%",
    p50_ms: Math.round(quantile(lat, 0.5)),
    p95_ms: Math.round(quantile(lat, 0.95)),
    p99_ms: Math.round(quantile(lat, 0.99)),
    max_ms: Math.round(Math.max(...lat, 0)),
    errors,
  };
}

async function timedFetch(url, body) {
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
    return {
      ok: res.ok,
      status: res.status,
      ms,
      data,
      error: res.ok ? null : (data?.error ?? `HTTP ${res.status}`),
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      ms: performance.now() - t0,
      data: null,
      error: err.message,
    };
  }
}

async function main() {
  console.log(`stress test: ${SESSIONS} sessions × ${STUDENTS_PER_SESSION} students = ${SESSIONS * STUDENTS_PER_SESSION} joins`);
  console.log(`target: ${BASE}\n`);

  // Phase 1: create 25 sessions in parallel
  console.log(`▸ phase 1: ${SESSIONS} parallel POST /create`);
  const t0 = performance.now();
  const createResults = await Promise.all(
    Array.from({ length: SESSIONS }, () =>
      timedFetch(ENDPOINTS.create, { pin: String(Math.floor(1000 + Math.random() * 9000)) })
    )
  );
  const createTime = performance.now() - t0;
  console.log(`  done in ${Math.round(createTime)}ms`);

  const codes = createResults.filter(r => r.ok && r.data?.code).map(r => r.data.code);
  console.log(`  codes issued: ${codes.length}/${SESSIONS}`);

  if (codes.length === 0) {
    console.error("\n✗ no session codes issued — aborting");
    console.log(JSON.stringify(summarize("create", createResults), null, 2));
    process.exit(1);
  }

  // Phase 2: 4 students per session, all joining simultaneously
  // This is the realistic peak: webinar opens, everyone clicks join at once.
  console.log(`\n▸ phase 2: ${codes.length * STUDENTS_PER_SESSION} parallel POST /join (peak burst)`);
  const t1 = performance.now();
  const joinPromises = [];
  for (const code of codes) {
    for (let i = 0; i < STUDENTS_PER_SESSION; i++) {
      joinPromises.push(timedFetch(ENDPOINTS.join, { code }));
    }
  }
  const joinResults = await Promise.all(joinPromises);
  const joinTime = performance.now() - t1;
  console.log(`  done in ${Math.round(joinTime)}ms`);

  // Verify participantIds are unique (catches duplicate-issuance bugs)
  const pids = joinResults.filter(r => r.ok && r.data?.participantId).map(r => r.data.participantId);
  const uniquePids = new Set(pids);
  console.log(`  participantIds issued: ${pids.length}, unique: ${uniquePids.size}`);

  // Print summary
  console.log("\n═══ results ═══\n");
  console.log("CREATE:", JSON.stringify(summarize("create", createResults), null, 2));
  console.log("\nJOIN:  ", JSON.stringify(summarize("join", joinResults), null, 2));

  // Pass/fail verdict
  const createOk = createResults.filter(r => r.ok).length / SESSIONS >= 0.95;
  const joinOk = joinResults.filter(r => r.ok).length / joinResults.length >= 0.95;
  const noDupes = pids.length === uniquePids.size;
  const verdict = createOk && joinOk && noDupes ? "✓ PASS" : "✗ FAIL";
  console.log(`\nverdict: ${verdict}`);
  console.log(`  create ≥ 95%: ${createOk ? "✓" : "✗"}`);
  console.log(`  join ≥ 95%: ${joinOk ? "✓" : "✗"}`);
  console.log(`  unique participantIds: ${noDupes ? "✓" : "✗"}`);
}

main().catch(err => {
  console.error("fatal:", err);
  process.exit(1);
});
