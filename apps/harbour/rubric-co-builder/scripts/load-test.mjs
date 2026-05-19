#!/usr/bin/env node
/**
 * Load test for the rubric-co-builder family.
 *
 * Track A (full): 20 rooms × 15 students each = 300 users. Each room
 *   walks through: create → join × 15 → heartbeat × 15 → frame → propose →
 *   snapshot polls × 30 → vote → tally. Measures per-stage latency
 *   percentiles + error counts.
 *
 * Track B (companion): 300 concurrent GETs to the landing page +
 *   workshop page. Purely static, so this is an edge-cache stress test.
 *
 * Usage:
 *   node load-test.mjs --track a       # full app
 *   node load-test.mjs --track b       # companion
 *   node load-test.mjs --track a --rooms 5 --students 5  # smoke
 *   node load-test.mjs --track both
 *
 * Defaults assume production targets. Use --base-a / --base-b to override.
 */

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return def;
  return args[i + 1];
}
const TRACK = arg("track", "both");
const ROOMS = Number(arg("rooms", 20));
const STUDENTS = Number(arg("students", 15));
const COMPANION_HITS = Number(arg("hits", 300));
const CONCURRENCY = Number(arg("concurrency", 30));
const BASE_A = arg("base-a", "https://windedvertigo.com/harbour/rubric-co-builder");
const BASE_B = arg("base-b", "https://windedvertigo.com/harbour/rubric-co-builder-companion");

// ── concurrency limiter ───────────────────────────────────────────────
function makeLimiter(max) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= max) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    job.fn().then(
      (v) => {
        active--;
        job.resolve(v);
        next();
      },
      (e) => {
        active--;
        job.reject(e);
        next();
      },
    );
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      next();
    });
}

// ── stats ─────────────────────────────────────────────────────────────
function pct(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label, samples, errors) {
  const n = samples.length;
  if (n === 0) {
    console.log(`  ${label.padEnd(30)} 0 ok · ${errors} err`);
    return;
  }
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const p50 = pct(samples, 50);
  const p95 = pct(samples, 95);
  const p99 = pct(samples, 99);
  console.log(
    `  ${label.padEnd(30)} ${String(n).padStart(4)} ok · ${String(errors).padStart(3)} err · min ${min}ms · p50 ${p50}ms · p95 ${p95}ms · p99 ${p99}ms · max ${max}ms`,
  );
}

// ── timed fetch ───────────────────────────────────────────────────────
async function timed(fn) {
  const t0 = Date.now();
  try {
    const res = await fn();
    return { ok: res.ok, status: res.status, ms: Date.now() - t0, res };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: e?.message ?? String(e) };
  }
}

// ── track A: one room's flow ──────────────────────────────────────────
async function runRoom(roomIdx, limit, stats) {
  // 1. create room
  const created = await timed(() =>
    fetch(`${BASE_A}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learning_outcome: `load test room ${roomIdx}`,
        project_description: `load test ${roomIdx}`,
      }),
    }),
  );
  stats.create.samples.push(created.ms);
  if (!created.ok) {
    stats.create.errors++;
    return;
  }
  const { code, host_token } = await created.res.json();
  const HOST_HEADERS = { "X-Host-Token": host_token, "content-type": "application/json" };

  // 2. parallel join × STUDENTS
  const joins = await Promise.all(
    Array.from({ length: STUDENTS }, () =>
      limit(() =>
        timed(() => fetch(`${BASE_A}/api/rooms/${code}/join`, { method: "POST" })),
      ),
    ),
  );
  const pids = [];
  for (const j of joins) {
    stats.join.samples.push(j.ms);
    if (j.ok) {
      const body = await j.res.json();
      pids.push(body.participant_id);
    } else {
      stats.join.errors++;
    }
  }

  // 3. heartbeat from each
  const beats = await Promise.all(
    pids.map((pid) =>
      limit(() =>
        timed(() =>
          fetch(`${BASE_A}/api/rooms/${code}/heartbeat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ participant_id: pid }),
          }),
        ),
      ),
    ),
  );
  for (const b of beats) {
    stats.heartbeat.samples.push(b.ms);
    if (!b.ok) stats.heartbeat.errors++;
  }

  // 4. advance host: lobby → frame → propose → vote
  for (const next of ["frame", "propose", "vote"]) {
    const adv = await limit(() =>
      timed(() =>
        fetch(`${BASE_A}/api/rooms/${code}`, {
          method: "PATCH",
          headers: HOST_HEADERS,
          body: JSON.stringify({ state: next }),
        }),
      ),
    );
    stats.advance.samples.push(adv.ms);
    if (!adv.ok) stats.advance.errors++;
  }

  // 5. snapshot polls × 30 (simulates 2 polls per student during a vote window)
  const polls = await Promise.all(
    Array.from({ length: 30 }, () =>
      limit(() => timed(() => fetch(`${BASE_A}/api/rooms/${code}`))),
    ),
  );
  for (const p of polls) {
    stats.snapshot.samples.push(p.ms);
    if (!p.ok) stats.snapshot.errors++;
  }

  // pull a criterion id from the last successful snapshot for voting
  let criterionId = null;
  for (let i = polls.length - 1; i >= 0; i--) {
    const p = polls[i];
    if (p.ok) {
      const body = await p.res.json();
      const c = body.criteria?.find((x) => x.status !== "rejected");
      if (c) criterionId = c.id;
      break;
    }
  }

  // 6. each student votes (in the vote state, round 1)
  if (criterionId) {
    const votes = await Promise.all(
      pids.map((pid) =>
        limit(() =>
          timed(() =>
            fetch(`${BASE_A}/api/rooms/${code}/votes`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                participant_id: pid,
                criterion_id: criterionId,
                round: 1,
              }),
            }),
          ),
        ),
      ),
    );
    for (const v of votes) {
      stats.vote.samples.push(v.ms);
      if (!v.ok) stats.vote.errors++;
    }
  }

  // 7. host tallies
  const tally = await limit(() =>
    timed(() =>
      fetch(`${BASE_A}/api/rooms/${code}/tally`, {
        method: "POST",
        headers: HOST_HEADERS,
      }),
    ),
  );
  stats.tally.samples.push(tally.ms);
  if (!tally.ok) stats.tally.errors++;
}

