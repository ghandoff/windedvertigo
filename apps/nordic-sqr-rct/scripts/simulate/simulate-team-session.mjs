#!/usr/bin/env node
/**
 * Multi-actor team-session simulation.
 *
 * Models what 3-6 Nordic researchers (Sharon, Gina, Adin, Lauren) would
 * do in a typical 5-minute window across the platform. Runs all actors
 * concurrently against production. Measures end-to-end latencies as
 * the team would experience them.
 *
 * What this proves:
 *   - Concurrent reads serve from Postgres without contention
 *   - Postgres mirror under simulated load doesn't degrade
 *   - The Vercel function pool handles the real-world burst pattern
 *
 * Actor scripts:
 *   - Sharon (PM):    browses /pcs/documents → opens 3 docs → checks claims for one
 *   - Gina (RA):      browses /pcs/evidence → searches "menaquinone" → opens 2 evidence rows
 *   - Adin (Research):browses /pcs/claims → filters bucket=3A → opens a claim → reads its evidence packets
 *   - Lauren (Lead):  hits /pcs/dashboard → opens an ingredients drilldown
 *   - Researcher 5:   uses ArticleSearchPanel → searches a DOI → discovers it's "in library"
 *   - Researcher 6:   browses /pcs/canonical-claims → filters by family
 *
 * Each actor logs latency per request. At the end we print:
 *   - per-actor request count + p50/p95 latency
 *   - per-route aggregate timings
 *   - any non-200 / non-401 responses (failures we'd want to investigate)
 *
 * Usage:
 *   COOKIE='<session-cookie>' node scripts/simulate/simulate-team-session.mjs
 *   COOKIE='...' DURATION_S=120 ACTORS=12 node scripts/simulate/simulate-team-session.mjs
 *
 * Without COOKIE the simulation still runs but every request 401s, which
 * is useful for measuring the auth-rejection-path latency baseline.
 */

import { authedFetch, BASE_URL, fmt } from './_lib.mjs';

const DURATION_S = parseInt(process.env.DURATION_S || '60', 10);
const ACTORS = parseInt(process.env.ACTORS || '6', 10);
const hasCookie = !!process.env.COOKIE;

console.log(
  `\nSimulating ${ACTORS} concurrent actors for ${DURATION_S}s against ${BASE_URL}`,
);
console.log(`Auth: ${hasCookie ? 'COOKIE present' : 'anonymous (expect 401s)'}\n`);

const ACTOR_SCRIPTS = [
  {
    name: 'Sharon (PM)',
    flow: async (record) => {
      await record('GET', '/pcs/documents');
      await record('GET', '/api/pcs/documents');
      // Pretend to open 3 documents
      const docsRes = await record('GET', '/api/pcs/documents');
      if (docsRes.status === 200) {
        const docs = await docsRes.body();
        for (const d of (docs.slice ? docs.slice(0, 3) : (docs.items || []).slice(0, 3))) {
          if (d?.id) await record('GET', `/api/pcs/documents/${d.id}`);
        }
      }
    },
  },
  {
    name: 'Gina (RA)',
    flow: async (record) => {
      await record('GET', '/pcs/evidence');
      await record('GET', '/api/pcs/evidence');
      // Search via the article-search panel
      await record('GET', '/api/pcs/evidence/search?q=menaquinone&limit=10');
      // Open a couple of evidence rows
      const evRes = await record('GET', '/api/pcs/evidence');
      if (evRes.status === 200) {
        const ev = await evRes.body();
        const rows = ev.slice ? ev : (ev.items || []);
        for (const e of rows.slice(0, 2)) {
          if (e?.id) await record('GET', `/api/pcs/evidence/${e.id}`);
        }
      }
    },
  },
  {
    name: 'Adin (Research)',
    flow: async (record) => {
      await record('GET', '/pcs/claims');
      await record('GET', '/api/pcs/claims');
      await record('GET', '/api/pcs/claims?bucket=3A');
      const cRes = await record('GET', '/api/pcs/claims');
      if (cRes.status === 200) {
        const c = await cRes.body();
        const rows = c.slice ? c : (c.items || []);
        const first = rows.find((r) => r?.id);
        if (first) {
          await record('GET', `/api/pcs/claims/${first.id}`);
          // Pretend to load the claim's evidence packets
          await record('GET', `/api/pcs/claims/${first.id}/evidence-packets`);
        }
      }
    },
  },
  {
    name: 'Lauren (Lead)',
    flow: async (record) => {
      await record('GET', '/pcs');
      await record('GET', '/api/pcs/dashboard');
      await record('GET', '/api/pcs/ingredients');
      await record('GET', '/pcs/ingredients');
    },
  },
  {
    name: 'Researcher 5',
    flow: async (record) => {
      await record('GET', '/pcs/evidence');
      await record('GET', '/api/pcs/evidence/search?q=10.1007/s00198-013-2325-6');
      // The "in library" check happens server-side as part of search
    },
  },
  {
    name: 'Researcher 6',
    flow: async (record) => {
      await record('GET', '/pcs/canonical-claims');
      await record('GET', '/api/pcs/canonical-claims');
      await record('GET', '/api/pcs/core-benefits');
    },
  },
];

