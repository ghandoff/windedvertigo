/**
 * POST /api/competitors/generate
 *
 * Uses Claude to suggest new competitors/adjacent players for the
 * competitive landscape database based on winded.vertigo's service profile
 * and the names of organisations already tracked.
 *
 * Body: { existingNames: string[] }
 * Returns: { suggestions: CompetitorSuggestion[] }
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";

export interface CompetitorSuggestion {
  organisation: string;
  type: "Direct Competitor" | "Adjacent Player" | "Conference / Event" | "Network / Association" | "Certification Body";
  threatLevel: "🔴 High" | "🟡 Medium" | "🟢 Low";
  quadrantOverlap: string[];
  geography: string[];
  whatTheyOffer: string;
  whereWvWins: string;
  relevanceToWv: string;
  url: string;
}

const SYSTEM = `You are a competitive intelligence analyst for winded.vertigo — a learning design collective.

winded.vertigo works in:
- Learning design, instructional design, curriculum development
- Capacity building, train-the-trainer, professional development
- Evidence design, monitoring & evaluation (MEL), mixed-methods evaluation
- Digital/blended learning
- International development sector (UN, IDB, USAID, foundations, NGOs)

Quadrant categories used: "Design + Deploy", "Pinpoint + Prove", "Build + Iterate", "Test + Validate"
Geography options: "Global", "US", "UK", "Europe", "Latin America", "East Africa", "Middle East", "Asia-Pacific"

Return ONLY valid JSON: an array of exactly 5 competitor suggestions. Each must be a real organisation (no invented names).`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const existingNames: string[] = Array.isArray(body.existingNames) ? body.existingNames : [];

  const userMessage = `Suggest 5 real organisations that compete with or are adjacent to winded.vertigo in the learning design, instructional design, curriculum development, MEL/evaluation, or international development education sectors.

Already tracked (do NOT suggest these): ${existingNames.length > 0 ? existingNames.join(", ") : "none yet"}

Return a JSON array of 5 objects with these exact fields:
[
  {
    "organisation": "exact org name",
    "type": "Direct Competitor" | "Adjacent Player" | "Conference / Event" | "Network / Association" | "Certification Body",
    "threatLevel": "🔴 High" | "🟡 Medium" | "🟢 Low",
    "quadrantOverlap": ["Design + Deploy", ...],
    "geography": ["Global", "US", ...],
    "whatTheyOffer": "1-2 sentences on what they do",
    "whereWvWins": "1 sentence on where winded.vertigo has an edge over them",
    "relevanceToWv": "1 sentence on why this org matters to w.v's positioning",
    "url": "their website URL"
  }
]`;

  let result;
  try {
    result = await callClaude({
      feature: "next-best-action", // closest feature category; no dedicated competitive-intel feature
      system: SYSTEM,
      userMessage,
      userId: "system",
      maxTokens: 2048,
      temperature: 0.5,
    });
  } catch (err) {
    console.error("[competitors/generate] Claude call failed:", err);
    return error("AI generation failed", 500);
  }

  let suggestions: CompetitorSuggestion[];
  try {
    const parsed = parseJsonResponse<CompetitorSuggestion[]>(result.text);
    suggestions = Array.isArray(parsed) ? parsed : [];
  } catch {
    return error("AI response could not be parsed", 500);
  }

  return json({ suggestions });
}
