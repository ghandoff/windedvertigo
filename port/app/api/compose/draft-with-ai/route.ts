/**
 * POST /api/compose/draft-with-ai — AI-assist content drafting for /compose.
 *
 * Body: { channel, prompt, currentText? }
 *
 * Loads brand context from strategy-data (same source wv-claw's
 * readStrategyDoc reads), builds a channel-aware system prompt with
 * voice + length constraints, calls Claude, returns the draft text.
 *
 * Doesn't write to the draft — that's the client's responsibility (so the
 * user can review before committing).
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { readStrategyDocTool } from "@/lib/agent/tools/strategy";
import { CHANNEL_CHAR_LIMITS, type ComposeChannel } from "@/lib/supabase/compose-drafts";
import { MODEL_PRICING } from "@/lib/ai/types";

// Use the same direct-Anthropic SDK pattern as wv-claw, NOT lib/ai/client's
// callClaude wrapper — that wrapper remaps "claude-sonnet-4-6" to a deprecated
// date-suffixed model id and 404s. Direct SDK + raw model name works.
const MODEL_ID = "claude-sonnet-4-6";
const anthropic = new Anthropic();

export const maxDuration = 60;

const CHANNEL_GUIDE: Record<ComposeChannel, string> = {
  linkedin:
    "LinkedIn post. Aim for ~150-280 words; lead with a concrete hook (no '🚀 Excited to share' openers); use line breaks for scannability; no hashtags unless the user asked.",
  bluesky:
    "Bluesky post. HARD 300-character limit. One idea, one voice. No hashtags. Plain text.",
  substack:
    "Substack essay. ~400-1000 words; lead with a question or anecdote; conversational; close with what the reader does next.",
  "meta-facebook":
    "Facebook post. ~50-150 words; warm tone; readable on mobile.",
  "meta-instagram":
    "Instagram caption. ~100-200 words; vivid imagery in language; OK to use hashtags sparingly if asked.",
  email:
    "Email body. Plain text; ~150-300 words; concrete subject (use the title); warm sign-off (— winded.vertigo).",
};

const BRAND_VOICE = `Voice: warm, observant, slightly contrarian, lowercase preferred (matches winded.vertigo's house style); avoid LinkedIn-speak ('thrilled', 'humbled', 'leveraging'); no jargon; cite concrete examples; reference real people/projects by first name; use sentence-case in titles. Always default to specifics over abstractions.`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const channel = typeof body.channel === "string" ? body.channel : "";
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const currentText = typeof body.currentText === "string" ? body.currentText.trim() : "";

  if (!prompt) {
    return NextResponse.json({ error: "missing prompt" }, { status: 400 });
  }
  if (!(channel in CHANNEL_GUIDE)) {
    return NextResponse.json({ error: "invalid channel" }, { status: 400 });
  }

  // Pull brand context — strategy section gives positioning + targets;
  // channels section gives the channel's role in our mix. Both inform tone.
  const strategy = readStrategyDocTool("strategy");
  const channels = readStrategyDocTool("channels");

  const systemPrompt =
    `You are drafting a post for winded.vertigo — a learning design collective. ` +
    `Channel: ${CHANNEL_GUIDE[channel as ComposeChannel]}\n\n` +
    `${BRAND_VOICE}\n\n` +
    `Strategy context (use as needed; don't recite it):\n${JSON.stringify(strategy)}\n\n` +
    `Channel mix:\n${JSON.stringify(channels)}\n\n` +
    `Return ONLY the post text — no preamble, no explanation, no "Here's a draft:". Just the post.`;

  const userMessage =
    (currentText
      ? `Current draft (revise this in line with the prompt below):\n${currentText}\n\n---\n\n`
      : "") +
    `Prompt: ${prompt}`;

  try {
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1024,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    // Concatenate text blocks from response.
    const text = response.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((b: any) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => b.text)
      .join("")
      .trim();

    const limit = CHANNEL_CHAR_LIMITS[channel as ComposeChannel];
    const overLimit = limit !== null && text.length > limit;

    const pricing = MODEL_PRICING[MODEL_ID];
    const inputTokens = response.usage?.input_tokens ?? 0;
    const outputTokens = response.usage?.output_tokens ?? 0;
    const costUsd =
      (inputTokens / 1_000_000) * pricing.input +
      (outputTokens / 1_000_000) * pricing.output;

    return NextResponse.json({
      text,
      overLimit,
      limit,
      charCount: text.length,
      usage: { inputTokens, outputTokens, costUsd },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn("[compose/draft-with-ai] failed:", message);
    return NextResponse.json({ error: "draft_failed", message }, { status: 500 });
  }
}
