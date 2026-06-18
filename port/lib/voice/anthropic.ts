/**
 * Dedicated Anthropic client for the voice pilot.
 *
 * Uses VOICE_ANTHROPIC_API_KEY pointed directly at api.anthropic.com — NOT the
 * Vercel AI Gateway the rest of the port routes through. baseURL is pinned
 * explicitly so a globally-set ANTHROPIC_BASE_URL can't redirect voice traffic.
 * This isolates voice spend/latency and keeps prompt-caching behavior
 * predictable for the pilot.
 */

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getVoiceAnthropic(): Anthropic {
  if (client) return client;
  const apiKey = process.env.VOICE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "VOICE_ANTHROPIC_API_KEY is not set — the voice pilot needs its own Anthropic key.",
    );
  }
  client = new Anthropic({ apiKey, baseURL: "https://api.anthropic.com" });
  return client;
}
