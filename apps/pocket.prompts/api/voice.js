import { detect_intent } from '../lib/intent.js';
import { create_capture } from '../lib/notion.js';
import { create_task } from '../lib/notion-tasks.js';
import { resolve_member, get_slack_user_id } from '../lib/users.js';
import { get_recent_messages, send_message, find_dm_channel } from '../lib/slack.js';
import { log_voice_interaction } from '../lib/voice-log.js';
import { get_token } from '../lib/kv.js';
import * as tts from '../lib/tts.js';

/**
 * Send a JSON response AND fire-and-forget log the interaction.
 * The log never blocks or delays the spoken response.
 */
function respond(res, status, body, ctx) {
  const duration_ms = Date.now() - ctx.start_time;

  // fire-and-forget: log but don't await
  log_voice_interaction({
    utterance: ctx.utterance,
    intent_result: ctx.intent_result,
    action_taken: body.action_taken,
    spoken_response: body.spoken_response,
    entry_url: body.entry_url,
    user_id: ctx.user_id,
    error: body.error,
    duration_ms,
    request_id: ctx.request_id,
    timestamp: new Date().toISOString(),
    platform: ctx.platform
  }).catch(() => {}); // swallow logging errors

  return res.status(status).json(body);
}

export default async function handler(req, res) {
  const start_time = Date.now();

  // handle cors preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { text, user_id } = req.body || {};
  // capture vercel request ID + a unique invocation ID for dedup diagnosis
  const vercel_id = req.headers['x-vercel-id'] || 'no-vercel-id';
  const invocation_id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const request_id = `v:${vercel_id} i:${invocation_id}`;

  // resolve per-user tokens (falls back to shared tokens if not connected)
  // slack_token = user token (xoxp-) for sending as-user
  // slack_bot_token = bot token (xoxb-) for reading channels/messages
  const [notion_token, slack_token, slack_bot_token] = await Promise.all([
    get_token(user_id, 'notion'),
    get_token(user_id, 'slack'),
    get_token(user_id, 'slack_bot')
  ]);
  // detect platform from user-agent (ios shortcut vs android pwa vs web)
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const platform = ua.includes('darwin') || ua.includes('cfnetwork') ? 'ios_shortcut'
    : ua.includes('android') ? 'android_pwa'
    : ua.includes('mozilla') || ua.includes('chrome') ? 'web'
    : 'unknown';

  const ctx = { utterance: text, user_id, start_time, intent_result: null, request_id, notion_token, slack_token, slack_bot_token, platform };

  if (!text) {
    return respond(res, 400, {
      spoken_response: "i didn't catch anything — try speaking again.",
      action_taken: 'none'
    }, ctx);
  }

  console.log(`[voice] received from ${user_id || 'unknown'}: "${text}"`);

  // step 0: check for exit words (handled server-side since iOS Shortcuts
  // can't reliably use If/Contains actions after signing)
  const exit_words = ['stop', 'never mind', 'nevermind', "that's all", 'thats all', 'goodbye', 'bye'];
  const normalized = text.toLowerCase().trim();
  if (exit_words.some(w => normalized === w || normalized === `${w}.`)) {
    console.log(`[voice] exit word detected: "${text}"`);
    return respond(res, 200, {
      spoken_response: tts.goodbye(),
      action_taken: 'exit',
      exit: true
    }, ctx);
  }

  // step 1: detect intent
  const intent = await detect_intent(text);
  ctx.intent_result = intent;
  console.log(`[voice] intent: ${intent.intent} (confidence: ${intent.confidence})`);

  // step 2: if low confidence, ask for clarification
  if (intent.intent === 'unknown' || intent.confidence < 0.7) {
    return respond(res, 200, {
      spoken_response: tts.clarifying(intent.clarifying_question),
      action_taken: 'clarification_needed',
      intent_result: intent
    }, ctx);
  }

  // step 3: route by intent
  try {
    switch (intent.intent) {
      case 'notion_note':
        return await handle_note(intent, ctx, res);

      case 'notion_idea':
        return await handle_idea(intent, ctx, res);

      case 'notion_task':
        return await handle_task(intent, ctx, res);

      case 'slack_check':
        return await handle_slack_check(intent, ctx, res);

      case 'slack_message':
        return await handle_slack_message(intent, ctx, res);

      case 'slack_reply':
        return await handle_slack_reply(intent, ctx, res);

      case 'code_conversation':
        return await handle_code_conversation(intent, ctx, res);

      case 'build_approval':
        return await handle_build_approval(intent, ctx, res);

      default:
        return respond(res, 200, {
          spoken_response: tts.clarifying("i recognized something but don't know how to handle it yet — could you rephrase?"),
          action_taken: 'unhandled_intent',
          intent_result: intent
        }, ctx);
    }
  } catch (err) {
    console.error(`[voice] routing error: ${err.message}`);
    return respond(res, 500, {
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    }, ctx);
  }
}

