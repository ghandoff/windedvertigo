import { get_token } from '../lib/kv.js';

/**
 * GET /status?member=garrett
 *
 * Returns connection status + token type for a member.
 * Used by the Expo app to show "connected — messages as you" vs "as bot".
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const url = new URL(req.url, 'http://localhost');
  const member = url.searchParams.get('member');

  if (!member) {
    return res.status(400).json({ error: 'missing ?member= param' });
  }

  try {
    const [slack_token, slack_bot_token, notion_token] = await Promise.all([
      get_token(member, 'slack'),
      get_token(member, 'slack_bot'),
      get_token(member, 'notion')
    ]);

    // determine token type:
    // - if slack_bot_token exists, user went through the new flow → user+bot dual tokens
    // - if only slack_token exists, it's the old bot-only flow
    let slack_token_type = null;
    if (slack_token && slack_bot_token) {
      slack_token_type = 'user';
    } else if (slack_token) {
      slack_token_type = 'bot';
    }

    return res.status(200).json({
      member,
      slack: !!slack_token,
      slack_token_type,
      notion: !!notion_token
    });
  } catch (err) {
    console.error(`[status] failed for ${member}: ${err.message}`);
    return res.status(500).json({ error: 'failed to check status' });
  }
}
