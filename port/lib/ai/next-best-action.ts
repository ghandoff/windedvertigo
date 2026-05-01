/**
 * Next-best-action recommendations — suggests who to follow up
 * with and what action to take, based on port data.
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
    queryContacts(undefined, { pageSize: 100 }),
    queryOrganizations(undefined, { pageSize: 100 }),
    queryActivities(undefined, { pageSize: 200 }),
  ]);

  const now = new Date();

  // Build org lookup
  const orgMap = new Map(orgs.data.map((o) => [o.id, o]));

  // Build compact contact summaries — derive signals from activities rather than
  // passing raw activity records, keeping the prompt payload small.
  const contactSummaries = contacts.data
    .map((c) => {
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
        nextAction: c.nextAction || undefined,
        daysSinceContact: daysSince,
        lastOutcome: lastActivity?.outcome,
        lastActivityType: lastActivity?.type,
        // Only include the top linked org to keep payload compact
        org: linkedOrgs[0] ? {
          id: linkedOrgs[0]!.id,
          name: linkedOrgs[0]!.organization,
          relationship: linkedOrgs[0]!.relationship,
          derivedPriority: linkedOrgs[0]!.derivedPriority,
          fitRating: linkedOrgs[0]!.fitRating,
        } : undefined,
      };
    })
    // Sort by urgency: warm contacts not recently reached first
    .sort((a, b) => {
      const warmthScore = (w: string | null) =>
        w === "hot" ? 3 : w === "warm" ? 2 : w === "lukewarm" ? 1 : 0;
      const urgency = (c: typeof a) =>
        warmthScore(c.warmth ?? null) * 1000 - (c.daysSinceContact ?? 999);
      return urgency(b) - urgency(a);
    })
    // Cap at 30 to keep the prompt well within token limits
    .slice(0, 30);

  // Orgs with no contacts that need attention — trim outreachSuggestion to 100 chars
  const orgSummaries = orgs.data
    .filter((o) => o.contactIds.length === 0 && o.derivedPriority !== "tier 3")
    .slice(0, 20)
    .map((o) => ({
      organizationId: o.id,
      organizationName: o.organization,
      relationship: o.relationship,
      derivedPriority: o.derivedPriority,
      fitRating: o.fitRating,
      outreachSuggestion: o.outreachSuggestion?.slice(0, 100) || undefined,
    }));

  const system = `You are a strategic business development advisor for winded vertigo (w.v.), a learning design consultancy. Analyze port data and recommend the most impactful next actions.

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