// --- intent handlers ---

async function handle_note(intent, ctx, res) {
  const result = await create_capture({
    type: 'note',
    content: intent.content,
    priority: intent.priority || 'medium',
    token: ctx.notion_token
  });

  if (!result.success) {
    return respond(res, 500, {
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: result.error
    }, ctx);
  }

  return respond(res, 200, {
    spoken_response: tts.note_captured(intent.priority || 'medium'),
    action_taken: 'notion_note',
    entry_url: result.url
  }, ctx);
}

async function handle_idea(intent, ctx, res) {
  const result = await create_capture({
    type: 'idea',
    content: intent.content,
    priority: intent.priority || 'medium',
    token: ctx.notion_token
  });

  if (!result.success) {
    return respond(res, 500, {
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: result.error
    }, ctx);
  }

  return respond(res, 200, {
    spoken_response: tts.idea_captured(intent.priority || 'medium'),
    action_taken: 'notion_idea',
    entry_url: result.url
  }, ctx);
}

async function handle_task(intent, ctx, res) {
  const assignee = resolve_member(intent.assignee);
  const assignee_name = assignee?.name || intent.assignee || 'unassigned';

  const result = await create_task({
    content: intent.content,
    priority: intent.priority || 'medium',
    assignee_notion_id: assignee?.notion_user_id,
    due_date: intent.due_date,
    task_type: intent.task_type,
    token: ctx.notion_token
  });

  if (!result.success) {
    return respond(res, 500, {
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: result.error
    }, ctx);
  }

  return respond(res, 200, {
    spoken_response: tts.task_assigned(assignee_name, intent.due_date),
    action_taken: 'notion_task',
    entry_url: result.url
  }, ctx);
}

// --- slack handlers ---

async function handle_slack_check(intent, ctx, res) {
  try {
    // prefer bot token for reads — user tokens with only chat:write can't list channels
    const token = ctx.slack_bot_token || ctx.slack_token || (process.env.SLACK_BOT_TOKEN || '').trim();
    const slack_user_id = get_slack_user_id(ctx.user_id);

    const { messages, summary } = await get_recent_messages({
      token,
      user_id: slack_user_id,
      limit: 10
    });

    if (messages.length === 0) {
      return respond(res, 200, {
        spoken_response: tts.slack_no_messages(),
        action_taken: 'slack_check',
        message_count: 0
      }, ctx);
    }

    // summary already includes CTA from the claude summarizer
    return respond(res, 200, {
      spoken_response: summary,
      action_taken: 'slack_check',
      message_count: messages.length,
      messages // include raw messages in json for debugging / shortcut use
    }, ctx);
  } catch (err) {
    console.error(`[voice] slack check failed: ${err.message}`);
    return respond(res, 500, {
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    }, ctx);
  }
}

async function handle_slack_message(intent, ctx, res) {
  try {
    // bot token for channel ops (needs im:write), user token for sending (as-user)
    const bot_token = ctx.slack_bot_token || (process.env.SLACK_BOT_TOKEN || '').trim();
    const send_token = ctx.slack_token || bot_token;
    const recipient = resolve_member(intent.slack_recipient);

    console.log(`[voice] slack_message — recipient: "${intent.slack_recipient}", resolved: ${recipient?.name || 'NONE'}, slack_id: ${recipient?.slack_user_id || 'NONE'}, bot_token: ${bot_token ? 'present' : 'MISSING'}, send_token: ${send_token ? 'present' : 'MISSING'}`);

    if (!recipient?.slack_user_id) {
      return respond(res, 200, {
        spoken_response: `i don't have a slack id for ${intent.slack_recipient || 'that person'} yet. want me to note this instead?`,
        action_taken: 'slack_message_failed',
        intent_result: intent
      }, ctx);
    }

    // open or find the dm channel — uses bot token (needs im:write scope)
    const channel_id = await find_dm_channel({ token: bot_token, user_id: recipient.slack_user_id });

    if (!channel_id) {
      return respond(res, 200, {
        spoken_response: `couldn't open a dm with ${recipient.name}. want me to try again or note this instead?`,
        action_taken: 'slack_message_failed',
        intent_result: intent
      }, ctx);
    }

    // send with user token so message appears as-user (needs chat:write scope)
    const result = await send_message({
      token: send_token,
      channel_id,
      text: intent.content
    });

    if (!result.success) {
      return respond(res, 500, {
        spoken_response: tts.error_fallback(),
        action_taken: 'error',
        error: result.error
      }, ctx);
    }

    return respond(res, 200, {
      spoken_response: tts.slack_sent(recipient.name),
      action_taken: 'slack_message',
      channel_id
    }, ctx);
  } catch (err) {
    console.error(`[voice] slack message failed: ${err.message}`);
    return respond(res, 500, {
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    }, ctx);
  }
}

