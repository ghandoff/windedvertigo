/**
 * AI email drafting — generates personalized outreach emails
 * using contact + organization context from the CRM.
 */

import { callClaude } from "./client";
import { getOrganization } from "../notion/organizations";
import { getContact } from "../notion/contacts";
import { getActivitiesForOrg } from "../notion/activities";
import type { EmailDraftRequest, EmailDraftResponse } from "./types";

export async function generateEmailDraft(
  req: EmailDraftRequest,
  userId: string,
): Promise<EmailDraftResponse> {
  // Gather CRM context
  const org = await getOrganization(req.organizationId);

  let contactContext = "";
  if (req.contactId) {
    const contact = await getContact(req.contactId);
    contactContext = `
Contact: ${contact.name}
Role: ${contact.role || "unknown"}
Type: ${contact.contactType || "unknown"}
Warmth: ${contact.contactWarmth || "unknown"}
Relationship stage: ${contact.relationshipStage || "unknown"}
Responsiveness: ${contact.responsiveness || "unknown"}`;
  }

  // Get recent activity for relationship context
  const activities = await getActivitiesForOrg(req.organizationId);
  const recentActivities = activities.data.slice(0, 5);
  const activitySummary = recentActivities.length > 0
    ? recentActivities
        .map((a) => `- ${a.type}: ${a.activity} (${a.outcome || "no outcome"}, ${a.date?.start || "no date"})`)
        .join("\n")
    : "No previous activities logged.";

  const system = `You are an expert business development writer for winded vertigo (w.v.), a design consultancy that specializes in learning design, MEL (monitoring, evaluation & learning), curriculum design, play-based learning, and professional development.

Write emails that are:
- Genuine and human — not salesy or corporate
- Concise — 3-5 short paragraphs max
- Contextual — reference the org's work and how w.v. can add value
- Action-oriented — end with a clear, low-pressure next step

Output ONLY valid JSON with two fields: "subject" (string) and "body" (string).
Use \\n for line breaks in the body. Do not include any markdown or explanation.`;

  const userMessage = `Draft a ${req.purpose || "intro"} email with a ${req.tone || "warm"} tone.

Organization: ${org.organization}
Type: ${org.type || "unknown"}
Category: ${org.category?.join(", ") || "unknown"}
Connection status: ${org.connection}
Priority: ${org.priority || "unset"}
Fit rating: ${org.fitRating || "unset"}
Friendship level: ${org.friendship || "unknown"}
How they buy: ${org.howTheyBuy || "unknown"}
Outreach suggestion: ${org.outreachSuggestion || "none"}
Target services: ${org.targetServices || "unknown"}
Buying trigger: ${org.buyingTrigger || "unknown"}
Buyer role: ${org.buyerRole || "unknown"}
${contactContext}

Recent activity history:
${activitySummary}

${req.additionalContext ? `Additional context: ${req.additionalContext}` : ""}
${req.senderName ? `Sign off as: ${req.senderName}` : "Sign off as the w.v. team"}`;

  const result = await callClaude({
    feature: "email-draft",
    system,
    userMessage,
    userId,
    maxTokens: 1024,
    temperature: 0.7,
  });

  const parsed = JSON.parse(result.text);

  return {
    subject: parsed.subject,
    body: parsed.body,
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  };
}
