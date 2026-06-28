/**
 * Knowledge-graph concept extraction.
 *
 * The agents' freeform logs (findings, decision summaries, incident causes)
 * name theories, frameworks, methods, and skills in prose. This pulls those
 * named concepts out so they can become `concept:` nodes the agents "observe",
 * which then reconcile against the human CV graph's skills/frameworks.
 *
 * Model: Haiku (cheap, batched per sync). See FEATURE_MODELS["knowledge-extract"].
 */

import { callClaude, parseJsonResponse } from "./client";

export interface ExtractInput {
  id: string;
  agent: string; // slug, for context only
  text: string;
}

const SYSTEM = `You extract NAMED concepts from short pieces of text written by AI work agents.

A "named concept" is a specific, recognisable theory, framework, methodology, method, instrument, or professional skill — the kind of thing that would appear on an expert's CV or in a literature review. Examples: "self-determination theory", "realist synthesis", "structural equation modelling", "theory of change", "universal design for learning", "psychological safety".

DO NOT extract: generic words, project names, client names, people, tools/brands (Slack, Notion), task descriptions, dates, or vague phrases.

For each input item, return the named concepts it explicitly references. Return an empty array if none are clearly named. Normalise each concept to lowercase, singular, no trailing punctuation. Cap at 5 per item — only the most salient.

Respond with ONLY a JSON object of this exact shape:
{"results":[{"id":"<item id>","concepts":["concept a","concept b"]}]}`;

function isMeaningful(c: string): boolean {
  const t = c.trim();
  return t.length >= 4 && t.length <= 80 && /[a-z]/i.test(t);
}

/** Returns a map of inputId → extracted concept labels. */
export async function extractConcepts(
  items: ExtractInput[],
  userId: string,
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (items.length === 0) return out;

  const BATCH = 20;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const userMessage = JSON.stringify(
      batch.map((b) => ({ id: b.id, agent: b.agent, text: b.text.slice(0, 800) })),
    );
    try {
      const result = await callClaude({
        feature: "knowledge-extract",
        system: SYSTEM,
        userMessage,
        userId,
        maxTokens: 4096,
        temperature: 0.1,
      });
      const parsed = parseJsonResponse<{ results: { id: string; concepts: string[] }[] }>(result.text);
      for (const r of parsed.results ?? []) {
        const concepts = (r.concepts ?? []).map((c) => c.trim().toLowerCase()).filter(isMeaningful);
        if (concepts.length) out.set(r.id, Array.from(new Set(concepts)));
      }
    } catch (err) {
      console.error("[knowledge-extract] batch failed, skipping:", err);
    }
  }
  return out;
}
