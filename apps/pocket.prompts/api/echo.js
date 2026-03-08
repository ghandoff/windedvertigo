/**
 * Diagnostic endpoint — detects double invocation by writing to Notion.
 *
 * Previous echo tests were INCONCLUSIVE: if Vercel routes one request
 * to two separate function instances, each has its own call_count=1,
 * and the Shortcut only receives one response. We can't detect double
 * invocation from the response alone.
 *
 * FIX: Write an entry to the Voice Log Notion database for each
 * invocation, with a unique request_id. After each test, count
 * how many "echo_test" entries appeared:
 *   - 1 entry → single invocation (no bug)
 *   - 2 entries → double invocation (bug confirmed!)
 *
 * TEST PLAN:
 *   1. Point Shortcut at /echo (rewrite path, matching /voice behavior)
 *   2. Speak anything
 *   3. Check Notion Voice Log for "echo_test" entries
 *   4. If 2 entries appear for one test → rewrite causes duplication
 *   5. Point Shortcut at /api/echo (direct path, no rewrite)
 *   6. Speak anything
 *   7. Check Notion Voice Log again
 *   8. If only 1 entry → confirms rewrite is the culprit
 */

import { log_voice_interaction } from '../lib/voice-log.js';

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
  console.log(`[echo] body: ${JSON.stringify(req.body)}`);
  console.log(`[echo] waiting ${delay}ms ...`);

  // simulate voice processing time
  await new Promise(r => setTimeout(r, delay));

  console.log(`[echo] --- responding to request ${my_count} after ${delay}ms ---`);

  const spoken_response = `echo received. request number ${my_count}. path was ${req.url}. id is ${request_id}.`;

  // Log to Notion Voice Log — the SAME mechanism voice.js uses.
  // This is the only reliable way to detect double invocation,
  // because each function instance has isolated memory.
  // We AWAIT this (unlike voice.js fire-and-forget) so the log
  // is guaranteed to complete before we respond.
  try {
    await log_voice_interaction({
      utterance: `[echo-test] ${req.body?.text || '(no text)'}`,
      intent_result: {
        intent: 'echo_test',
        confidence: 1.0,
        content: `request_id=${request_id} call_count=${my_count} delay=${delay}ms path=${req.url}`
      },
      action_taken: 'echo_test',
      spoken_response,
      user_id: req.body?.user_id || 'echo-diag',
      duration_ms: delay
    });
    console.log(`[echo] logged to Notion Voice Log`);
  } catch (err) {
    console.error(`[echo] Notion log failed: ${err.message}`);
  }

  return res.status(200).json({
    spoken_response,
    request_id,
    call_count: my_count,
    delay_ms: delay,
    path: req.url,
    timestamp: new Date().toISOString()
  });
}
