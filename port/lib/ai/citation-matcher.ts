/**
 * Citation relevance matching — selects bibliography entries relevant to a
 * given RFP topic using a fast Haiku call, before the full proposal generation.
 *
 * This keeps the expensive Sonnet proposal call focused: it receives only the
 * 8–12 most relevant citations rather than the full ~200-entry bibliography.
 */

import { callClaude, parseJsonResponse } from "./client";
import type { RfpOpportunity, BibliographyEntry } from "@/lib/notion/types";

interface MatchCitationsInput {
  rfp: RfpOpportunity;
  allCitations: BibliographyEntry[];
  userId: string;
}

const SYSTEM_PROMPT = `You are a research librarian for winded.vertigo — a learning design consultancy.
Given an RFP opportunity and a list of bibliography entries, select the 5–10 most relevant citations.

Relevance criteria:
- Methodological fit: citations that justify the proposed evaluation approach, learning design method, or capacity building model
- Topical alignment: citations on the subject matter the client cares about (e.g., SEL, MEL, competency-based learning, etc.)
- Credibility markers: high citation counts, peer-reviewed, or from authoritative bodies (UN, OECD, World Bank, etc.)
- Recency: prefer sources from the last 10 years unless the older source is seminal

Output ONLY valid JSON:
{
  "selectedCitations": ["full citation string 1", "full citation string 2", ...]
}

Select 5–10 entries. If fewer than 5 are clearly relevant, return only the clearly relevant ones. Never select a citation that has no clear connection to the RFP topic.`;

export async function matchCitations({
  rfp,
  allCitations,
  userId,
}: MatchCitationsInput): Promise<BibliographyEntry[]> {
  if (allCitations.length === 0) return [];

  const payload = {
    rfp: {
      name: rfp.opportunityName,
      type: rfp.opportunityType,
      serviceMatch: rfp.serviceMatch,
      category: rfp.category,
      requirementsSnapshot: rfp.requirementsSnapshot?.slice(0, 1000) ?? null,
    },
    citations: allCitations.map((c) => ({
      fullCitation: c.fullCitation,
      topic: c.topic,
      sourceType: c.sourceType,
      abstract: c.abstract?.slice(0, 200) ?? null,
      citationCount: c.citationCount,
      year: c.year,
    })),
  };

  const result = await callClaude({
    feature: "citation-matching",
    system: SYSTEM_PROMPT,
    userMessage: JSON.stringify(payload),
    userId,
    maxTokens: 512,
    temperature: 0,
  });

  const parsed = parseJsonResponse<{ selectedCitations: string[] }>(result.text);
  const selectedTitles = new Set(parsed.selectedCitations ?? []);

  // Match back to full BibliographyEntry objects by full citation string
  return allCitations.filter((c) => selectedTitles.has(c.fullCitation));
}
