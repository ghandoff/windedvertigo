/**
 * Next-best-action recommendations — suggests who to follow up
 * with and what action to take, based on CRM data.
 */

import { callClaude, parseJsonResponse } from "./client";
import { queryContacts } from "../notion/contacts";
import { queryOrganizations } from "../notion/organizations";
import { queryActivities } from "../notion/activities";
import type { NextAction, NextActionResponse } from "./types";

export async function getNextBestActions(
  userId: string,
  limit?: number,
): Promise<NextActionResponse> {
  // Fetch recent data for analysis
  const [contacts, orgs, activities] = await Promise.all([
    queryContacts(undefined, { pageSize: 50 }),
    queryOrganizations(undefined, { pageSize: 50 }),
    queryActivities(undefined, { pageSize: 100 }),
  ]);

  const now = new Date();

  // Build org lookup
  const orgMap = new Map(orgs.data.map((o) => [o.id, o]));

  // Build contact summaries with org context
  const contactSummaries = contacts.data.map((c) => {
    const contactActivities = activities.data.filter((a) =>
      a.contactIds.includes(c.id),
    );
    const lastActivity = contactActivities[0];
    const lastDate = lastActivity?.date?.start;
    const daysSince = lastDate
      ? Math.floor(
          (now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24),
        )
      : 999;

    const linkedOrgs = c.organizationIds
      .map((id) => orgMap.get(id))
      .filter(Boolean);

    return {
      contactId: c.id,
      contactName: c.name,
      warmth: c.contactWarmth,
      stage: c.relationshipStage,
      responsiveness: c.responsiveness,
      nextAction: c.nextAction,
      daysSinceContact: daysSince,
      lastOutcome: lastActivity?.outcome,
      lastActivityType: lastActivity?.type,
      organizations: linkedOrgs.map((o) => ({
        id: o!.id,
        name: o!.organization,
        priority: o!.priority,
        connection: o!.connection,
        outreachStatus: o!.outreachStatus,
        fitRating: o!.fitRating,
      })),
    };
  });

  // Also include orgs with no contacts that need attention
  const orgSummaries = orgs.data
    .filter((o) => o.contactIds.length === 0 && o.priority)
    .map((o) => ({
      organizationId: o.id,
      organizationName: o.organization,
      priority: o.priority,
      connection: o.connection,
      outreachStatus: o.outreachStatus,
      fitRating: o.fitRating,
      outreachSuggestion: o.outreachSuggestion,
    }));

  const system = `You are a strategic business development advisor for winded vertigo (w.v.), a learning design consultancy. Analyze CRM data and recommend the most impactful next actions.

Prioritize:
1. High-priority contacts/orgs that haven't been contacted recently
2. Warm relationships that could be deepened
3. Positive recent interactions that should be followed up
4. Contacts with explicit "next action" notes
5. High-fit organizations that need initial outreach

For each recommendation include:
- Who to contact (contact or org)
- What action to take
- Why this matters now
- Priority (high/medium/low)
- Suggested timing (ISO date)
- Best channel (email/call/meeting/linkedin/other)

Output ONLY valid JSON array of objects:
[{
  "contactId": "id or null",
  "contactName": "name or null",
  "organizationId": "id or null",
  "organizationName": "name or null",
  "action": "specific action description",
  "reason": "why now",
  "priority": "high|medium|low",
  "suggestedDate": "YYYY-MM-DD",
  "channel": "email|call|meeting|linkedin|other"
}]

Return at most ${limit ?? 10} recommendations, sorted by priority.`;

  const result = await callClaude({
    feature: "next-best-action",
    system,
    userMessage: JSON.stringify({ contacts: contactSummaries, orgsWithoutContacts: orgSummaries }),
    userId,
    maxTokens: 2048,
    temperature: 0.5,
  });

  const parsed = parseJsonResponse<NextAction[]>(result.text);

  return {
    actions: Array.isArray(parsed) ? parsed : [],
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  };
}
