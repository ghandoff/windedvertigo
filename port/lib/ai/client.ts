/**
 * Claude API client wrapper with built-in token tracking.
 *
 * Uses @ai-sdk/anthropic (Vercel AI SDK v6) which supports:
 *   - Vercel AI Gateway routing (configure base URL via vercel env pull)
 *   - AbortSignal-based timeouts so hung calls don't consume Inngest step budgets
 *   - Token usage tracking for the AI Hub cost dashboard
 *
 * Every call records token usage, cost, and duration.
 *
 * IMPORTANT: Uses streamText (not generateText) for all calls.
 * generateText makes a blocking HTTP request that waits for the full response;
 * for large outputs (12k tokens at ~30 tok/s ≈ 400s), Cloudflare's 100-second
 * origin-timeout fires and returns HTTP 524 before Anthropic responds.
 * streamText uses SSE (Server-Sent Events), which sends heartbeats that keep
 * the connection alive for the full generation duration.
 */

import { streamText } from "ai";
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

  // Use AbortController + setTimeout instead of AbortSignal.timeout() because
  // AbortSignal.timeout() fires immediately (0 ms) in CF Workers with the
  // nodejs_compat flag — a known runtime bug. Manual AbortController uses the
  // standard setTimeout which works correctly in all environments.
  const timeoutMs = opts.timeoutMs ?? 300_000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // streamText keeps the SSE connection alive during generation; generateText
  // would block the TCP connection until the full response arrives, triggering
  // Cloudflare's 100-second origin-timeout (HTTP 524) on large completions.
  let text: string;
  let usage: { inputTokens?: number; outputTokens?: number };
  try {
    const result = streamText({
      model: anthropicProvider(modelId),
      maxOutputTokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      prompt: opts.userMessage,
      abortSignal: controller.signal,
    });
    // Await both in parallel — text resolves after last chunk, usage after stream end
    [text, usage] = await Promise.all([result.text, result.usage]);
  } catch (err) {
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

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