async function handle_slack_reply(intent, ctx, res) {
  try {
    // bot token for channel ops (needs im:write), user token for sending (as-user)
    const bot_token = ctx.slack_bot_token || (process.env.SLACK_BOT_TOKEN || '').trim();
    const send_token = ctx.slack_token || bot_token;
    const reply_to = resolve_member(intent.reply_to);

    if (!reply_to?.slack_user_id) {
      return respond(res, 200, {
        spoken_response: `who should i reply to? say something like "reply to lamis: sounds good."`,
        action_taken: 'slack_reply_needs_target',
        intent_result: intent
      }, ctx);
    }

    const channel_id = await find_dm_channel({ token: bot_token, user_id: reply_to.slack_user_id });

    if (!channel_id) {
      return respond(res, 200, {
        spoken_response: `couldn't find the conversation with ${reply_to.name}. want to try again?`,
        action_taken: 'slack_reply_failed',
        intent_result: intent
      }, ctx);
    }

    const result = await send_message({
      token: send_token,
      channel_id,
      text: intent.content
    });

    if (!result.success) {
      return respond(res, 500, {
        spoken_response: tts.error_fallback(),
        action_taken: 'error',
        error: result.error
      }, ctx);
    }

    return respond(res, 200, {
      spoken_response: tts.slack_reply_sent(reply_to.name),
      action_taken: 'slack_reply',
      channel_id
    }, ctx);
  } catch (err) {
    console.error(`[voice] slack reply failed: ${err.message}`);
    return respond(res, 500, {
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    }, ctx);
  }
}

// --- code & build handlers ---

async function handle_code_conversation(intent, ctx, res) {
  // 1. send a slack dm to the user with the code request (so they have it at their desk)
  // 2. the voice log captures this with intent=code_conversation for scheduled task pickup
  const content = intent.content || ctx.utterance;
  console.log(`[voice] code conversation: "${content.substring(0, 80)}..."`);

  try {
    // bot token for channel ops (needs im:write), user token for sending (as-user)
    const bot_token = ctx.slack_bot_token || (process.env.SLACK_BOT_TOKEN || '').trim();
    const send_token = ctx.slack_token || bot_token;
    const slack_user_id = get_slack_user_id(ctx.user_id);

    if (slack_user_id && bot_token) {
      const channel_id = await find_dm_channel({ token: bot_token, user_id: slack_user_id });
      if (channel_id) {
        await send_message({
          token: send_token,
          channel_id,
          text: `🤖 *Code request* from pocket.prompts:\n> ${content}\n\n_Paste this into Claude Code when you're at your desk._`
        });
        console.log(`[voice] code conversation dm sent to ${ctx.user_id}`);
      }
    }
  } catch (err) {
    // dm is a nice-to-have — don't fail the whole request
    console.error(`[voice] code conversation dm failed: ${err.message}`);
  }

  return respond(res, 200, {
    spoken_response: tts.code_conversation_started(),
    action_taken: 'code_conversation',
    intent_result: intent
  }, ctx);
}

async function handle_build_approval(intent, ctx, res) {
  const webhook_url = (process.env.BUILD_WEBHOOK_URL || '').trim();

  if (!webhook_url) {
    console.log(`[voice] build approval — no BUILD_WEBHOOK_URL configured`);
    return respond(res, 200, {
      spoken_response: "build approvals aren't configured yet — the deploy hook needs to be set up in vercel. anything else?",
      action_taken: 'build_not_configured',
      intent_result: intent
    }, ctx);
  }

  try {
    console.log(`[voice] firing build webhook`);
    const result = await fetch(webhook_url, { method: 'POST' });

    if (!result.ok) {
      console.error(`[voice] build webhook failed: ${result.status}`);
      return respond(res, 200, {
        spoken_response: "the build webhook returned an error — want me to try again?",
        action_taken: 'build_failed',
        error: `webhook returned ${result.status}`
      }, ctx);
    }

    return respond(res, 200, {
      spoken_response: tts.build_approval_sent(),
      action_taken: 'build_approval'
    }, ctx);
  } catch (err) {
    console.error(`[voice] build webhook error: ${err.message}`);
    return respond(res, 500, {
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    }, ctx);
  }
}
