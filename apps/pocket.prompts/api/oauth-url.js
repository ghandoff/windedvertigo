/**
 * GET /oauth-url?member=garrett
 *
 * Returns the fully constructed Slack OAuth URL for a member.
 * Keeps client_id and scopes server-side — the Expo app just opens the URL.
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

  const client_id = process.env.SLACK_OAUTH_CLIENT_ID;
  if (!client_id) {
    return res.status(503).json({ error: 'slack oauth not configured' });
  }

  const redirect_uri = process.env.SLACK_OAUTH_REDIRECT_URI;
  const team_id = process.env.SLACK_TEAM_ID;
  const bot_scopes = 'channels:history,channels:read,chat:write,im:history,im:read,im:write,users:read';
  const user_scopes = 'chat:write';

  const params = new URLSearchParams({
    client_id,
    scope: bot_scopes,
    user_scope: user_scopes,
    redirect_uri,
    state: member
  });
  if (team_id) params.set('team', team_id);

  return res.status(200).json({
    url: `https://slack.com/oauth/v2/authorize?${params}`
  });
}
