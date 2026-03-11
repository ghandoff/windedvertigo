import { createRequire } from 'module';
import { get_connection_status } from '../lib/kv.js';

const require = createRequire(import.meta.url);
const members = require('../config/members.json');

function get_base_url() {
  const slack_redirect = process.env.SLACK_OAUTH_REDIRECT_URI;
  if (slack_redirect) {
    return new URL(slack_redirect).origin;
  }
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const url = new URL(req.url, get_base_url());
  const secret = url.searchParams.get('secret');

  if (!process.env.SETUP_SECRET || secret !== process.env.SETUP_SECRET) {
    return res.status(401).send('unauthorized — include ?secret= in the url');
  }

  const connected = url.searchParams.get('connected');
  const connected_member = url.searchParams.get('member');
  const error = url.searchParams.get('error');
  const base_url = get_base_url();

  // resolve connection status for all members
  const member_names = Object.keys(members);
  const statuses = await Promise.all(
    member_names.map(async (name) => ({
      name,
      email: members[name].email,
      ...(await get_connection_status(name))
    }))
  );

  const slack_client_id = process.env.SLACK_OAUTH_CLIENT_ID;
  const slack_team_id = process.env.SLACK_TEAM_ID;
  const slack_redirect = process.env.SLACK_OAUTH_REDIRECT_URI || `${base_url}/auth/slack/callback`;
  const slack_scopes = 'channels:history,channels:read,chat:write,im:history,im:read,im:write,users:read';
  const slack_user_scopes = 'chat:write';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>pocket.prompts — setup</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      background: #0a0a0a;
      color: #fafafa;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1.5rem;
    }
    .logo { font-size: 2.5rem; font-weight: 700; letter-spacing: -0.03em; margin-bottom: 0.5rem; }
    .logo span { color: #5b8def; }
    .tagline { color: #888; font-size: 1rem; margin-bottom: 2rem; text-align: center; max-width: 340px; line-height: 1.5; }

    .banner {
      width: 100%; max-width: 420px;
      padding: 0.9rem 1.2rem;
      border-radius: 12px;
      margin-bottom: 1.5rem;
      font-size: 0.9rem;
      text-align: center;
    }
    .banner.success { background: #1a2a1a; border: 1px solid #2a442a; color: #88ff88; }
    .banner.error { background: #2a1a1a; border: 1px solid #442222; color: #ff8888; }

    .member-card {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      width: 100%;
      max-width: 420px;
      margin-bottom: 0.75rem;
    }
    .member-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .member-name { font-size: 1.1rem; font-weight: 600; }
    .member-email { font-size: 0.75rem; color: #666; }

    .connections {
      display: flex;
      gap: 0.6rem;
    }
    .conn-btn {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      padding: 0.6rem 0.8rem;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 600;
      text-decoration: none;
      transition: transform 0.15s ease, opacity 0.15s ease;
    }
    .conn-btn:active { transform: scale(0.97); opacity: 0.9; }

    .conn-btn.connect {
      background: linear-gradient(135deg, #5b8def, #3d6dd8);
      color: white;
      border: none;
    }
    .conn-btn.connected {
      background: #1a2a1a;
      border: 1px solid #2a442a;
      color: #88ff88;
      pointer-events: none;
    }
    .conn-btn.reconnect {
      background: transparent;
      border: 1px solid #333;
      color: #888;
      font-size: 0.75rem;
    }

    .conn-label { font-size: 0.65rem; color: #555; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.4rem; }

    .conn-group { flex: 1; display: flex; flex-direction: column; }

    .not-configured {
      background: #2a2a1a;
      border: 1px solid #44442a;
      border-radius: 12px;
      padding: 1rem;
      margin-bottom: 1.5rem;
      width: 100%;
      max-width: 420px;
      text-align: center;
      font-size: 0.85rem;
      color: #ccaa44;
    }

    .footer { margin-top: 2rem; color: #444; font-size: 0.8rem; }
    .footer a { color: #5b8def; text-decoration: none; }
  </style>
</head>
<body>
  <div class="logo">pocket<span>.</span>prompts</div>
  <p class="tagline">connect your accounts to use voice commands with your own tokens.</p>

  ${connected ? `<div class="banner success">${esc(connected_member) || 'member'} connected ${esc(connected)} successfully.</div>` : ''}
  ${error ? `<div class="banner error">error: ${esc(error)}</div>` : ''}
  ${!slack_client_id ? '<div class="not-configured">slack oauth not configured yet — set SLACK_OAUTH_CLIENT_ID in vercel env vars.</div>' : ''}

  ${statuses.map(m => {
    const slack_url = slack_client_id
      ? `https://slack.com/oauth/v2/authorize?client_id=${slack_client_id}&scope=${slack_scopes}&user_scope=${slack_user_scopes}&redirect_uri=${encodeURIComponent(slack_redirect)}&state=slack:${m.name}${slack_team_id ? '&team=' + slack_team_id : ''}`
      : '#';

    return `
  <div class="member-card">
    <div class="member-header">
      <div>
        <div class="member-name">${esc(m.name)}</div>
        <div class="member-email">${esc(m.email)}</div>
      </div>
    </div>
    <div class="connections">
      <div class="conn-group">
        <div class="conn-label">notion</div>
        <a class="conn-btn connected">&#10003; shared token</a>
      </div>
      <div class="conn-group">
        <div class="conn-label">slack</div>
        ${m.slack
          ? `<a class="conn-btn connected">&#10003; connected</a>`
          : `<a class="conn-btn connect" href="${slack_url}">connect slack</a>`
        }
      </div>
    </div>
  </div>`;
  }).join('\n')}

  <div class="footer">built by <a href="https://windedvertigo.com">winded.vertigo</a></div>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
}
