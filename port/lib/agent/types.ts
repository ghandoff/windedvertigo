/**
 * Shared types for the port agent (Slack → Claude → Notion tools).
 *
 * Kept intentionally small — each feature adds its own narrower types.
 */

/**
 * Tool names the agent can invoke.
 * Week 2: 3 read-only tools. Week 3: logActivity + confirmAction.
 * Week 4: queryActivities. Week 5: updateCampaignStatus.
 * Week 6: updateOrganization. Week 7: createCampaign + createOrganization + updateContact.
 * Phase C: queryRfpOpportunities + queryProjects + updateDeal.
 * Phase D: queryTimesheets + queryWorkItems + queryEvents + queryMembers + logTimeEntry.
 */
export type AgentToolName =
  | "queryCampaigns"
  | "getOrganization"
  | "queryPaytonSocialPlan"
  | "logActivity"
  | "confirmAction"
  | "queryActivities"
  | "queryContacts"
  | "queryDeals"
  | "updateCampaignStatus"
  | "updateOrganization"
  | "createCampaign"
  | "updateContact"
  | "createOrganization"
  | "queryRfpOpportunities"
  | "queryProjects"
  | "updateDeal"
  | "queryTimesheets"
  | "queryWorkItems"
  | "queryEvents"
  | "queryMembers"
  | "logTimeEntry";

/**
 * A write action that has been staged but not yet executed. Stored in
 * the per-user pending store; the user must confirm before execution.
 * Discriminated on `type` — add a new variant per new write tool.
 */
export type PendingAction =
  | LogActivityPending
  | UpdateCampaignStatusPending
  | UpdateOrganizationPending
  | CreateCampaignPending
  | UpdateContactPending
  | CreateOrganizationPending
  | UpdateDealPending
  | LogTimeEntryPending;

export interface LogActivityPending {
  type: "logActivity";
  payload: {
    activity: string;
    activityType: string;
    organizationIds: string[];
    contactIds: string[];
    notes: string;
    outcome: string;
    date: string;
    loggedBy: string;
  };
  /** One-sentence human-readable summary shown in the confirmation prompt. */
  preview: string;
}

export interface UpdateCampaignStatusPending {
  type: "updateCampaignStatus";
  payload: {
    campaignId: string;
    newStatus: "draft" | "active" | "paused" | "complete";
    reason: string;
  };
  preview: string;
}

export interface UpdateOrganizationPending {
  type: "updateOrganization";
  payload: {
    organizationId: string;
    organizationName: string;
    connection?: string;
    outreachStatus?: string;
    friendship?: string;
    fitRating?: string;
    marketSegment?: string;
    /** Raw text to append (dated prefix + existing-notes merge happen at execute). */
    notesAppend?: string;
  };
  preview: string;
}

export interface CreateCampaignPending {
  type: "createCampaign";
  payload: {
    name: string;
    type: "event-based" | "recurring cadence" | "one-off blast";
    status?: "draft" | "active" | "paused" | "complete";
    owner?: string;
    /** ISO date string (YYYY-MM-DD). */
    startDate?: string;
    /** ISO date string (YYYY-MM-DD). */
    endDate?: string;
    notes?: string;
  };
  preview: string;
}

export interface UpdateContactPending {
  type: "updateContact";
  payload: {
    contactId: string;
    /** Contact name captured at staging time — preview-only, never written. */
    contactName: string;
    email?: string;
    role?: string;
    /** Replaces the existing nextAction value (not appended). */
    nextAction?: string;
  };
  preview: string;
}

export interface CreateOrganizationPending {
  type: "createOrganization";
  payload: {
    organization: string;
    type?: string;
    category?: string[];
    website?: string;
    email?: string;
    fitRating?: string;
    marketSegment?: string;
    notes?: string;
  };
  preview: string;
}

export interface UpdateDealPending {
  type: "updateDeal";
  payload: {
    dealId: string;
    stage: string;
    notes?: string;
  };
  preview: string;
}

export interface LogTimeEntryPending {
  type: "logTimeEntry";
  payload: {
    entry: string;           // display label like "2h on PRME project"
    projectIds: string[];    // notion page IDs
    personIds: string[];     // notion page IDs
    hours: number;
    date: string;            // ISO date string
    notes: string;
  };
  preview: string;
}

/**
 * Resolved port user associated with an inbound Slack event.
 * Email is the canonical identifier (matches Auth.js session primary key).
 */
export interface AgentUser {
  email: string;
  slackUserId: string;
  displayName: string;
}

/**
 * Per-user execution scope — which tools can be called and which Notion DBs
 * those tools may target.
 *
 * Null on a given notionContext field means the user has no access to that
 * database and any tool referring to it must return an error result.
 */
export interface UserScope {
  authEmail: string;
  displayName: string;
  allowedTools: AgentToolName[];
  notionContext: {
    campaignsDbId: string | null;
    socialPlanDbId: string | null;
    organizationsDbId: string | null;
    contactsDbId: string | null;
  };
}
