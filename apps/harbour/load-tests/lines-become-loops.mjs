/**
 * Load test: Lines Become Loops — breakout-room scenario
 *
 * Models a webinar with ~75 small sessions × 4 participants each (~300 total),
 * which is the realistic shape for this game (not one big classroom).
 *
 * Per session:
 *   - 1 facilitator: POST /create, then GET /status every 5s for the run
 *   - 3 participants: POST /join, then ~10 POST /log events spread over the run
 *
 * This is a DIFFERENT stress profile from a single big classroom — KV writes
 * fan out across many keys (low per-key contention) but the total request rate
 * still has to clear without errors or tail-latency blow-ups.
 *
 * Usage:
 *   BASE=https://www.windedvertigo.com node load-tests/lines-become-loops.mjs
 *   BASE=https://wv-site-preview.windedvertigo.workers.dev SESSIONS=10 node load-tests/lines-become-loops.mjs
 */

const BASE = process.env.BASE || "https://www.windedvertigo.com";
const SESSIONS = Number(process.env.SESSIONS) || 75;
const PARTICIPANTS_PER_SESSION = Number(process.env.PARTICIPANTS_PER_SESSION) || 3;
const EVENTS_PER_PARTICIPANT = Number(process.env.EVENTS_PER_PARTICIPANT) || 10;
const RUN_SECONDS = Number(process.env.RUN_SECONDS) || 60;
const FACILITATOR_POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS) || 5000;

const API = `${BASE}/portfolio/assets/lines-become-loops/api/session`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function jitter(ms) { return ms * (0.7 + Math.random() * 0.6); }

async function timedJson(op, init) {
  const t0 = performance.now();
  try {
    const res = await fetch(init.url, init);
    const ms = performance.now() - t0;
    let body = null;
    try { body = await res.json(); } catch {}
    return { timing: { op, ms, status: res.status, ok: res.ok }, body };
  } catch (err) {
    return { timing: { op, ms: performance.now() - t0, status: 0, ok: false, error: String(err) }, body: null };
  }
}

async function runFacilitator(timings) {
  const { timing: createT, body: createBody } = await timedJson("create", {
    url: `${API}/create`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: "1234" }),
  });
  timings.push(createT);
  const code = createBody?.code;
  if (!code) return { code: null, timings };

  const stop = Date.now() + RUN_SECONDS * 1000;
  const pollLoop = (async () => {
    await sleep(jitter(FACILITATOR_POLL_INTERVAL_MS));
    while (Date.now() < stop) {
      const { timing } = await timedJson("status", {
        url: `${API}/status?code=${code}&pin=1234`,
        method: "GET",
      });
      timings.push(timing);
      await sleep(jitter(FACILITATOR_POLL_INTERVAL_MS));
    }
  })();

  return { code, pollLoop, timings };
}

async function runParticipant(code, idx, timings) {
  const { timing: joinT, body: joinBody } = await timedJson("join", {
    url: `${API}/join`,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  timings.push(joinT);
  const pid = joinBody?.participantId;
  if (!pid) return;

  const scenarios = ["churn", "burnout", "sleep", "lakeshore"];
  const interval = (RUN_SECONDS * 1000) / EVENTS_PER_PARTICIPANT;
  for (let i = 0; i < EVENTS_PER_PARTICIPANT; i++) {
    await sleep(jitter(interval));
    const { timing } = await timedJson("log", {
      url: `${API}/log`,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionCode: code,
        participantId: pid,
        type: i === 0 ? "scenario_started" : "slider_move",
        data: { scenario: scenarios[(idx + i) % scenarios.length], dosage: i * 10, interventionId: `int-${i}` },
      }),
    });
    timings.push(timing);
  }
}

async function runSession(sessionIdx, timings) {
  const fac = await runFacilitator(timings);
  if (!fac.code) return;

  const participants = await Promise.allSettled(
    Array.from({ length: PARTICIPANTS_PER_SESSION }, (_, i) =>
      runParticipant(fac.code, sessionIdx * PARTICIPANTS_PER_SESSION + i, timings),
    ),
  );

  if (fac.pollLoop) await fac.pollLoop;
  return participants.filter((p) => p.status === "rejected").length;
}

function pct(arr, p) {
  if (!arr.length) return "N/A";
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = p >= 100 ? sorted.length - 1 : Math.floor((sorted.length * p) / 100);
  return sorted[idx].toFixed(0) + "ms";
}

async function main() {
  console.log(`\nLines Become Loops — breakout-room load test`);
  console.log(`BASE=${BASE}`);
  console.log(`${SESSIONS} sessions × ${PARTICIPANTS_PER_SESSION + 1} (= ${SESSIONS * (PARTICIPANTS_PER_SESSION + 1)} concurrent clients), ${RUN_SECONDS}s run\n`);

  const timings = [];
  const start = performance.now();
  const results = await Promise.allSettled(
    Array.from({ length: SESSIONS }, (_, i) => runSession(i, timings)),
  );
  const totalMs = performance.now() - start;

  const byOp = {};
  let errors = 0;
  for (const r of results) {
    if (r.status === "rejected") { errors++; continue; }
    if (r.value && typeof r.value === "number") errors += r.value;
  }
  for (const t of timings) {
    if (!byOp[t.op]) byOp[t.op] = { ok: [], failed: 0 };
    if (t.ok) byOp[t.op].ok.push(t.ms);
    else byOp[t.op].failed++;
  }

  console.log("\n── Results ─────────────────────────────");
  console.log(`Total wall time:  ${(totalMs / 1000).toFixed(1)}s`);
  console.log(`Session-level errors: ${errors}`);
  for (const [op, { ok, failed }] of Object.entries(byOp)) {
    console.log(
      `${op.padEnd(8)}  ok=${String(ok.length).padStart(4)}  failed=${String(failed).padStart(3)}  p50=${pct(ok, 50)}  p95=${pct(ok, 95)}  p99=${pct(ok, 99)}  max=${pct(ok, 100)}`,
    );
  }
  console.log("─────────────────────────────────────────\n");

  const totalFailed = Object.values(byOp).reduce((s, b) => s + b.failed, 0) + errors;
  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
