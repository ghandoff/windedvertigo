/**
 * Diagnostic endpoint — simulates the voice endpoint's processing time
 * to reproduce the duplicate-request issue.
 *
 * ?delay=4000 (default 4000ms) controls how long the endpoint waits
 * before responding, matching voice.js's ~3-4 second intent detection.
 *
 * Point the iOS Shortcut at /api/echo temporarily.
 * If the Shortcut speaks "request 1" → one invocation (not a timing issue).
 * If it speaks "request 2" → something is retrying during the delay.
 */

let call_count = 0;

export default async function handler(req, res) {
  call_count++;
  const my_count = call_count;
  const request_id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const delay = parseInt(req.query?.delay || req.body?.delay || '4000', 10);

  console.log(`[echo] --- request ${my_count} (id: ${request_id}) --- waiting ${delay}ms`);
  console.log(`[echo] method: ${req.method}`);
  console.log(`[echo] x-vercel-id: ${req.headers['x-vercel-id']}`);
  console.log(`[echo] x-forwarded-for: ${req.headers['x-forwarded-for']}`);
  console.log(`[echo] body: ${JSON.stringify(req.body)}`);

  // simulate voice processing time
  await new Promise(r => setTimeout(r, delay));

  console.log(`[echo] --- responding to request ${my_count} after ${delay}ms ---`);

  return res.status(200).json({
    spoken_response: `echo received. request number ${my_count}.`,
    request_id,
    call_count: my_count,
    delay_ms: delay,
    timestamp: new Date().toISOString()
  });
}
