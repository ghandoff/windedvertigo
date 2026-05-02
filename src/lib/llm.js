/**
 * LLM Provider Abstraction
 * Supports Anthropic (Claude) and OpenAI (GPT-4) via env vars.
 *
 * Model update guide:
 *   1. Check current models at https://docs.anthropic.com/en/docs/about-claude/models
 *   2. Update LLM_MODEL in Vercel env vars (Settings > Environment Variables)
 *   3. Redeploy — no code change needed
 *   4. Anthropic typically deprecates dated models ~12 months after release
 */

const LLM_PROVIDER = process.env.LLM_PROVIDER || 'anthropic';
const LLM_API_KEY = process.env.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || 'claude-sonnet-4-5-20250929';

/**
 * Send a scoring prompt to the configured LLM and return parsed JSON.
 * @param {string} systemPrompt - System instructions
 * @param {string} userPrompt - The article data + rubric
 * @returns {Promise<object>} Parsed JSON response from LLM
 */
export async function callLLM(systemPrompt, userPrompt) {
  if (!LLM_API_KEY) {
    throw new Error('LLM_API_KEY environment variable is not set. Add it in your Vercel project settings.');
  }

  if (LLM_PROVIDER === 'anthropic') {
    return callAnthropic(systemPrompt, userPrompt);
  } else if (LLM_PROVIDER === 'openai') {
    return callOpenAI(systemPrompt, userPrompt);
  } else {
    throw new Error(`Unknown LLM_PROVIDER: ${LLM_PROVIDER}. Use "anthropic" or "openai".`);
  }
}

async function callAnthropic(systemPrompt, userPrompt) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: LLM_API_KEY });

  const message = await client.messages.create({
    model: LLM_MODEL,
    max_tokens: 2000,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0]?.text || '';
  return extractJSON(text);
}

async function callOpenAI(systemPrompt, userPrompt) {
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey: LLM_API_KEY });

  const completion = await client.chat.completions.create({
    model: LLM_MODEL,
    temperature: 0,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const text = completion.choices[0]?.message?.content || '';
  return extractJSON(text);
}

/**
 * Extract JSON from LLM response text. Handles both raw JSON and
 * JSON wrapped in markdown code blocks.
 */
function extractJSON(text) {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        // fall through
      }
    }
    // Try finding first { ... } block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        // fall through
      }
    }
    throw new Error('Failed to parse JSON from LLM response. Raw response: ' + text.substring(0, 500));
  }
}
