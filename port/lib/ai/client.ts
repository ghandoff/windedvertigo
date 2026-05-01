/**
 * Claude API client wrapper with built-in token tracking.
 *
 * Every call records token usage, cost, and duration for the
 * AI Hub economics dashboard.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AiFeature, ModelId, TokenUsageEntry } from "./types";
import { MODEL_PRICING, FEATURE_MODELS } from "./types";
import { recordUsage } from "./usage-store";

const anthropic = new Anthropic();

interface AiCallOptions {
  feature: AiFeature;
  system: string;
  userMessage: string;
  userId: string;
  maxTokens?: number;
  temperature?: number;
  modelOverride?: ModelId;
}

interface AiCallResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

/** Call Claude and automatically track token usage. */
export async function callClaude(opts: AiCallOptions): Promise<AiCallResult> {
  const model = opts.modelOverride ?? FEATURE_MODELS[opts.feature];
  const pricing = MODEL_PRICING[model];

  const start = Date.now();

  const response = await anthropic.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    system: opts.system,
    messages: [{ role: "user", content: opts.userMessage }],
  });

  const durationMs = Date.now() - start;

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  const firstBlock = response.content[0];
  const text =
    firstBlock && firstBlock.type === "text" ? firstBlock.text : "";

  // Record usage asynchronously — don't block the response
  const entry: TokenUsageEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    feature: opts.feature,
    model,
    inputTokens,
    outputTokens,
    costUsd,
    userId: opts.userId,
    durationMs,
  };
  recordUsage(entry).catch(() => {});

  return { text, inputTokens, outputTokens, costUsd, durationMs };
}

/**
 * Extract and parse JSON from LLM output.
 * Strips markdown fences, leading/trailing text, and handles common
 * LLM response quirks before parsing.
 */
export function parseJsonResponse<T>(raw: string): T {
  let cleaned = raw.trim();

  // Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try to find JSON object or array boundaries
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const jsonStart = cleaned.search(/[{\[]/);
    if (jsonStart >= 0) {
      cleaned = cleaned.slice(jsonStart);
    }
  }

  // Trim trailing non-JSON text after the last } or ]
  const lastBrace = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (lastBrace >= 0) {
    cleaned = cleaned.slice(0, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}
