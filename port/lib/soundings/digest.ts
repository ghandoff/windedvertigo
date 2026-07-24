/**
 * Soundings — the Claude digest. One synthesized artifact per sounding
 * (themes / conflicts / actions anchored to doc sections), so maria reads one
 * thing instead of relistening to five voice notes. Digest, don't drip.
 */

import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import type { SoundingRow, SoundingDigestJson } from "@/lib/supabase/soundings";
import type { SoundingItemRow } from "@/lib/supabase/sounding-items";
import type { SoundingReviewerRow } from "@/lib/supabase/sounding-reviewers";
import { assembleDigestInput } from "./logic";

const DIGEST_SYSTEM = `you are synthesizing async feedback from a small consultancy collective (winded.vertigo) on an RFP one-pager or draft, ahead of their wednesday planning meeting.

you receive the document title, the questions that were posed (👤 = asked by a named human, 🤖 = asked by an agent), and each reviewer's feedback note (voice-note transcript or text). voice transcripts are informal spoken thought — read for intent, not polish.

return ONLY a JSON object, no prose around it:
{
  "themes": string[],      // 2-5 points of agreement or repeated concern, each one sentence
  "conflicts": string[],   // where reviewers genuinely disagree — name the tension, not the people's behaviour; [] if none
  "actions": [             // concrete suggested changes, each anchored to a section/aspect of the doc
    { "section": string, "action": string }
  ]
}

rules:
- lowercase, plain language, british spelling.
- preserve attribution of IDEAS (e.g. "one note reads the LOE as understated") but NEVER rank, score, or compare reviewers.
- a "pass" response and a non-response are both fine — never editorialize about who responded or how much.
- if a transcript failed and only an audio link is present, mention there is an unprocessed voice note to listen to.
- if the notes answer a posed question, say so under themes.`;

export async function generateSoundingDigest(
  sounding: SoundingRow,
  items: SoundingItemRow[],
  reviewers: SoundingReviewerRow[],
): Promise<SoundingDigestJson | null> {
  try {
    const { text } = await callClaude({
      feature: "soundings-digest",
      system: DIGEST_SYSTEM,
      userMessage: assembleDigestInput(sounding, items, reviewers),
      userId: "system:soundings",
      maxTokens: 1500,
      temperature: 0.3,
    });
    const parsed = parseJsonResponse<SoundingDigestJson>(text);
    if (
      !Array.isArray(parsed.themes) ||
      !Array.isArray(parsed.conflicts) ||
      !Array.isArray(parsed.actions)
    ) {
      console.warn("[soundings/digest] digest JSON missing expected arrays");
      return null;
    }
    return {
      themes: parsed.themes.filter((t) => typeof t === "string"),
      conflicts: parsed.conflicts.filter((c) => typeof c === "string"),
      actions: parsed.actions.filter(
        (a) => a && typeof a.section === "string" && typeof a.action === "string",
      ),
    };
  } catch (err) {
    console.warn("[soundings/digest] generation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
