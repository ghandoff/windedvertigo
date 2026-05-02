/**
 * Wave 10.1 — Claude Strategy adapter
 *
 * Wraps the existing Anthropic SDK call pattern into the Strategy interface.
 * Phase 1A creates this so Phase 1B can register the strategy chain like:
 *   registerStrategy('pcs-preflight', [
 *     { type: 'deterministic', run: regexPreflight },
 *     claudeStrategy('claude-haiku-4.5', preflightPrompt),
 *   ]);
 * without each call site needing to know about the SDK shape.
 */

import Anthropic from '@anthropic-ai/sdk';

const _client = new Anthropic({ apiKey: process.env.LLM_API_KEY });

/**
 * Build a Strategy that calls Claude with the given model + system prompt.
 *
 * @param {string} model - Claude model identifier (e.g. 'claude-sonnet-4-5')
 * @param {string} systemPrompt
 * @param {{ maxTokens?: number, parser?: (text: string) => any }} [options]
 */
export function claudeStrategy(model, systemPrompt, options = {}) {
  const { maxTokens = 4096, parser = null } = options;
  return {
    type: 'claude',
    model,
    async run(payload /* , callerOptions */) {
      const userMessage = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const res = await _client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });
      const text = res.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const value = parser ? parser(text) : text;
      return { ok: true, value };
    },
  };
}
