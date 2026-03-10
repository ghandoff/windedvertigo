import handler from '../voice.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const members = require('../../config/members.json');

/**
 * Per-member voice endpoint — /api/voice/:member
 *
 * iOS Shortcuts can't reliably send JSON bodies after code-signing strips
 * complex parameters. This endpoint extracts the member from the URL path
 * and accepts raw text as the POST body (via Shortcuts' "File" body type,
 * which sends the pipeline content as-is).
 *
 * Falls back to JSON body parsing for compatibility with other clients.
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

  return handler(req, res);
}
