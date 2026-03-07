import { WebClient } from '@slack/web-api';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

function get_client(token) {
  return new WebClient(token || process.env.SLACK_BOT_TOKEN);
}

// fetch recent dms and channel messages for the user
export async function get_recent_messages({ token, user_id, limit = 10 }) {
  try {
    const slack = get_client(token);

    // get recent conversations the user is part of
    const convos = await slack.conversations.list({
      types: 'im,mpim,public_channel,private_channel',
      limit: 20
    });

    if (!convos.channels || convos.channels.length === 0) {
      return { messages: [], summary: null };
    }

    const all_messages = [];

    // pull recent unread or recent messages from top conversations
    for (const channel of convos.channels.slice(0, 8)) {
      try {
        const history = await slack.conversations.history({
          channel: channel.id,
          limit: 5
        });

        if (history.messages) {
          for (const msg of history.messages) {
            // skip bot messages and the user's own messages
            if (msg.bot_id || msg.user === user_id) continue;

            all_messages.push({
              channel_name: channel.name || channel.user || 'dm',
              channel_id: channel.id,
              sender: msg.user,
              text: msg.text,
              ts: msg.ts,
              thread_ts: msg.thread_ts
            });
          }
        }
      } catch (err) {
        // skip channels we can't read
        console.log(`[slack] skipping channel ${channel.id}: ${err.message}`);
      }
    }

    // sort by timestamp, most recent first
    all_messages.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));
    const recent = all_messages.slice(0, limit);

    if (recent.length === 0) {
      return { messages: [], summary: null };
    }

    // resolve user display names
    const resolved = await resolve_senders(slack, recent);

    // summarize with claude
    const summary = await summarize_messages(resolved);

    return { messages: resolved, summary };
  } catch (err) {
    console.error(`[slack] get_recent_messages failed: ${err.message}`);
    throw err;
  }
}

// send a dm or channel message
export async function send_message({ token, channel_id, text, thread_ts }) {
  try {
    const slack = get_client(token);

    const result = await slack.chat.postMessage({
      channel: channel_id,
      text,
      thread_ts: thread_ts || undefined
    });

    console.log(`[slack] message sent to ${channel_id}`);
    return { success: true, ts: result.ts, channel: channel_id };
  } catch (err) {
    console.error(`[slack] send failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// find a dm channel with a specific user
export async function find_dm_channel({ token, user_id }) {
  try {
    const slack = get_client(token);
    const result = await slack.conversations.open({ users: user_id });
    return result.channel?.id || null;
  } catch (err) {
    console.error(`[slack] find_dm failed: ${err.message}`);
    return null;
  }
}

// --- internal helpers ---

async function resolve_senders(slack, messages) {
  const user_cache = {};

  for (const msg of messages) {
    if (!msg.sender) continue;
    if (user_cache[msg.sender]) {
      msg.sender_name = user_cache[msg.sender];
      continue;
    }

    try {
      const info = await slack.users.info({ user: msg.sender });
      const name = info.user?.real_name || info.user?.name || msg.sender;
      user_cache[msg.sender] = name;
      msg.sender_name = name;
    } catch {
      msg.sender_name = msg.sender;
    }
  }

  return messages;
}

async function summarize_messages(messages) {
  if (messages.length === 0) return null;

  const formatted = messages.map((m, i) =>
    `${i + 1}. ${m.sender_name} (in ${m.channel_name}): "${m.text}"`
  ).join('\n');

  try {
    console.log(`[slack] summarizing ${messages.length} messages via claude`);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      system: `you are a voice assistant summarizing slack messages for someone listening through airpods. they can't see a screen.

rules:
- summarize each message in one short sentence. use the sender's first name.
- group related messages if they're about the same topic.
- after all summaries, end with a clear call-to-action telling the user what they can say next.
- the CTA should offer 2-3 specific options based on what they just heard.
- keep the whole response under 30 seconds of spoken audio (roughly 75 words).
- never read urls, channel ids, or timestamps aloud.
- sound like a colleague giving a quick briefing, not a system readout.

example output:
"you've got 3 new messages. lamis asked about the rubric timeline in general. maria shared a link to the new assessment draft. and jamie wants to know if you're free for a playdate thursday. want me to reply to any of them, or should i note something for later?"`,
      messages: [{
        role: 'user',
        content: `summarize these slack messages for voice:\n\n${formatted}`
      }]
    });

    return response.content[0].text.trim();
  } catch (err) {
    console.error(`[slack] summarization failed: ${err.message}`);
    // fallback: simple count
    return `you have ${messages.length} recent messages but i couldn't summarize them right now. want me to try again?`;
  }
}
