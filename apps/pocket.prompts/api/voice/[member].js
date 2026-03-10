import handler from '../voice.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const members = require('../../config/members.json');

/**
 * Per-member voice endpoint — /api/voice/:member
 *
 * iOS Shortcuts can't use Get Dictionary Value on HTTP responses after
 * code-signing (the action hangs). Instead, this endpoint returns PLAIN TEXT
 * containing just the spoken_response — the shortcut pipes it straight to
 * Speak Text with no dictionary extraction needed.
 *
 * Accepts raw text POST body (pipeline content via "File" body type) or
 * JSON body for compatibility with other clients.
 *
 * JSON clients can add ?format=json to get the full response object.
 */

export const config = {
  api: { bodyParser: false }
};

function read_body(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

export default async function member_handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const member = req.query.member;

  // validate member
  if (!members[member]) {
    return res.status(404).json({ error: `unknown member: ${member}` });
  }

  // read raw body (bypasses vercel's default body parser)
  const raw = await read_body(req);

  console.log(`[voice/${member}] content-type: ${req.headers['content-type'] || 'none'}`);
  console.log(`[voice/${member}] body length: ${raw.length}`);
  console.log(`[voice/${member}] body preview: "${raw.substring(0, 120)}"`);

  // parse text from body — try JSON first, then raw text
  let text = '';
  try {
    const parsed = JSON.parse(raw);
    text = parsed.text || '';
  } catch {
    // raw text body from iOS Shortcut (WFHTTPBodyType: File)
    text = raw.trim();
  }

  // synthesize JSON body and delegate to main voice handler
  req.method = 'POST';
  req.body = { text, user_id: member };

  // capture the response from voice.js instead of sending it directly
  const want_json = req.query.format === 'json';

  if (want_json) {
    // pass through the full JSON response for non-shortcut clients
    return handler(req, res);
  }

  // intercept the response — capture what voice.js sends
  const mock_res = {
    _status: 200,
    _json: null,
    _ended: false,
    status(code) { this._status = code; return this; },
    setHeader() { return this; },
    json(data) {
      this._json = data;
      this._ended = true;
    },
    end() { this._ended = true; },
    getHeader() { return null; },
  };

  await handler(req, mock_res);

  // extract just the spoken_response and return as plain text
  const spoken = mock_res._json?.spoken_response || 'something went wrong. try again.';

  console.log(`[voice/${member}] responding plain text: "${spoken.substring(0, 80)}"`);

  res.status(mock_res._status);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.end(spoken);
}
