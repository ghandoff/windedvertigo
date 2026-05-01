/**
 * POST /api/activities/summarize
 *
 * Takes raw meeting notes and returns a structured AI summary:
 * - description: one-line meeting title/summary
 * - notes: formatted bullet-point summary
 * - outcome: suggested outcome value
 */

import { NextRequest } from "next/server";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { json, error } from "@/lib/api-helpers";

interface SummarizeRequest {
  rawNotes: string;
  orgName?: string;
  contactName?: string;
}

interface SummarizeResult {
  description: string;
  notes: string;
  outcome: "positive" | "neutral" | "no response" | "declined";
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SummarizeRequest;
  if (!body.rawNotes?.trim()) {
    return error("rawNotes is required", 400);
  }

  const context = [
    body.orgName && `Organization: ${body.orgName}`,
    body.contactName && `Contact: ${body.contactName}`,
  ]
    .filter(Boolean)
    .join("\n");

  const result = await callClaude({
    feature: "relationship-score",
    system: `You summarize meeting notes for a learning design consultancy's port. Be concise and professional. Return only valid JSON.`,
    userMessage: `Summarize these meeting notes into structured port data.

${context ? `Context:\n${context}\n\n` : ""}Raw notes:
${body.rawNotes}

Return JSON:
{
  "description": "one-line title like 'discovery call with Maria re: curriculum project'",
  "notes": "3-5 bullet points: • key topic\\n• commitment or next step\\n• etc.",
  "outcome": "positive | neutral | no response | declined"
}`,
    userId: "user",
    maxTokens: 400,
    temperature: 0.2,
  });

  try {
    const parsed = parseJsonResponse<SummarizeResult>(result.text);
    return json(parsed);
  } catch {
    return error("failed to parse AI response", 500);
  }
}
