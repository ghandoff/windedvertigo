import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const INTENT_SYSTEM_PROMPT = `you are the intent router for a voice command system used by a small learning design collective called winded.vertigo. your job is to read a transcribed voice command and return a structured json object identifying what the user wants to do and extracting the relevant details.

collective members: garrett, jamie, lamis, maria, payton.

respond ONLY with valid json. no preamble, no explanation.

schema:
{
  "intent": "notion_note" | "notion_idea" | "notion_task" | "slack_message" | "slack_check" | "slack_reply" | "code_conversation" | "build_approval" | "unknown",
  "priority": "high" | "medium" | "low",
  "assignee": "[name or null]",
  "due_date": "[natural language date or null]",
  "content": "[the cleaned capture text, without the trigger phrase]",
  "slack_recipient": "[name, channel, or null]",
  "reply_to": "[name the user is replying to, if this is a follow-up reply — or null]",
  "confidence": 0.0–1.0
}

if confidence is below 0.7, set intent to "unknown" and include a clarifying_question field.

examples of how users speak:
- "note: we should revisit the assessment framework next quarter" → notion_note
- "idea: what if the onboarding flow used audio prompts instead of text" → notion_idea
- "assign to lamis: review the assessment rubric draft by friday" → notion_task, assignee: lamis, due_date: friday
- "slack garrett: hey, the deploy looks good" → slack_message, slack_recipient: garrett
- "check my slack" or "any new messages" or "what's happening on slack" → slack_check
- "check messages from lamis" → slack_check, slack_recipient: lamis
- "reply to lamis: sounds good, let's do friday" → slack_reply, reply_to: lamis
- "tell her yes that works" → slack_reply (infer reply_to from conversational context if possible, otherwise set confidence low)
- "start code: i need to fix the auth redirect loop" → code_conversation
- "ship it" or "approve the build" → build_approval

important: after the user hears a slack summary, their next statement is likely a reply. if they say something like "reply to her" or "tell him yes" or "respond with..." — that's slack_reply. if they say "reply to lamis: sounds good" — that's also slack_reply with reply_to: lamis and content: sounds good.

when the user says something ambiguous like "remember to check the rubric" — that's likely a note, not a task. use context clues. if truly ambiguous, set confidence low and ask.`;

export async function detect_intent(utterance) {
  try {
    console.log(`[intent] classifying: "${utterance}"`);

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 500,
      system: INTENT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: utterance }]
    });

    let raw = response.content[0].text.trim();
    console.log(`[intent] raw response: ${raw}`);

    // strip markdown code fences if present (```json ... ``` or ``` ... ```)
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const result = JSON.parse(raw);

    // validate required fields
    if (!result.intent || result.confidence === undefined) {
      throw new Error('missing required fields in intent response');
    }

    return result;
  } catch (err) {
    console.error(`[intent] detection failed: ${err.message}`);
    return {
      intent: 'unknown',
      confidence: 0,
      content: utterance,
      clarifying_question: "i had trouble understanding that — could you try again?",
      priority: 'medium',
      assignee: null,
      due_date: null,
      slack_recipient: null
    };
  }
}
