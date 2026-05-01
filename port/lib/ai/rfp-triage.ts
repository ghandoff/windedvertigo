/**
 * RFP triage — AI-powered opportunity scoring and extraction.
 *
 * Given raw email or RSS content, Claude Haiku evaluates whether it's a
 * genuine procurement opportunity and scores it against winded.vertigo's
 * capabilities. Runs on every inbound signal so cost control is critical —
 * we use Haiku and cap input at 3 000 chars after HTML-stripping.
 */

import { callClaude, parseJsonResponse } from "./client";
import type { RfpOpportunity, RfpSource } from "@/lib/notion/types";

// ── input / output types ──────────────────────────────────

export interface RfpTriageInput {
  title: string;
  /** Raw email body or RSS HTML — will be stripped and truncated internally. */
  body: string;
  url?: string;
  source: RfpSource;
}

export interface RfpTriageResult {
  /** False if this is a newsletter, spam, or non-procurement content. */
  isOpportunity: boolean;
  skipReason?: string;
  opportunityName: string;
  opportunityType: RfpOpportunity["opportunityType"];
  wvFitScore: RfpOpportunity["wvFitScore"];
  serviceMatch: RfpOpportunity["serviceMatch"];
  category: string[];
  geography: string[];
  /** USD contract value, if mentioned in the content. */
  estimatedValue?: number;
  /** Submission/proposal deadline in YYYY-MM-DD format, if found. */
  dueDate?: string;
  /** 2–3 sentence summary of what work is being procured. */
  requirementsSnapshot: string;
  /** 1–2 sentence rationale for the fit score. */
  decisionNotes: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

// ── winded.vertigo capability profile ────────────────────

const WV_PROFILE = `
winded.vertigo (w.v) is a boutique learning design consultancy, San Francisco CA.
Founder: Garrett Jaeger. Small team (~5 people). Works globally.

CORE CAPABILITIES (strongest fit):
- Curriculum Design
- Learning Design
- MEL & Evaluation (Monitoring, Evaluation & Learning frameworks)
- Professional Learning & Professional Development
- Play-Based Learning
- Assessment & Research
- Facilitation (workshops, community learning events)
- Dashboards & Tech (learning analytics, evidence dashboards, ed-tech product)
- Strategic Planning

KEY SECTORS (strongest fit):
- International development organisations (UN agencies, IDB, World Bank, USAID, FCDO, etc.)
- Education ministries and government agencies
- Large NGOs and foundations (Gates, Bloomberg Philanthropies, Mastercard Foundation)
- Responsible business / ESG training programmes (e.g. PRME, UN Global Compact)
- EdTech companies needing pedagogy or curriculum expertise

SWEET SPOT:
- Contract size: USD 50k–500k (smaller if highly strategic)
- Geographies: global focus; depth in Latin America & Caribbean, Sub-Saharan Africa, North America
- Languages: English, Spanish-language markets

NOT A FIT (mark low fit or skip if primary focus):
- Pure IT infrastructure, hardware procurement
- Construction / civil works
- Healthcare delivery (clinical, non-learning components)
- Legal or accounting services
- Generic marketing/PR agencies

CURRENT ACTIVE CLIENTS (for context): PRME / UN Global Compact, IDB (El Salvador),
UNICEF, Sesame Workshop, LEGO / Learning Economy Foundation
`.trim();

// ── enum constants (mirrors lib/notion/types.ts) ─────────

const VALID_OPPORTUNITY_TYPES = [
  "RFP", "RFQ", "RFI", "Grant", "EOI",
  "Cold Lead", "Warm Intro", "Conference Contact", "Direct Outreach",
] as const;

const VALID_FIT_SCORES = ["high fit", "medium fit", "low fit", "TBD"] as const;

const VALID_SERVICE_MATCHES = [
  "MEL & Evaluation",
  "Curriculum Design",
  "Play-Based Learning",
  "Professional Learning & PD",
  "Learning Design",
  "Assessment & Research",
  "Facilitation",
  "Dashboards & Tech",
  "Strategic Planning",
] as const;

// ── helpers ───────────────────────────────────────────────

/** Strip HTML tags and common entities, collapse whitespace, cap at 3 000 chars. */
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

// ── main function ─────────────────────────────────────────

export async function triageRfpOpportunity(
  input: RfpTriageInput,
): Promise<RfpTriageResult> {
  const cleanBody = stripHtml(input.body);

  const systemPrompt = `You are an opportunity triage specialist for winded.vertigo (w.v).

${WV_PROFILE}

Your task: analyse incoming content (emails or RSS articles) and determine:
1. Is this a genuine procurement opportunity (RFP, grant, contract, EOI, call for proposals)?
   - YES if: an organisation is soliciting bids or proposals for services
   - NO if: newsletter, promotional/marketing content, job posting, general news article,
     or content that references RFPs in passing but is not itself an opportunity

2. If YES: score fit against w.v's capabilities and extract structured fields.

Return ONLY valid JSON — no prose, no markdown fences — matching this exact schema:
{
  "isOpportunity": boolean,
  "skipReason": string or null,
  "opportunityName": string (clean concise title, max 80 chars),
  "opportunityType": one of ${JSON.stringify(VALID_OPPORTUNITY_TYPES)},
  "wvFitScore": one of ${JSON.stringify(VALID_FIT_SCORES)},
  "serviceMatch": array from ${JSON.stringify(VALID_SERVICE_MATCHES)},
  "category": string array (e.g. ["Education Technology", "International Development"]),
  "geography": string array (e.g. ["Latin America", "Global"]),
  "estimatedValue": number in USD or null,
  "dueDate": "YYYY-MM-DD" or null,
  "requirementsSnapshot": string (2–3 sentences: what work is sought),
  "decisionNotes": string (1–2 sentences: why this fit score)
}

Fit scoring guide:
- high fit: core learning design / curriculum / MEL work for an international dev org,
  foundation, education ministry, or EdTech company in w.v's sectors, $50k–$500k range
- medium fit: adjacent capabilities (facilitation, strategic planning, assessment) OR
  sectors slightly outside core but plausible
- low fit: technically w.v could respond but it's a stretch; outside sectors or capabilities
- TBD: genuine opportunity but not enough info to score yet`;

  const userMessage = `Source: ${input.source}
URL: ${input.url ?? "not provided"}
Title: ${input.title}

Content:
${cleanBody}`;

  const result = await callClaude({
    feature: "rfp-triage",
    system: systemPrompt,
    userMessage,
    userId: "automation",
    maxTokens: 800,
    temperature: 0.1, // low temp for consistent structured extraction
  });

  type TriageJson = Omit<RfpTriageResult, "usage">;
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
