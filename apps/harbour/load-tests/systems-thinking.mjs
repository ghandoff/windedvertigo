/**
 * Load test: Systems Thinking — 250 simulated students
 *
 * Flow per user:
 *  1. POST /api/session/create   (facilitator creates session)
 *  2. POST /api/session/join     (student joins)
 *  3. POST /api/session/log ×5   (student logs events)
 *  4. GET  /api/session/status   (facilitator checks roster)
 *
 * Runs all 250 students concurrently, reports p50/p95/p99 latency.
 */

import https from 'https';

const BASE = 'https://systems-thinking.pages.dev';
const USERS = 250;
const EVENTS_PER_USER = 5;

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}

async function runUser(sessionCode, index) {
  const timings = [];
  const t = () => performance.now();

  // join
  let t0 = t();
  const join = await request('POST', '/api/session/join', { code: sessionCode });
  timings.push({ op: 'join', ms: t() - t0, status: join.status });

  if (join.status !== 200) return { timings, error: `join failed ${join.status}` };
  const { participantId } = join.body;

  // log events
  const scenarios = ['churn', 'burnout', 'sleep', 'lakeshore', 'churn'];
  for (let i = 0; i < EVENTS_PER_USER; i++) {
    t0 = t();
    const log = await request('POST', '/api/session/log', {
      sessionCode,
      participantId,
      type: i === 0 ? 'scenario_started' : 'slider_move',
      data: { scenario: scenarios[i % scenarios.length], dosage: i * 10, interventionId: `int-${i}` },
    });
    timings.push({ op: 'log', ms: t() - t0, status: log.status });
  }

  return { timings };
}

async function main() {
  console.log(`\nSystems Thinking load test — ${USERS} concurrent users\n`);

  // facilitator creates one session
  console.log('Creating session...');
  const create = await request('POST', '/api/session/create', { pin: '1234' });
  if (create.status !== 200) {
    console.error('Session create failed:', create.status, create.body);
    process.exit(1);
  }
  const { code } = create.body;
  console.log(`Session code: ${code}\n`);

  // launch all users concurrently
  console.log(`Launching ${USERS} users concurrently...`);
  const start = performance.now();
  const results = await Promise.allSettled(
    Array.from({ length: USERS }, (_, i) => runUser(code, i))
  );
  const totalMs = performance.now() - start;

  // collect all timings
  const byOp = {};
  let errors = 0;
  for (const r of results) {
    if (r.status === 'rejected') { errors++; continue; }
    if (r.value.error) { errors++; }
    for (const t of r.value.timings ?? []) {
      if (!byOp[t.op]) byOp[t.op] = [];
      if (t.status >= 200 && t.status < 300) byOp[t.op].push(t.ms);
    }
  }

  // percentiles
  function pct(arr, p) {
    if (!arr.length) return 'N/A';
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = p >= 100 ? sorted.length - 1 : Math.floor(sorted.length * p / 100);
    return sorted[idx].toFixed(0) + 'ms';
  }

  console.log('\n── Results ─────────────────────────────');
  console.log(`Total wall time:  ${(totalMs / 1000).toFixed(2)}s`);
  console.log(`Errors:           ${errors} / ${USERS}`);
  console.log('');
  for (const [op, times] of Object.entries(byOp)) {
    console.log(`${op.padEnd(8)}  n=${String(times.length).padStart(4)}  p50=${pct(times,50)}  p95=${pct(times,95)}  p99=${pct(times,99)}  max=${pct(times,100)}`);
  }

  // facilitator status check after all logs
  const t0 = performance.now();
  const status = await request('GET', `/api/session/status?code=${code}&pin=1234`);
  const statusMs = performance.now() - t0;
  console.log(`\nfacilitator status: ${status.status} (${statusMs.toFixed(0)}ms) — ${status.body?.studentCount ?? '?'} students`);
  console.log('─────────────────────────────────────────\n');
}

main().catch(console.error);
