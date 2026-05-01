/**
 * Relationship health scoring — analyzes activity patterns
 * to score the health of contact relationships.
 */

import { callClaude, parseJsonResponse } from "./client";
import { queryContacts } from "../notion/contacts";
import { queryActivities } from "../notion/activities";
import type { RelationshipScore, RelationshipScoreResponse } from "./types";

export async function scoreRelationships(
  userId: string,
  contactIds?: string[],
): Promise<RelationshipScoreResponse> {
  // Fetch contacts (specific IDs or top 20 most recently edited)
  let contacts;
  if (contactIds?.length) {
    const { getContact } = await import("../notion/contacts");
    contacts = await Promise.all(contactIds.map((id) => getContact(id)));
  } else {
    const result = await queryContacts(undefined, { pageSize: 20 });
    contacts = result.data;
  }

  // Fetch recent activities for scoring context
  const activities = await queryActivities(undefined, { pageSize: 100 });
  const allActivities = activities.data;

  // Build a context string for Claude to analyze
  const now = new Date();
  const contactSummaries = contacts.map((c) => {
    const contactActivities = allActivities.filter((a) =>
      a.contactIds.includes(c.id),
    );
    const lastActivity = contactActivities[0];
    const lastDate = lastActivity?.date?.start;
    const daysSince = lastDate
      ? Math.floor((now.getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    return {
      id: c.id,
      name: c.name,
      warmth: c.contactWarmth,
      stage: c.relationshipStage,
      responsiveness: c.responsiveness,
      activityCount: contactActivities.length,
      daysSinceContact: daysSince,
      lastActivityDate: lastDate || null,
      recentOutcomes: contactActivities.slice(0, 5).map((a) => a.outcome),
      activityTypes: contactActivities.slice(0, 5).map((a) => a.type),
    };
  });

  const system = `You are a port relationship health analyst. Score each contact's relationship health from 0-100 and identify the trend.

Scoring guidelines:
- 90-100: Inner circle, frequent positive interactions, highly engaged
- 70-89: Strong relationship, regular contact, mostly positive outcomes
- 50-69: Moderate, some engagement but could be warmer
- 30-49: Cooling off, infrequent contact, mixed outcomes
- 0-29: At risk, no recent contact or negative outcomes

Trend categories:
- "improving": activity increasing, outcomes getting better
- "stable": consistent engagement
- "declining": activity dropping off, longer gaps
- "at-risk": very low activity or negative pattern

Output ONLY valid JSON array where each element has:
{ "id": "contact-id", "score": number, "trend": string, "factors": ["reason1", "reason2"] }`;

  const result = await callClaude({
    feature: "relationship-score",
    system,
    userMessage: JSON.stringify(contactSummaries),
    userId,
    maxTokens: 2048,
    temperature: 0.3,
  });

  const parsed = parseJsonResponse<
    Array<{ id: string; score: number; trend: string; factors: string[] }>
  >(result.text);

  const validTrends = new Set(["improving", "stable", "declining", "at-risk"]);

  const scores: RelationshipScore[] = (Array.isArray(parsed) ? parsed : []).map((p) => {
    const summary = contactSummaries.find((c) => c.id === p.id);
    return {
      contactId: p.id,
      contactName: summary?.name ?? "Unknown",
      score: typeof p.score === "number" ? p.score : 50,
      trend: (validTrends.has(p.trend) ? p.trend : "stable") as RelationshipScore["trend"],
      factors: Array.isArray(p.factors) ? p.factors : [],
      lastActivityDate: summary?.lastActivityDate ?? null,
      daysSinceContact: summary?.daysSinceContact ?? 999,
      activityCount: summary?.activityCount ?? 0,
    };
  });

  return {
    scores,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  };
}
