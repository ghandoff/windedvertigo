/**
 * Natural language search — converts plain English queries into
 * structured CRM filters and returns matching results.
 */

import { callClaude } from "./client";
import { queryContacts } from "../notion/contacts";
import { queryOrganizations } from "../notion/organizations";
import type { NlSearchRequest, NlSearchResponse } from "./types";

const FILTER_SCHEMA = `You translate natural language CRM queries into structured filters.

Available contact filters:
- contactType: "decision maker" | "program officer" | "collaborator" | "referral source" | "team member" | "manager" | "ceo" | "consultant"
- contactWarmth: "cold" | "lukewarm" | "warm" | "hot"
- responsiveness: "very responsive" | "usually responsive" | "slow to respond" | "non-responsive"
- relationshipStage: "stranger" | "introduced" | "in conversation" | "warm connection" | "active collaborator" | "inner circle"
- referralPotential: true | false
- search: text search on name

Available organization filters:
- connection: "unengaged" | "exploring" | "in progress" | "collaborating" | "champion" | "steward" | "past client"
- outreachStatus: "Not started" | "Researching" | "Contacted" | "In conversation" | "Proposal sent" | "Active client"
- type: "ngo" | "studio" | "corporate" | "non-profit" | "foundation" | "government" | "individual donor" | "consultancy/firm" | "academic institution"
- category: "arts & culture" | "community development" | "corporate training" | "education & learning" | "healthcare & wellbeing" | "international development" | "social innovation" | "sustainability & environment" | "technology & innovation" | "youth development"
- region: "asia" | "global" | "europe" | "north america" | "africa"
- priority: "Tier 1 – Pursue now" | "Tier 2 – Warm up" | "Tier 3 – Monitor"
- fitRating: "🔥 Perfect fit" | "✅ Strong fit" | "🟡 Moderate fit"
- friendship: "Inner circle" | "Warm friend" | "Friendly contact" | "Loose tie" | "Known-of / name in common" | "Stranger"
- quadrant: "Design + Deploy" | "Pinpoint + Prove" | "Build + Iterate" | "Test + Validate"
- search: text search on organization name

Output ONLY valid JSON with this shape:
{
  "contacts": { ...filter fields or null if not relevant },
  "organizations": { ...filter fields or null if not relevant },
  "explanation": "brief description of what the query translates to"
}`;

export async function naturalLanguageSearch(
  req: NlSearchRequest,
  userId: string,
): Promise<NlSearchResponse> {
  const result = await callClaude({
    feature: "nl-search",
    system: FILTER_SCHEMA,
    userMessage: req.query,
    userId,
    maxTokens: 512,
    temperature: 0.2,
  });

  const parsed = JSON.parse(result.text);

  const response: NlSearchResponse = {
    filters: {
      contacts: parsed.contacts,
      organizations: parsed.organizations,
      explanation: parsed.explanation,
    },
    results: {
      contacts: [],
      organizations: [],
    },
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  };

  // Execute the parsed filters
  const scope = req.scope ?? ["contacts", "organizations"];

  if (scope.includes("contacts") && parsed.contacts) {
    const contactResults = await queryContacts(parsed.contacts, { pageSize: 20 });
    response.results.contacts = contactResults.data.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      role: c.role,
      contactType: c.contactType,
      contactWarmth: c.contactWarmth,
      relationshipStage: c.relationshipStage,
    }));
  }

  if (scope.includes("organizations") && parsed.organizations) {
    const orgResults = await queryOrganizations(parsed.organizations, { pageSize: 20 });
    response.results.organizations = orgResults.data.map((o) => ({
      id: o.id,
      organization: o.organization,
      connection: o.connection,
      priority: o.priority,
      fitRating: o.fitRating,
      outreachStatus: o.outreachStatus,
    }));
  }

  return response;
}
