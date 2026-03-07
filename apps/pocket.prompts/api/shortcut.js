/**
 * GET /api/shortcut
 *
 * serves the pocket.prompts .shortcut file with correct headers
 * so ios safari auto-opens it in the shortcuts app for install.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  try {
    // read the shortcut file from the public directory
    // in vercel serverless, __dirname points to the api/ folder
    // and the public dir is one level up as the output directory
    const shortcutPath = join(process.cwd(), 'public', 'shortcuts', 'pocket-prompts.shortcut');
    const fileBuffer = readFileSync(shortcutPath);

    // set headers that ios safari recognizes for shortcut import
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="pocket-prompts.shortcut"');
    res.setHeader('Content-Length', fileBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    return res.status(200).send(fileBuffer);
  } catch (err) {
    console.error('[shortcut] serve error:', err.message);
    return res.status(500).json({ error: 'failed to serve shortcut file' });
  }
}
