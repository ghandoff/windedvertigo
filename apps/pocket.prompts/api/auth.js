import { createRequire } from 'module';
import { set_token } from '../lib/kv.js';

const require = createRequire(import.meta.url);
const members = require('../config/members.json');
const valid_members = new Set(Object.keys(members));

// derive base url from redirect URIs in env
function get_base_url() {
  const slack_redirect = process.env.SLACK_OAUTH_REDIRECT_URI;
  if (slack_redirect) {
    return new URL(slack_redirect).origin;
  }
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const url = new URL(req.url, get_base_url());
  const path = url.pathname;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const setup_secret = process.env.SETUP_SECRET;

  // determine provider from path
  let provider = null;
  if (path.includes('/notion')) provider = 'notion';
  else if (path.includes('/slack')) provider = 'slack';

  if (!provider) {
    return res.redirect(302, `/setup?secret=${setup_secret}&error=unknown_provider`);
  }

  // handle errors from oauth provider
  if (error) {
    console.error(`[auth] ${provider} oauth error: ${error}`);
    return res.redirect(302, `/setup?secret=${setup_secret}&error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    console.error(`[auth] missing code or state for ${provider}`);
    return res.redirect(302, `/setup?secret=${setup_secret}&error=missing_params`);
  }

  // validate member name
  const member_name = state.toLowerCase().trim();
  if (!valid_members.has(member_name)) {
    console.error(`[auth] invalid member in state: ${state}`);
    return res.redirect(302, `/setup?secret=${setup_secret}&error=invalid_member`);
  }

  try {
    let access_token;

    if (provider === 'notion') {
      access_token = await exchange_notion_code(code);
    } else {
      access_token = await exchange_slack_code(code);
    }

    // store in kv
    const result = await set_token(member_name, provider, access_token);
    if (!result.success) {
      console.error(`[auth] kv store failed: ${result.error}`);
      return res.redirect(302, `/setup?secret=${setup_secret}&error=storage_failed`);
    }

    console.log(`[auth] ${member_name} connected ${provider}`);
    return res.redirect(302, `/setup?secret=${setup_secret}&connected=${provider}&member=${member_name}`);
  } catch (err) {
    console.error(`[auth] token exchange failed for ${provider}: ${err.message}`);
    return res.redirect(302, `/setup?secret=${setup_secret}&error=${encodeURIComponent(err.message)}`);
  }
}

async function exchange_notion_code(code) {
  const client_id = process.env.NOTION_OAUTH_CLIENT_ID;
  const client_secret = process.env.NOTION_OAUTH_CLIENT_SECRET;
  const redirect_uri = process.env.NOTION_OAUTH_REDIRECT_URI;

  const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`notion token exchange failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function exchange_slack_code(code) {
  const client_id = process.env.SLACK_OAUTH_CLIENT_ID;
  const client_secret = process.env.SLACK_OAUTH_CLIENT_SECRET;
  const redirect_uri = process.env.SLACK_OAUTH_REDIRECT_URI;

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id,
      client_secret,
      code,
      redirect_uri
    })
  });

  if (!response.ok) {
    throw new Error(`slack token exchange failed (${response.status})`);
  }

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`slack oauth error: ${data.error}`);
  }

  return data.access_token;
}
