import { detect_intent } from '../lib/intent.js';
import { create_capture } from '../lib/notion.js';
import { create_task } from '../lib/notion-tasks.js';
import { resolve_member, get_slack_user_id } from '../lib/users.js';
import { get_recent_messages, send_message, find_dm_channel } from '../lib/slack.js';
import { log_voice_interaction } from '../lib/voice-log.js';
import * as tts from '../lib/tts.js';

// --- dedup guard ---
// iOS Shortcuts sometimes double-fires the POST. We keep a short-lived
// in-memory cache keyed on utterance+user so the second hit within 60s
// returns the first response without re-processing.
const DEDUP_TTL_MS = 60_000;
const recent_requests = new Map(); // key → { response, timestamp }

function dedup_key(text, user_id) {
  return `${(user_id || '').toLowerCase()}::${text.toLowerCase().trim()}`;
}

function check_dedup(text, user_id) {
  const key = dedup_key(text, user_id);
  const cached = recent_requests.get(key);
  if (cached && Date.now() - cached.timestamp < DEDUP_TTL_MS) {
    console.log(`[voice] dedup hit — returning cached response for "${text.substring(0, 40)}..."`);
    return cached.response;
  }
  return null;
}

function store_dedup(text, user_id, response_body) {
  const key = dedup_key(text, user_id);
  recent_requests.set(key, { response: response_body, timestamp: Date.now() });

  // housekeeping: evict stale entries every 50 requests
  if (recent_requests.size > 50) {
    const now = Date.now();
    for (const [k, v] of recent_requests) {
      if (now - v.timestamp > DEDUP_TTL_MS) recent_requests.delete(k);
    }
  }
}

/**
 * Send a JSON response AND fire-and-forget log the interaction.
 * The log never blocks or delays the spoken response.
 */
function respond(res, status, body, ctx) {
  const duration_ms = Date.now() - ctx.start_time;

  // cache this response for dedup
  store_dedup(ctx.utterance, ctx.user_id, body);

  // fire-and-forget: log but don't await
  log_voice_interaction({
    utterance: ctx.utterance,
    intent_result: ctx.intent_result,
    action_taken: body.action_taken,
    spoken_response: body.spoken_response,
    entry_url: body.entry_url,
    user_id: ctx.user_id,
    error: body.error,
    duration_ms
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
  const ctx = { utterance: text, user_id, start_time, intent_result: null };

  if (!text) {
    return respond(res, 400, {
      spoken_response: "i didn't catch anything — try speaking again.",
      action_taken: 'none'
    }, ctx);
  }

  // dedup: if we've already processed this exact utterance recently, return cached response
  const cached = check_dedup(text, user_id);
  if (cached) {
    return res.status(200).json(cached);
  }

  console.log(`[voice] received from ${user_id || 'unknown'}: "${text}"`);

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
        return handle_code_conversation(intent, ctx, res);

      case 'build_approval':
        return handle_build_stub(intent, ctx, res);

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
    priority: intent.priority || 'medium'
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
    priority: intent.priority || 'medium'
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
    task_type: intent.task_type
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
    // phase 1: use bot token. phase 4: use per-user oauth token from kv.
    const token = process.env.SLACK_BOT_TOKEN;
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
    const token = process.env.SLACK_BOT_TOKEN;
    const recipient = resolve_member(intent.slack_recipient);

    if (!recipient?.slack_user_id) {
      return respond(res, 200, {
        spoken_response: `i don't have a slack id for ${intent.slack_recipient || 'that person'} yet. want me to note this instead?`,
        action_taken: 'slack_message_failed',
        intent_result: intent
      }, ctx);
    }

    // open or find the dm channel
    const channel_id = await find_dm_channel({ token, user_id: recipient.slack_user_id });

    if (!channel_id) {
      return respond(res, 200, {
        spoken_response: `couldn't open a dm with ${recipient.name}. want me to try again or note this instead?`,
        action_taken: 'slack_message_failed',
        intent_result: intent
      }, ctx);
    }

    const result = await send_message({
      token,
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
    const token = process.env.SLACK_BOT_TOKEN;
    const reply_to = resolve_member(intent.reply_to);

    if (!reply_to?.slack_user_id) {
      return respond(res, 200, {
        spoken_response: `who should i reply to? say something like "reply to lamis: sounds good."`,
        action_taken: 'slack_reply_needs_target',
        intent_result: intent
      }, ctx);
    }

    const channel_id = await find_dm_channel({ token, user_id: reply_to.slack_user_id });

    if (!channel_id) {
      return respond(res, 200, {
        spoken_response: `couldn't find the conversation with ${reply_to.name}. want to try again?`,
        action_taken: 'slack_reply_failed',
        intent_result: intent
      }, ctx);
    }

    const result = await send_message({
      token,
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

function handle_code_conversation(intent, ctx, res) {
  // the voice log already captures this interaction with intent=code_conversation.
  // claude code's scheduled task polls the voice history for code_conversation intents
  // and starts working on them. so all we need to do here is confirm it's queued.
  console.log(`[voice] code conversation queued: "${intent.content?.substring(0, 80)}..."`);
  return respond(res, 200, {
    spoken_response: tts.code_conversation_queued(),
    action_taken: 'code_conversation',
    intent_result: intent
  }, ctx);
}

function handle_build_stub(intent, ctx, res) {
  console.log(`[voice] build approval stub`);
  return respond(res, 200, {
    spoken_response: "build approvals aren't wired up yet — that's phase 3. anything else?",
    action_taken: 'stub_build',
    intent_result: intent
  }, ctx);
}
