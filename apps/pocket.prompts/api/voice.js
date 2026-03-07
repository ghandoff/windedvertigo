import { detect_intent } from '../lib/intent.js';
import { create_capture } from '../lib/notion.js';
import { resolve_member, get_slack_user_id } from '../lib/users.js';
import { get_recent_messages, send_message, find_dm_channel } from '../lib/slack.js';
import * as tts from '../lib/tts.js';

export default async function handler(req, res) {
  // handle cors preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { text, user_id } = req.body || {};

  if (!text) {
    return res.status(400).json({
      spoken_response: "i didn't catch anything — try speaking again.",
      action_taken: 'none'
    });
  }

  console.log(`[voice] received from ${user_id || 'unknown'}: "${text}"`);

  // step 1: detect intent
  const intent = await detect_intent(text);
  console.log(`[voice] intent: ${intent.intent} (confidence: ${intent.confidence})`);

  // step 2: if low confidence, ask for clarification
  if (intent.intent === 'unknown' || intent.confidence < 0.7) {
    return res.status(200).json({
      spoken_response: tts.clarifying(intent.clarifying_question),
      action_taken: 'clarification_needed',
      intent_result: intent
    });
  }

  // step 3: route by intent
  try {
    switch (intent.intent) {
      case 'notion_note':
        return await handle_note(intent, res);

      case 'notion_idea':
        return await handle_idea(intent, res);

      case 'notion_task':
        return await handle_task(intent, res);

      case 'slack_check':
        return await handle_slack_check(intent, user_id, res);

      case 'slack_message':
        return await handle_slack_message(intent, user_id, res);

      case 'slack_reply':
        return await handle_slack_reply(intent, user_id, res);

      case 'code_conversation':
        return handle_code_stub(intent, res);

      case 'build_approval':
        return handle_build_stub(intent, res);

      default:
        return res.status(200).json({
          spoken_response: tts.clarifying("i recognized something but don't know how to handle it yet — could you rephrase?"),
          action_taken: 'unhandled_intent',
          intent_result: intent
        });
    }
  } catch (err) {
    console.error(`[voice] routing error: ${err.message}`);
    return res.status(500).json({
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    });
  }
}

// --- intent handlers ---

async function handle_note(intent, res) {
  const result = await create_capture({
    type: 'note',
    content: intent.content,
    priority: intent.priority || 'medium'
  });

  if (!result.success) {
    return res.status(500).json({
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: result.error
    });
  }

  return res.status(200).json({
    spoken_response: tts.note_captured(intent.priority || 'medium'),
    action_taken: 'notion_note',
    entry_url: result.url
  });
}

async function handle_idea(intent, res) {
  const result = await create_capture({
    type: 'idea',
    content: intent.content,
    priority: intent.priority || 'medium'
  });

  if (!result.success) {
    return res.status(500).json({
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: result.error
    });
  }

  return res.status(200).json({
    spoken_response: tts.idea_captured(intent.priority || 'medium'),
    action_taken: 'notion_idea',
    entry_url: result.url
  });
}

async function handle_task(intent, res) {
  const assignee = resolve_member(intent.assignee);
  const assignee_name = assignee?.name || intent.assignee || 'unassigned';

  // include assignee in content for now (no assignee column in db yet)
  const task_content = assignee
    ? `[assigned to ${assignee_name}] ${intent.content}`
    : intent.content;

  const result = await create_capture({
    type: 'task',
    content: task_content,
    priority: intent.priority || 'medium',
    assignee_notion_id: assignee?.notion_user_id
  });

  if (!result.success) {
    return res.status(500).json({
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: result.error
    });
  }

  return res.status(200).json({
    spoken_response: tts.task_assigned(assignee_name, intent.due_date),
    action_taken: 'notion_task',
    entry_url: result.url
  });
}

// --- slack handlers ---

