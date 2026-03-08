import { send_message, find_dm_channel } from '../lib/slack.js';
import { get_slack_user_id } from '../lib/users.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  // simple shared-secret auth to prevent abuse
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.SLACK_DM_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { user, text, thread_ts } = req.body || {};
  if (!user || !text) {
    return res.status(400).json({ error: 'user and text required' });
  }

  const token = process.env.SLACK_BOT_TOKEN;
  const slack_user_id = get_slack_user_id(user);

  if (!slack_user_id) {
    return res.status(400).json({ error: `no slack_user_id for "${user}"` });
  }

  try {
    const channel_id = await find_dm_channel({ token, user_id: slack_user_id });
    if (!channel_id) {
      return res.status(500).json({ error: 'could not open dm channel' });
    }

    const result = await send_message({ token, channel_id, text, thread_ts });
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    return res.status(200).json({ success: true, ts: result.ts, channel_id });
  } catch (err) {
    console.error(`[slack-dm] error: ${err.message}`);
    return res.status(500).json({ error: err.message });
  }
}
