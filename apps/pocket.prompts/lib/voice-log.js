import { Client } from '@notionhq/client';

const log_db_id = (process.env.NOTION_VOICE_LOG_DB_ID || '').trim();

/**
 * Log a voice interaction to the Notion Voice Log database.
 * Fire-and-forget — never throws, never blocks the voice response.
 */
export async function log_voice_interaction({
  utterance,
  intent_result,
  action_taken,
  spoken_response,
  entry_url,
  user_id,
  error,
  duration_ms,
  request_id,
  timestamp,
  platform
}) {
  if (!log_db_id) {
    console.log('[voice-log] NOTION_VOICE_LOG_DB_ID not set, skipping');
    return;
  }

  try {
    const notion = new Client({ auth: (process.env.NOTION_API_KEY || '').trim() });

    // privacy: sanitize title to hide raw utterance from shared database.
    // personal content lives in the notion entries themselves (notes, tasks, etc.)
    const sanitized_title = [
      intent_result?.intent || 'unknown',
      user_id || 'anonymous'
    ].join(' — ');

    const properties = {
      utterance: {
        title: [{ text: { content: sanitized_title } }]
      }
    };

    // store raw utterance + spoken response for chat view
    // (title field stays sanitized for shared DB browsing)
    if (utterance) {
      const raw = utterance.length > 2000 ? utterance.substring(0, 1997) + '...' : utterance;
      properties.content = {
        rich_text: [{ text: { content: raw } }]
      };
    }
    if (spoken_response) {
      const sr = spoken_response.length > 2000 ? spoken_response.substring(0, 1997) + '...' : spoken_response;
      properties.spoken_response = {
        rich_text: [{ text: { content: sr } }]
      };
    }

    // only add properties that have values (Notion rejects null selects)
    if (intent_result?.intent) {
      properties.intent = { select: { name: intent_result.intent } };
    }
    if (intent_result?.confidence != null) {
      properties.confidence = { number: intent_result.confidence };
    }
    if (action_taken) {
      properties.action_taken = { select: { name: action_taken } };
    }
    // NOTE: content and spoken_response intentionally omitted from shared log
    // for privacy. the actual content is accessible via the created notion
    // entries (entry_url) or slack messages.
    if (intent_result?.priority) {
      properties.priority = { select: { name: intent_result.priority } };
    }
    if (entry_url) {
      properties.entry_url = { url: entry_url };
    }
    if (user_id || request_id) {
      // append request_id to user_id field for dedup diagnosis
      const user_str = [user_id, request_id].filter(Boolean).join(' | ');
      properties.user_id = {
        rich_text: [{ text: { content: user_str } }]
      };
    }
    if (error) {
      properties.error = {
        rich_text: [{ text: { content: error.substring(0, 2000) } }]
      };
    }
    if (duration_ms != null) {
      properties.duration_ms = { number: duration_ms };
    }
    if (timestamp) {
      properties.timestamp = { date: { start: timestamp } };
    }
    if (platform) {
      properties.platform = { select: { name: platform } };
    }

    await notion.pages.create({
      parent: { database_id: log_db_id },
      properties
    });

    console.log('[voice-log] interaction logged');
  } catch (err) {
    // never let logging break the voice pipeline
    console.error(`[voice-log] failed: ${err.message}`);
  }
}
