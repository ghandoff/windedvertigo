/**
 * Diagnostic endpoint — logs every incoming request to help
 * track down why pocket.prompts processes voice commands twice.
 *
 * Point the iOS Shortcut at /api/echo temporarily to see if it fires once or twice.
 * Each request gets a unique request_id so duplicates are obvious.
 *
 * Returns a spoken_response so the Shortcut can Speak the result.
 */

let call_count = 0;

export default function handler(req, res) {
  call_count++;
  const request_id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const info = {
    request_id,
    call_count,
    method: req.method,
    timestamp: new Date().toISOString(),
    body: req.body,
    headers: {
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
      'x-real-ip': req.headers['x-real-ip'],
      'x-vercel-id': req.headers['x-vercel-id'],
      'x-vercel-proxy-signature': req.headers['x-vercel-proxy-signature'] ? '(present)' : '(absent)',
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length'],
    }
  };

  console.log(`[echo] --- request ${call_count} ---`);
  console.log(`[echo] ${JSON.stringify(info, null, 2)}`);

  return res.status(200).json({
    spoken_response: `echo received. request number ${call_count}, id ${request_id.slice(-6)}.`,
    ...info
  });
}
