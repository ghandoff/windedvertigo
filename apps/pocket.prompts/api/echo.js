/**
 * /api/echo — diagnostic endpoint for iOS Shortcut testing
 *
 * returns a fixed response in two formats:
 *   GET  → plain text (for pipeline test: Get Contents → Speak Text)
 *   POST → JSON with spoken_response (for full pipeline test)
 *
 * also logs whatever it receives so we can check vercel logs.
 */

export default function handler(req, res) {
  console.log(`[echo] method: ${req.method}`);
  console.log(`[echo] content-type: ${req.headers['content-type'] || 'none'}`);
  console.log(`[echo] body: ${JSON.stringify(req.body)}`);
  console.log(`[echo] query: ${JSON.stringify(req.query)}`);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    // plain text response — simplest possible test
    res.setHeader('Content-Type', 'text/plain');
    return res.end('echo test successful. the pipeline works.');
  }

  // JSON response — tests dictionary extraction
  return res.json({
    spoken_response: 'echo test successful. the post pipeline works.',
    action_taken: 'echo_test',
    timestamp: new Date().toISOString()
  });
}