async function trackA() {
  console.log(`\n── Track A · ${ROOMS} rooms × ${STUDENTS} students = ${ROOMS * STUDENTS} users`);
  console.log(`   target ${BASE_A}`);
  console.log(`   concurrency cap: ${CONCURRENCY} in-flight requests`);
  const limit = makeLimiter(CONCURRENCY);
  const stats = {
    create: { samples: [], errors: 0 },
    join: { samples: [], errors: 0 },
    heartbeat: { samples: [], errors: 0 },
    advance: { samples: [], errors: 0 },
    snapshot: { samples: [], errors: 0 },
    vote: { samples: [], errors: 0 },
    tally: { samples: [], errors: 0 },
  };
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: ROOMS }, (_, i) => runRoom(i, limit, stats)),
  );
  const wall = Date.now() - t0;
  console.log(`   wall clock: ${(wall / 1000).toFixed(1)}s`);
  console.log("   per-operation:");
  for (const [k, v] of Object.entries(stats)) summarize(k, v.samples, v.errors);
  const totalReq = Object.values(stats).reduce(
    (s, v) => s + v.samples.length + v.errors,
    0,
  );
  const totalErr = Object.values(stats).reduce((s, v) => s + v.errors, 0);
  console.log(
    `   total: ${totalReq} requests · ${totalErr} errors · ${(totalReq / (wall / 1000)).toFixed(0)} req/s avg`,
  );
}

// ── track B ───────────────────────────────────────────────────────────
async function trackB() {
  console.log(`\n── Track B · ${COMPANION_HITS} concurrent users hitting the companion`);
  console.log(`   target ${BASE_B}`);
  console.log(`   concurrency cap: ${CONCURRENCY} in-flight requests`);
  const limit = makeLimiter(CONCURRENCY);
  const stats = {
    landing: { samples: [], errors: 0 },
    workshop: { samples: [], errors: 0 },
  };
  const t0 = Date.now();
  await Promise.all([
    ...Array.from({ length: COMPANION_HITS }, () =>
      limit(async () => {
        const r = await timed(() => fetch(`${BASE_B}/`));
        stats.landing.samples.push(r.ms);
        if (!r.ok) stats.landing.errors++;
      }),
    ),
    ...Array.from({ length: COMPANION_HITS }, () =>
      limit(async () => {
        const r = await timed(() => fetch(`${BASE_B}/workshop`));
        stats.workshop.samples.push(r.ms);
        if (!r.ok) stats.workshop.errors++;
      }),
    ),
  ]);
  const wall = Date.now() - t0;
  console.log(`   wall clock: ${(wall / 1000).toFixed(1)}s`);
  console.log("   per-operation:");
  for (const [k, v] of Object.entries(stats)) summarize(k, v.samples, v.errors);
  const totalReq = Object.values(stats).reduce(
    (s, v) => s + v.samples.length + v.errors,
    0,
  );
  console.log(
    `   total: ${totalReq} requests · ${(totalReq / (wall / 1000)).toFixed(0)} req/s avg`,
  );
}

// ── main ──────────────────────────────────────────────────────────────
async function main() {
  if (TRACK === "a" || TRACK === "both") await trackA();
  if (TRACK === "b" || TRACK === "both") await trackB();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
