/**
 * Diagnostic endpoint — simulates the voice endpoint's processing time
 * to reproduce the duplicate-request issue.
 *
 * ?delay=4000 (default 4000ms) controls how long the endpoint waits
 * before responding, matching voice.js's ~3-4 second intent detection.
 *
 * TEST PLAN:
 *   1. /api/echo  — direct path, no rewrite       ✅ fires once
 *   2. /api/echo  — direct path, 4s delay          ✅ fires once
 *   3. /echo      — through rewrite, 4s delay      ← TEST THIS NEXT
 *
 * Point the iOS Shortcut at /echo (not /api/echo) to test
 * whether the Vercel rewrite causes duplication.
 */

let call_count = 0;

export default async function handler(req, res) {
  call_count++;
  const my_count = call_count;
  const request_id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const delay = parseInt(req.query?.delay || req.body?.delay || '4000', 10);

  console.log(`[echo] ======= request ${my_count} (id: ${request_id}) =======`);
  console.log(`[echo] method: ${req.method}`);
  console.log(`[echo] url: ${req.url}`);
  console.log(`[echo] x-vercel-id: ${req.headers['x-vercel-id']}`);
  console.log(`[echo] x-forwarded-for: ${req.headers['x-forwarded-for']}`);
  console.log(`[echo] x-matched-path: ${req.headers['x-matched-path']}`);
  console.log(`[echo] x-vercel-proxy-signature: ${req.headers['x-vercel-proxy-signature'] ? 'present' : 'absent'}`);
  console.log(`[echo] body: ${JSON.stringify(req.body)}`);
  console.log(`[echo] waiting ${delay}ms ...`);

  // simulate voice processing time
  await new Promise(r => setTimeout(r, delay));

  console.log(`[echo] --- responding to request ${my_count} after ${delay}ms ---`);

  return res.status(200).json({
    spoken_response: `echo received. request number ${my_count}. path was ${req.url}.`,
    request_id,
    call_count: my_count,
    delay_ms: delay,
    path: req.url,
    timestamp: new Date().toISOString()
  });
}
