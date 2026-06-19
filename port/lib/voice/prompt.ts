/**
 * Voice system-prompt assembly.
 *
 * Combines an assistant's intro + posture + live briefing into a single
 * spoken-delivery system prompt. The static prefix (intro + posture +
 * spoken-delivery rules) is stable across a call, so we mark it for Anthropic
 * prompt caching; the live briefing is appended after.
 *
 * Briefings are assembled IN-PROCESS (see ./briefing) from the same Supabase
 * data the /api/{agent}/briefing routes use — no worker-to-itself HTTP hop,
 * which keeps first-token latency under Vapi's custom-llm timeout. Results are
 * cached per slug for a short TTL so repeated turns in a call are instant.
 * Fail-open: a missing briefing degrades to "", it never breaks the call.
 */

import type { VoiceAssistant } from "./assistants";
import { buildVoiceBriefing } from "./briefing";

// ---------------------------------------------------------------------------
// Briefing assembly (TTL-cached, fail-open)
// ---------------------------------------------------------------------------

const BRIEFING_TTL_MS = 60_000;
const briefingCache = new Map<string, { text: string; at: number }>();

/** Assemble an agent's briefing (in-process, TTL-cached). "" for Claude / on error. */
export async function fetchVoiceBriefing(a: VoiceAssistant): Promise<string> {
  if (!a.briefingPath) return "";

  const now = Date.now();
  const cached = briefingCache.get(a.slug);
  if (cached && now - cached.at < BRIEFING_TTL_MS) return cached.text;

  const text = await buildVoiceBriefing(a.slug);
  briefingCache.set(a.slug, { text, at: now });
  return text;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SPOKEN_DELIVERY = `## you are on a phone call

this is a live voice call — your words are spoken aloud, not read. so:
- talk like a person, not a document. short sentences. no markdown, no bullet points, no headings, no emoji.
- lead with the answer, then a little detail. keep most replies to a few sentences — this is a conversation, not a briefing.
- spell things out for the ear: say "three thousand dollars", not "$3,000"; "the rfp", not "RFP" unless it's natural.
- it's fine to be warm and brief. ask one question at a time. if you need a moment, say so.
- you're speaking with Garrett. you don't need to introduce yourself again mid-call.`;

/**
 * Static prefix of the system prompt (intro + posture + spoken rules).
 * Stable across a call → cache this with Anthropic prompt caching.
 */
export function buildStaticSystemPrefix(a: VoiceAssistant): string {
  const parts = [a.intro];
  if (a.posture) parts.push(`## your posture\n\n${a.posture}`);
  parts.push(SPOKEN_DELIVERY);
  return parts.join("\n\n");
}

/** The dynamic suffix: live briefing for this call. Empty for the Claude line. */
export function buildBriefingSuffix(briefing: string): string {
  if (!briefing) return "";
  return `## current state (loaded at the start of this call)\n\n${briefing}`;
}