async function handle_slack_check(intent, user_id, res) {
  try {
    // phase 1: use bot token. phase 4: use per-user oauth token from kv.
    const token = process.env.SLACK_BOT_TOKEN;
    const slack_user_id = get_slack_user_id(user_id);

    const { messages, summary } = await get_recent_messages({
      token,
      user_id: slack_user_id,
      limit: 10
    });

    if (messages.length === 0) {
      return res.status(200).json({
        spoken_response: tts.slack_no_messages(),
        action_taken: 'slack_check',
        message_count: 0
      });
    }

    // summary already includes CTA from the claude summarizer
    return res.status(200).json({
      spoken_response: summary,
      action_taken: 'slack_check',
      message_count: messages.length,
      messages // include raw messages in json for debugging / shortcut use
    });
  } catch (err) {
    console.error(`[voice] slack check failed: ${err.message}`);
    return res.status(500).json({
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    });
  }
}

async function handle_slack_message(intent, user_id, res) {
  try {
    const token = process.env.SLACK_BOT_TOKEN;
    const recipient = resolve_member(intent.slack_recipient);

    if (!recipient?.slack_user_id) {
      return res.status(200).json({
        spoken_response: `i don't have a slack id for ${intent.slack_recipient || 'that person'} yet. want me to note this instead?`,
        action_taken: 'slack_message_failed',
        intent_result: intent
      });
    }

    // open or find the dm channel
    const channel_id = await find_dm_channel({ token, user_id: recipient.slack_user_id });

    if (!channel_id) {
      return res.status(200).json({
        spoken_response: `couldn't open a dm with ${recipient.name}. want me to try again or note this instead?`,
        action_taken: 'slack_message_failed',
        intent_result: intent
      });
    }

    const result = await send_message({
      token,
      channel_id,
      text: intent.content
    });

    if (!result.success) {
      return res.status(500).json({
        spoken_response: tts.error_fallback(),
        action_taken: 'error',
        error: result.error
      });
    }

    return res.status(200).json({
      spoken_response: tts.slack_sent(recipient.name),
      action_taken: 'slack_message',
      channel_id
    });
  } catch (err) {
    console.error(`[voice] slack message failed: ${err.message}`);
    return res.status(500).json({
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    });
  }
}

async function handle_slack_reply(intent, user_id, res) {
  try {
    const token = process.env.SLACK_BOT_TOKEN;
    const reply_to = resolve_member(intent.reply_to);

    if (!reply_to?.slack_user_id) {
      return res.status(200).json({
        spoken_response: `who should i reply to? say something like "reply to lamis: sounds good."`,
        action_taken: 'slack_reply_needs_target',
        intent_result: intent
      });
    }

    const channel_id = await find_dm_channel({ token, user_id: reply_to.slack_user_id });

    if (!channel_id) {
      return res.status(200).json({
        spoken_response: `couldn't find the conversation with ${reply_to.name}. want to try again?`,
        action_taken: 'slack_reply_failed',
        intent_result: intent
      });
    }

    const result = await send_message({
      token,
      channel_id,
      text: intent.content
    });

    if (!result.success) {
      return res.status(500).json({
        spoken_response: tts.error_fallback(),
        action_taken: 'error',
        error: result.error
      });
    }

    return res.status(200).json({
      spoken_response: tts.slack_reply_sent(reply_to.name),
      action_taken: 'slack_reply',
      channel_id
    });
  } catch (err) {
    console.error(`[voice] slack reply failed: ${err.message}`);
    return res.status(500).json({
      spoken_response: tts.error_fallback(),
      action_taken: 'error',
      error: err.message
    });
  }
}

// --- phase 3 stubs ---

function handle_code_stub(intent, res) {
  console.log(`[voice] code conversation stub`);
  return res.status(200).json({
    spoken_response: "code conversations aren't wired up yet — coming soon. want to do something else?",
    action_taken: 'stub_code',
    intent_result: intent
  });
}

function handle_build_stub(intent, res) {
  console.log(`[voice] build approval stub`);
  return res.status(200).json({
    spoken_response: "build approvals aren't wired up yet — that's phase 3. anything else?",
    action_taken: 'stub_build',
    intent_result: intent
  });
}
