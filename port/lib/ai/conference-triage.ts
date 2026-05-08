/**
 * Conference triage — AI-powered fit scoring + structured extraction.
 *
 * Given a conference's URL/title/body (from a webpage scrape, RSS item, or
 * Slack-pasted link), Claude Haiku decides whether it's actually a
 * conference/summit/workshop (vs a marketing email or unrelated post),
 * scores fit against winded.vertigo's WV_PROFILE, and extracts structured
 * fields the events tab needs. Cost-controlled (Haiku, 3000-char body cap).
 *
 * Mirrors the shape of triageRfpOpportunity in lib/ai/rfp-triage.ts so future
 * maintenance can stay symmetrical. Both share WV_PROFILE from lib/ai/wv-profile.ts.
 */

import { callClaude, parseJsonResponse } from "./client";
import { WV_PROFILE } from "./wv-profile";
import type {
  WvFitScore,
  ConferenceDeadline,
  ConferenceDiscoverySource,
} from "@/lib/notion/types";

// ── input / output types ──────────────────────────────────

export interface ConferenceTriageInput {
  /** Conference name as best known. May be sparse if scraping a CFP page. */
  title: string;
  /** Raw page HTML or email body — stripped + truncated internally. */
  body: string;
  url?: string;
  discoveredVia: ConferenceDiscoverySource;
}

export interface ConferenceTriageResult {
  /** False if this isn't actually a conference/summit/symposium (e.g. it's
   *  a course-promo email, a generic newsletter, an unrelated webinar). */
  isConference: boolean;
  /** When isConference=false, why we skipped (logged for audit). */
  skipReason?: string;
  /** Conference name as it should appear in the tile. */
  conferenceName: string;
  /** EventType matching the existing CrmEvent enum. */
  type:
    | "Conference"
    | "Summit"
    | "Trade Show"
    | "Academic Conference"
    | "Awards / Ceremony"
    | "Network Event";
  /** Date range — null if unknown. */
  eventDates: { start: string; end: string | null } | null;
  /** Multi-deadline list (CFP, abstract revision, early-bird, etc.). */
  deadlines: ConferenceDeadline[];
  /** City + country, free-text. */
  location: string;
  /** Estimated attendance from the page if mentioned, else "". */
  estAttendance: string;
  /** Registration cost from the page if mentioned, else "". */
  registrationCost: string;
  /** WV fit score — high/medium/low/TBD per WV_PROFILE. */
  fitScore: WvFitScore;
  /** 2-3 sentences: why this matches/doesn't match w.v's expertise zones. */
  whyItMatters: string;
  /** 1-2 sentence rationale for the fit score (separate from whyItMatters
   *  which is more outward-facing description). */
  decisionNotes: string;
  /** Public conference URL. */
  url: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

// ── enum constants (mirrors lib/notion/types.ts) ──────────

const VALID_EVENT_TYPES = [
  "Conference",
  "Summit",
  "Trade Show",
  "Academic Conference",
  "Awards / Ceremony",
  "Network Event",
] as const;

const VALID_FIT_SCORES = ["high fit", "medium fit", "low fit", "TBD"] as const;

const VALID_DEADLINE_KINDS = [
  "cfp_close",
  "abstract_revision",
  "early_bird",
  "hotel_block",
  "sponsorship_commitment",
  "registration",
  "other",
] as const;

// ── helpers ───────────────────────────────────────────────

/** Strip HTML, collapse whitespace, cap at 3 000 chars. Lifted from rfp-triage. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
}

// ── main ──────────────────────────────────────────────────

export async function triageConference(
  input: ConferenceTriageInput,
): Promise<ConferenceTriageResult> {
  const cleanBody = stripHtml(input.body);

  const systemPrompt = `You are an AI triage agent helping winded.vertigo (w.v) decide
which conferences to put on the radar.

${WV_PROFILE}

Your task: given a conference page or announcement, determine:
1. Is this actually a conference/summit/symposium/workshop event? (Reject
   pure marketing emails, generic newsletters, unrelated webinars, single
   training courses.)
2. If yes, score how well it fits w.v's domains and extract structured fields.

Return STRICT JSON with EXACTLY these keys:
{
  "isConference": boolean,
  "skipReason": string | null,
  "conferenceName": string,
  "type": one of ${JSON.stringify(VALID_EVENT_TYPES)},
  "eventDates": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" | null } | null,
  "deadlines": [
    { "kind": one of ${JSON.stringify(VALID_DEADLINE_KINDS)}, "date": "YYYY-MM-DD", "label": "..." }
  ],
  "location": string,
  "estAttendance": string,
  "registrationCost": string,
  "fitScore": one of ${JSON.stringify(VALID_FIT_SCORES)},
  "whyItMatters": string,
  "decisionNotes": string,
  "url": string
}

Fit scoring guide:
- high fit: core w.v domain (learning design, curriculum, MEL, play research,
  educator PD, dashboards/ed-tech) AND a sector w.v works in (international
  development, education ministries, foundations, ESG/responsible-business,
  EdTech). Conference of 200+ attendees in those zones.
- medium fit: adjacent capabilities or sectors. Could justify attending for
  networking even if not core. Smaller meetings, niche academic conferences
  in adjacent disciplines.
- low fit: technically tangential, would be a stretch to defend attending or
  contributing. Generic edtech with no learning-science foundation, pure
  technology conferences, conferences in NOT-A-FIT sectors.
- TBD: genuine conference but page is too sparse to score yet.

Deadlines: extract every deadline you find on the page — CFP open/close,
abstract revisions, early-bird registration, hotel block close, sponsorship
commitment, regular registration. Use 'other' kind for anything that doesn't
fit a listed kind.`;

  const userMessage = `Source: ${input.discoveredVia}
URL: ${input.url ?? "not provided"}
Title: ${input.title}

Content:
${cleanBody}`;

  const result = await callClaude({
    feature: "conference-triage",
    system: systemPrompt,
    userMessage,
    userId: "automation",
    maxTokens: 1200,
    temperature: 0.1,
  });

  type TriageJson = Omit<ConferenceTriageResult, "usage">;
  const parsed = parseJsonResponse<TriageJson>(result.text);

  return {
    ...parsed,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  };
}
