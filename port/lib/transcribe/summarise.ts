/**
 * Claude Sonnet summariser for meeting transcripts.
 *
 * Extracts a short summary, a list of action items, and a list of
 * decisions. Returns empty strings/arrays on failure (the pipeline
 * continues — the audio + transcript are still saved).
 */

import Anthropic from "@anthropic-ai/sdk";

interface SummariseArgs {
  transcript: string;
  title: string;
  attendeeNames: string[];
}

interface SummariseResult {
  summary: string;
  actionItems: string[];
  decisions: string[];
}

const EMPTY: SummariseResult = {
  summary: "",
  actionItems: [],
  decisions: [],
};

export async function summariseTranscript(
  args: SummariseArgs,
): Promise<SummariseResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return EMPTY;
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You summarise meeting transcripts for a small consultancy called winded.vertigo. Respond in plain British English, lowercase where possible (titles and proper nouns keep their natural case). Oxford commas. Be concise.

For each transcript you receive, extract:

1. SUMMARY — a 2-4 sentence paragraph describing what happened. No preamble ("in this meeting...") — just the substance.
2. ACTION ITEMS — each a short imperative starting with a verb. Include the person's name if mentioned ("maria to send the draft by friday"). Do NOT invent assignments that weren't mentioned. No duplicates.
3. DECISIONS — outcomes the group AGREED to (not questions, not opinions, not options discussed). If none were made, return an empty array.

Return ONLY valid JSON matching this exact shape, no prose wrapping:

{
  "summary": "string",
  "actionItems": ["string", "string"],
  "decisions": ["string", "string"]
}`;

  const userPrompt = `Meeting title: ${args.title}${
    args.attendeeNames.length > 0
      ? `\nAttendees: ${args.attendeeNames.join(", ")}`
      : ""
  }

Transcript:
<<<
${args.transcript}
>>>`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return EMPTY;

    const raw = textBlock.text.trim();
    // Claude sometimes wraps JSON in ```json ... ``` fences; strip them
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned) as unknown;
    if (!isValidResult(parsed)) return EMPTY;

    return {
      summary: parsed.summary.trim(),
      actionItems: parsed.actionItems.map((s) => s.trim()).filter(Boolean),
      decisions: parsed.decisions.map((s) => s.trim()).filter(Boolean),
    };
  } catch (err) {
    console.error("summarise failed:", err);
    return EMPTY;
  }
}

function isValidResult(x: unknown): x is SummariseResult {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.summary === "string" &&
    Array.isArray(o.actionItems) &&
    o.actionItems.every((s) => typeof s === "string") &&
    Array.isArray(o.decisions) &&
    o.decisions.every((s) => typeof s === "string")
  );
}
