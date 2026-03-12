import { WebClient } from '@slack/web-api';

function get_client(token) {
  return new WebClient(token || (process.env.SLACK_BOT_TOKEN || '').trim());
}

export async function send_message({ token, channel_id, text }) {
  try {
    const slack = get_client(token);
    console.log(`[slack] posting to ${channel_id} (${text?.length || 0} chars)`);

    const result = await slack.chat.postMessage({
      channel: channel_id,
      text
    });

    console.log(`[slack] sent ok — channel: ${channel_id}, ts: ${result.ts}`);
    return { success: true, ts: result.ts, channel: channel_id };
  } catch (err) {
    const api_error = err.data?.error || err.code || 'unknown';
    console.error(`[slack] send failed: ${err.message} (api: ${api_error})`);
    return { success: false, error: `${err.message} (${api_error})` };
  }
}

export async function find_dm_channel({ token, user_id }) {
  try {
    const slack = get_client(token);
    console.log(`[slack] opening DM with user ${user_id}`);
    const result = await slack.conversations.open({ users: user_id });
    const channel_id = result.channel?.id || null;
    console.log(`[slack] DM channel: ${channel_id || 'FAILED'}`);
    return channel_id;
  } catch (err) {
    const api_error = err.data?.error || err.code || 'unknown';
    console.error(`[slack] find_dm failed for ${user_id}: ${err.message} (api: ${api_error})`);
    return null;
  }
}
