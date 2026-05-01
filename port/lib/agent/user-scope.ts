/**
 * Static per-user scope configuration.
 *
 * For Week 2 with 2–3 users, a typed constant is the right call — no DB
 * lookup, no env vars per user, no failure mode. Each entry declares the
 * member's email, which agent tools they can call, and the Notion DBs
 * those tools may target.
 *
 * When scopes become dynamic (many members, roles, teams), swap this for
 * a `getActiveMembers()` call against `port/lib/notion/members.ts`. The
 * `getUserScope()` signature should remain the same.
 */

import { PORT_DB } from "@/lib/notion/client";
import type { UserScope } from "./types";

/**
 * Payton's personal "social media campaign planning" Notion data source.
 * Distinct from the port's campaigns DB — see
 * reference_payton_notion_dashboard.md in session memory.
 */
const PAYTON_SOCIAL_PLAN_DB_ID = "bff43765-0934-420a-ab21-d40b4b7ea3e6";

const USER_SCOPES: Record<string, UserScope> = {
  "garrett@windedvertigo.com": {
    authEmail: "garrett@windedvertigo.com",
    displayName: "Garrett",
    // Week 3: logActivity + confirmAction. Week 4: queryActivities.
    // Week 5: updateCampaignStatus. Week 6: updateOrganization.
    // Week 7: createCampaign + updateContact.
    allowedTools: [
      "queryCampaigns",
      "getOrganization",
      "queryActivities",
      "queryContacts",
      "queryDeals",
      "logActivity",
      "confirmAction",
      "updateCampaignStatus",
      "updateOrganization",
      "createCampaign",
      "updateContact",
      "createOrganization",
      "queryRfpOpportunities",
      "queryProjects",
      "updateDeal",
      "queryTimesheets",
      "queryWorkItems",
      "queryEvents",
      "queryMembers",
      "logTimeEntry",
    ],
    notionContext: {
      campaignsDbId: PORT_DB.campaigns,
      socialPlanDbId: null,
      organizationsDbId: PORT_DB.organizations,
      contactsDbId: PORT_DB.contacts,
    },
  },
  "payton@windedvertigo.com": {
    authEmail: "payton@windedvertigo.com",
    displayName: "Payton",
    allowedTools: ["queryPaytonSocialPlan"],
    notionContext: {
      campaignsDbId: null,
      socialPlanDbId: PAYTON_SOCIAL_PLAN_DB_ID,
      organizationsDbId: null,
      contactsDbId: null,
    },
  },
  // Week 4: Maria — operations lead, IDB Salvador, stakeholder coordination.
  // Same BD tool surface as Garrett; no access to Payton's social plan DB.
  "maria@windedvertigo.com": {
    authEmail: "maria@windedvertigo.com",
    displayName: "Maria",
    allowedTools: [
      "queryCampaigns",
      "getOrganization",
      "queryActivities",
      "queryContacts",
      "queryDeals",
      "logActivity",
      "confirmAction",
      "updateCampaignStatus",
      "updateOrganization",
      "createCampaign",
      "updateContact",
      "createOrganization",
      "queryRfpOpportunities",
      "queryProjects",
      "updateDeal",
      "queryTimesheets",
      "queryWorkItems",
      "queryEvents",
      "queryMembers",
      "logTimeEntry",
    ],
    notionContext: {
      campaignsDbId: PORT_DB.campaigns,
      socialPlanDbId: null,
      organizationsDbId: PORT_DB.organizations,
      contactsDbId: PORT_DB.contacts,
    },
  },
};

/** Returns the user's scope or null if the email is not whitelisted. */
export function getUserScope(email: string): UserScope | null {
  return USER_SCOPES[email.toLowerCase()] ?? null;
}

/** Exposed for tests + debugging only — don't iterate in production paths. */
export function __getAllScopesForTest(): Record<string, UserScope> {
  return { ...USER_SCOPES };
}
