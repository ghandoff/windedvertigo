/**
 * Claude API client wrapper with built-in token tracking.
 *
 * Uses @ai-sdk/anthropic (Vercel AI SDK v6) which supports:
 *   - Vercel AI Gateway routing (configure base URL via vercel env pull)
 *   - AbortSignal-based timeouts so hung calls don't consume Inngest step budgets
 *   - Token usage tracking for the AI Hub cost dashboard
 *
 * Every call records token usage, cost, and duration.
 */

import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AiFeature, ModelId, TokenUsageEntry } from "./types";
import { MODEL_PRICING, FEATURE_MODELS } from "./types";
import { recordUsage } from "./usage-store";

// Provider is created once per module (env vars are stable within a serverless
// invocation).
//
// Auth is handled entirely via environment variables populated by `vercel env pull`.
// Vercel injects credentials at runtime via OIDC workload identity — no keys
// are referenced in code. When a gateway base URL is configured, the provider
// routes through it; otherwise calls go directly to the upstream API.
const anthropicProvider = createAnthropic({
  ...(process.env.ANTHROPIC_BASE_URL ? { baseURL: process.env.ANTHROPIC_BASE_URL } : {}),
});

interface AiCallOptions {
  feature: AiFeature;
  system: string;
  userMessage: string;
  userId: string;
  maxTokens?: number;
  temperature?: number;
  modelOverride?: ModelId;
  /** Request timeout in milliseconds. Defaults to 300 000 ms (5 min). */
  timeoutMs?: number;
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
  const modelId = opts.modelOverride ?? FEATURE_MODELS[opts.feature];
  const pricing = MODEL_PRICING[modelId];

  const start = Date.now();

  // AbortSignal.timeout() cancels the request if Claude doesn't respond within
  // the allotted time. This prevents hung API calls from consuming the entire
  // Inngest step budget (8 min function timeout).
  const { text, usage } = await generateText({
    model: anthropicProvider(modelId),
    maxOutputTokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.7,
    system: opts.system,
    prompt: opts.userMessage,
    abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 300_000),
  });

  const durationMs = Date.now() - start;

  // usage fields are number | undefined — some providers omit token counts
  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  // Record usage asynchronously — don't block the response
  const entry: TokenUsageEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    feature: opts.feature,
    model: modelId,
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