const allRequests = [];
const failures = [];

async function runActor(scriptIdx, durationMs) {
  const script = ACTOR_SCRIPTS[scriptIdx % ACTOR_SCRIPTS.length];
  const actorRequests = [];

  const record = async (method, path) => {
    const url = `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}cb=${Date.now()}-${Math.random()}`;
    const t = Date.now();
    let resp = null;
    try {
      resp = await authedFetch(url, { method });
    } catch (err) {
      const ms = Date.now() - t;
      const rec = { actor: script.name, method, path, ms, status: 'ERR', error: err.message };
      actorRequests.push(rec);
      allRequests.push(rec);
      failures.push(rec);
      return { status: 0, body: () => Promise.resolve(null) };
    }
    const ms = Date.now() - t;
    const cache = resp.headers.get('x-vercel-cache') || '-';
    const rec = { actor: script.name, method, path, ms, status: resp.status, cache };
    actorRequests.push(rec);
    allRequests.push(rec);
    if (![200, 304, 401, 403].includes(resp.status)) {
      failures.push(rec);
    }
    return {
      status: resp.status,
      body: async () => {
        try {
          return await resp.json();
        } catch {
          return null;
        }
      },
    };
  };

  const deadline = Date.now() + durationMs;
  let cycles = 0;
  while (Date.now() < deadline) {
    try {
      await script.flow(record);
    } catch (err) {
      console.log(`  ! ${script.name} flow threw: ${err.message}`);
    }
    cycles++;
    // Brief pause between cycles to mimic human pacing
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
  }
  return { actor: script.name, cycles, requests: actorRequests.length };
}

// Spin up ACTORS concurrent flows
const promises = [];
for (let i = 0; i < ACTORS; i++) {
  promises.push(runActor(i, DURATION_S * 1000));
}

const start = Date.now();
const actorResults = await Promise.all(promises);
const totalMs = Date.now() - start;

// Aggregations
const byActor = {};
for (const r of allRequests) {
  if (!byActor[r.actor]) byActor[r.actor] = [];
  byActor[r.actor].push(r);
}

const byPath = {};
for (const r of allRequests) {
  const p = r.path.split('?')[0];
  if (!byPath[p]) byPath[p] = [];
  byPath[p].push(r);
}

function pct(arr, p) {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * (p / 100))];
}

console.log(`\n${'='.repeat(70)}`);
console.log(`Run finished in ${fmt.ms(totalMs)}: ${allRequests.length} requests across ${ACTORS} actors\n`);

console.log('PER-ACTOR SUMMARY');
console.log('─'.repeat(70));
for (const [actor, recs] of Object.entries(byActor)) {
  const ms = recs.map((r) => r.ms);
  const cycles = actorResults.find((r) => r.actor === actor)?.cycles ?? '?';
  console.log(
    `  ${actor.padEnd(20)} ${recs.length.toString().padStart(4)} reqs · ${cycles} cycles · p50 ${fmt.ms(pct(ms, 50) || 0)} · p95 ${fmt.ms(pct(ms, 95) || 0)}`,
  );
}

console.log('\nPER-ROUTE AGGREGATE');
console.log('─'.repeat(70));
const sortedPaths = Object.entries(byPath).sort((a, b) => b[1].length - a[1].length);
for (const [path, recs] of sortedPaths) {
  const ms = recs.map((r) => r.ms);
  const statuses = recs.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});
  const cacheHits = recs.filter((r) => r.cache === 'HIT').length;
  const statusStr = Object.entries(statuses)
    .map(([s, n]) => `${s}:${n}`)
    .join(' ');
  console.log(
    `  ${path.padEnd(46)} ${recs.length.toString().padStart(4)} · p50 ${fmt.ms(pct(ms, 50) || 0).padStart(7)} · p95 ${fmt.ms(pct(ms, 95) || 0).padStart(7)} · ${cacheHits}/${recs.length} cache hits · ${statusStr}`,
  );
}

if (failures.length > 0) {
  console.log(`\n${failures.length} FAILURES (non-200/304/401/403):`);
  for (const f of failures.slice(0, 20)) {
    console.log(`  ! ${f.actor.padEnd(20)} ${f.method} ${f.path} → ${f.status} ${f.error || ''} (${fmt.ms(f.ms)})`);
  }
  if (failures.length > 20) console.log(`  ... + ${failures.length - 20} more`);
  process.exit(1);
}

console.log('\n✓ no unexpected failures across the simulated session');
