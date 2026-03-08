import { Client } from '@notionhq/client';

const log_db_id = process.env.NOTION_VOICE_LOG_DB_ID;

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
  duration_ms
}) {
  if (!log_db_id) {
    console.log('[voice-log] NOTION_VOICE_LOG_DB_ID not set, skipping');
    return;
  }

  try {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });

    const properties = {
      utterance: {
        title: [{ text: { content: (utterance || '(empty)').substring(0, 2000) } }]
      }
    };

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
    if (intent_result?.content) {
      properties.content = {
        rich_text: [{ text: { content: intent_result.content.substring(0, 2000) } }]
      };
    }
    if (intent_result?.priority) {
      properties.priority = { select: { name: intent_result.priority } };
    }
    if (spoken_response) {
      properties.spoken_response = {
        rich_text: [{ text: { content: spoken_response.substring(0, 2000) } }]
      };
    }
    if (entry_url) {
      properties.entry_url = { url: entry_url };
    }
    if (user_id) {
      properties.user_id = {
        rich_text: [{ text: { content: user_id } }]
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
