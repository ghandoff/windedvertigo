/**
 * Load test: Values Auction — 250 simulated participants + 1 facilitator
 *
 * Flow:
 *  - 1 facilitator WebSocket connects, sends START action
 *  - 249 participant WebSockets connect to the same session
 *  - facilitator sends BID action every 500ms for 10 rounds
 *  - measures: connection time, message receive latency, broadcast fan-out
 *
 * Run from harbour-apps root (ws is in root node_modules).
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const WebSocket = require('ws');

const HUB_URL = 'wss://values-auction-hub.windedvertigo.workers.dev';
const SESSION_ID = `loadtest-${Date.now()}`;
const PARTICIPANTS = 249; // + 1 facilitator = 250 total
const ROUNDS = 10;
const ROUND_MS = 500;

function connect(role, id) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const ws = new WebSocket(
      `${HUB_URL}?session=${SESSION_ID}&role=${role}&id=${encodeURIComponent(id)}`
    );
    ws.on('open', () => resolve({ ws, connectMs: performance.now() - t0 }));
    ws.on('error', reject);
    ws.setTimeout?.(10000);
    setTimeout(() => reject(new Error(`connect timeout: ${id}`)), 10000);
  });
}

async function main() {
  console.log(`\nValues Auction load test — ${PARTICIPANTS + 1} concurrent WebSocket connections`);
  console.log(`Session: ${SESSION_ID}\n`);

  // connect all in parallel
  console.log('Connecting all clients...');
  const connectStart = performance.now();

  const [facilitatorResult, ...participantResults] = await Promise.allSettled([
    connect('facilitator', 'facilitator-0'),
    ...Array.from({ length: PARTICIPANTS }, (_, i) => connect('participant', `user-${i}`)),
  ]);

  const connectWallMs = performance.now() - connectStart;
  const connected = participantResults.filter((r) => r.status === 'fulfilled');
  const connectFailed = participantResults.filter((r) => r.status === 'rejected').length;
  const connectTimes = connected.map((r) => r.value.connectMs).sort((a, b) => a - b);

  function pct(arr, p) {
    if (!arr.length) return 'N/A';
    return arr[Math.floor(arr.length * p / 100)].toFixed(0) + 'ms';
  }

  console.log(`Connected: ${connected.length + (facilitatorResult.status === 'fulfilled' ? 1 : 0)} / ${PARTICIPANTS + 1}`);
  console.log(`Connect failures: ${connectFailed + (facilitatorResult.status === 'rejected' ? 1 : 0)}`);
  console.log(`Connect wall time: ${(connectWallMs / 1000).toFixed(2)}s`);
  console.log(`Connect latency  p50=${pct(connectTimes, 50)}  p95=${pct(connectTimes, 95)}  p99=${pct(connectTimes, 99)}`);

  if (facilitatorResult.status === 'rejected') {
    console.error('Facilitator connect failed:', facilitatorResult.reason);
    process.exit(1);
  }

  const { ws: facilitator } = facilitatorResult.value;
  const participants = connected.map((r) => r.value.ws);

  // count messages received across all participants
  let totalReceived = 0;
  const receiveLatencies = [];
  let sentAt = 0;

  participants.forEach((ws) => {
    ws.on('message', (data) => {
      if (sentAt) receiveLatencies.push(performance.now() - sentAt);
      totalReceived++;
    });
  });

  // facilitator sends ROUNDS broadcasts
  console.log(`\nSending ${ROUNDS} broadcast rounds (${ROUND_MS}ms apart)...`);
  const broadcastStart = performance.now();

  for (let round = 0; round < ROUNDS; round++) {
    sentAt = performance.now();
    facilitator.send(JSON.stringify({
      type: 'BID',
      data: { valueId: `v${round % 10}`, amount: 100 + round * 10, round },
    }));
    await new Promise((r) => setTimeout(r, ROUND_MS));
  }

  // wait a moment for in-flight messages
  await new Promise((r) => setTimeout(r, 1000));
  const broadcastWallMs = performance.now() - broadcastStart;

  // close all connections
  facilitator.close();
  participants.forEach((ws) => ws.close());

  const expectedMessages = connected.length * ROUNDS;
  const deliveryRate = ((totalReceived / expectedMessages) * 100).toFixed(1);

  console.log('\n── Results ─────────────────────────────');
  console.log(`Broadcast wall time:   ${(broadcastWallMs / 1000).toFixed(2)}s`);
  console.log(`Expected messages:     ${expectedMessages}`);
  console.log(`Received messages:     ${totalReceived}  (${deliveryRate}% delivery)`);
  if (receiveLatencies.length) {
    const sorted = receiveLatencies.sort((a, b) => a - b);
    console.log(`Receive latency       p50=${pct(sorted, 50)}  p95=${pct(sorted, 95)}  p99=${pct(sorted, 99)}  max=${sorted[sorted.length - 1].toFixed(0)}ms`);
  }
  console.log('─────────────────────────────────────────\n');
}

main().catch(console.error);
