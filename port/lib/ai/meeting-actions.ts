/**
 * AI meeting notes → action items extraction.
 * Paste a transcript or meeting notes, get structured tasks with owners and deadlines.
 */

import { callClaude, parseJsonResponse } from "./client";

export interface ExtractedAction {
  title: string;
  owner: string;
  deadline: string | null; // ISO date string or null
  type: "plan" | "implement" | "coordinate" | "review" | "admin";
  priority: "low" | "medium" | "high";
  context: string; // brief context from the meeting
}

interface MeetingActionsResult {
  actions: ExtractedAction[];
  meetingSummary: string;
  usage: { inputTokens: number; outputTokens: number; costUsd: number };
}

const SYSTEM_PROMPT = `You are extracting action items from meeting notes for winded.vertigo, a learning design collective.

Given meeting notes or a transcript, extract concrete action items. For each action:
- title: concise task description (lowercase)
- owner: person's first name (extract from context, or "unassigned" if unclear)
- deadline: ISO date string if mentioned (e.g. "2026-04-15"), null if not specified
- type: one of: plan, implement, coordinate, review, admin
- priority: low, medium, or high (infer from urgency cues in the conversation)
- context: 1 sentence of relevant context from the meeting

Also provide a 2-3 sentence summary of the meeting.

Output ONLY valid JSON:
{
  "actions": [...],
  "meetingSummary": "..."
}

Guidelines:
- Only extract items that are clearly actionable (not discussion points or FYIs)
- Use first names only for owners
- If a deadline is relative ("by Friday", "next week"), convert to an absolute date based on today
- Skip actions that are already marked as done in the notes`;

export async function extractMeetingActions(
  notes: string,
  userId: string,
): Promise<MeetingActionsResult> {
  const today = new Date().toISOString().split("T")[0];

  const result = await callClaude({
    feature: "meeting-actions",
    system: SYSTEM_PROMPT,
    userMessage: `Today's date: ${today}\n\nMeeting notes:\n${notes}`,
    userId,
    maxTokens: 1536,
    temperature: 0.2,
  });

  const parsed = parseJsonResponse<{ actions: ExtractedAction[]; meetingSummary: string }>(result.text);

  return {
    actions: parsed.actions,
    meetingSummary: parsed.meetingSummary,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  };
}
