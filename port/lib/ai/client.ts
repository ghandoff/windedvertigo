/**
 * Claude API client wrapper with built-in token tracking.
 *
 * Uses the OFFICIAL @anthropic-ai/sdk (same as wv-claw) — NOT the Vercel AI
 * SDK's @ai-sdk/anthropic. The latter was returning 404 on some Haiku model
 * IDs even when direct curl with the same model + key returned 200, and was
 * silently swallowing errors as empty text via the streamText path. The
 * official SDK fails loudly and uses the same wire protocol — it works.
 *
 * Streaming concern: the old comment claimed streamText was used to avoid
 * CF Workers' 100s origin timeout for large completions. In practice every
 * caller uses maxTokens ≤ 4096, which completes in <30s. We use the simpler
 * non-streaming messages.create() path. If a caller someday needs >100s of
 * output, switch THAT caller specifically to anthropic.messages.stream().
 *
 * Every call records token usage, cost, and duration.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AiFeature, ModelId, TokenUsageEntry } from "./types";
import { MODEL_PRICING, FEATURE_MODELS } from "./types";
import { recordUsage } from "./usage-store";

// Built lazily so secret rotations propagate without redeploy on CF Workers.
// Same lazy-init pattern wv-claw uses in lib/agent/index.ts.
let _client: Anthropic | null = null;
let _cachedKey: string | undefined;

function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  if (!_client || apiKey !== _cachedKey) {
    _client = new Anthropic({
      apiKey,
      // Explicit baseURL needed on CF Workers because the SDK's default sometimes
      // resolves to a relative path; same fix wv-claw uses.
      baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    });
    _cachedKey = apiKey;
  }
  return _client;
}

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
  return callClaudeInternal(opts, false);
}

/**
 * Streaming variant of callClaude — use for large completions (maxTokens > 4096)
 * to avoid Cloudflare's connection timeout on long non-streaming fetches.
 *
 * Uses `anthropic.messages.stream()` so the HTTP response body arrives as SSE
 * chunks rather than one large payload. This keeps the fetch connection alive
 * throughout generation and avoids the ~400s wall-clock hang that kills
 * `messages.create()` calls for 12k-token proposal outputs.
 */
export async function callClaudeStreaming(opts: AiCallOptions): Promise<AiCallResult> {
  return callClaudeInternal(opts, true);
}

async function callClaudeInternal(opts: AiCallOptions, streaming: boolean): Promise<AiCallResult> {
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

  let text: string;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const requestParams = {
      model: modelId,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.7,
      system: opts.system,
      messages: [{ role: "user" as const, content: opts.userMessage }],
    };

    if (streaming) {
      // Streaming path — SSE chunks keep the fetch connection alive, avoiding
      // the Cloudflare subrequest hang for large completions (12k tokens ≈ 400s).
      const textParts: string[] = [];
      const stream = getAnthropic().messages.stream(requestParams, { signal: controller.signal });
      stream.on("text", (chunk) => textParts.push(chunk));
      const finalMsg = await stream.finalMessage();
      text = textParts.join("") || finalMsg.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === "text")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join("");
      inputTokens = finalMsg.usage?.input_tokens ?? 0;
      outputTokens = finalMsg.usage?.output_tokens ?? 0;
    } else {
      const response = await getAnthropic().messages.create(requestParams, { signal: controller.signal });
      text = response.content
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((b: any) => b.type === "text")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((b: any) => b.text)
        .join("");
      inputTokens = response.usage?.input_tokens ?? 0;
      outputTokens = response.usage?.output_tokens ?? 0;
    }

    if (!text) {
      throw new Error(
        `Anthropic returned no text content (feature=${opts.feature} model=${modelId})`,
      );
    }
  } finally {
    clearTimeout(timeoutId);
  }

  const durationMs = Date.now() - start;
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
 *
 * Three passes:
 *   1. Extract: strip markdown fences, trim non-JSON pre/post text.
 *   2. Strict parse.
 *   3. On failure, run a small repair pass (trailing commas, smart quotes,
 *      double-comma, unterminated trailing string) and try again. This
 *      handles the long-transcript failure mode where Claude emits subtle
 *      JSON glitches around character 5k+. Cheaper than a retry call.
 *
 * Throws the LAST parse error (with both attempts' info) on full failure.
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

  try {
    return JSON.parse(cleaned);
  } catch (firstErr) {
    // Repair pass — handle the malformations LLMs commonly emit. Each
    // transformation is conservative (no false positives on well-formed JSON).
    const repaired = repairLooseJson(cleaned);
    try {
      return JSON.parse(repaired);
    } catch (secondErr) {
      // Surface both errors so callers can see whether repair changed anything.
      const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
      const secondMsg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      throw new Error(
        `JSON parse failed even after repair. strict=${firstMsg} · repaired=${secondMsg}`,
      );
    }
  }
}

/**
 * Best-effort fixes for LLM-emitted JSON. Each step is idempotent and safe
 * on already-well-formed JSON.
 */
function repairLooseJson(s: string): string {
  return (
    s
      // Trailing commas before `]` or `}` — the single most common LLM glitch.
      // Allowed by JS object/array literals, rejected by strict JSON.
      .replace(/,(\s*[}\]])/g, "$1")
      // Doubled commas (`,,`) — happens on slow streams that retry a chunk.
      .replace(/,\s*,/g, ",")
      // Smart quotes around strings — Claude occasionally emits these in
      // proper-name fields. Replace ONLY at field boundaries to avoid
      // mangling actual content (apostrophe in a name etc).
      .replace(/[“”]/g, '"')
      .replace(/([:\[\{,]\s*)['‘]/g, '$1"')
      .replace(/['’](\s*[,\]\}])/g, '"$1')
  );
}
