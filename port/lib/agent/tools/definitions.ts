/**
 * Anthropic tool definitions for the port agent.
 *
 * These JSON schemas are what Claude sees — `input_schema` describes what
 * arguments the tool accepts. Pair with the runtime handlers in
 * `tools/executor.ts`, which enforce the actual whitelist and scope.
 *
 * Keep descriptions short, verb-led, and specific about what the tool
 * DOES and DOES NOT do. Avoid leaking implementation (DB IDs, internal
 * property names) — Claude doesn't need them and the agent's scope map
 * resolves the right DB at execution time.
 */

import type { AgentToolName } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AgentToolDefinition {
  name: AgentToolName;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const AGENT_TOOLS: AgentToolDefinition[] = [
  {
    name: "queryCampaigns",
    description:
      "List outreach campaigns from the port's business-development campaigns database. " +
      "Returns name, type, status, owner, and date range for each campaign. " +
      "Use to answer questions like 'what campaigns are active', 'which campaigns did Garrett own last quarter'. " +
      "Does NOT create, edit, or delete campaigns.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["draft", "active", "paused", "complete"],
          description: "Filter by campaign status. Omit to return all statuses.",
        },
        type: {
          type: "string",
          enum: ["event-based", "recurring cadence", "one-off blast"],
          description: "Filter by campaign type. Omit to return all types.",
        },
        search: {
          type: "string",
          description: "Partial match against campaign name (case-insensitive).",
        },
        limit: {
          type: "number",
          description: "Max results to return. Defaults to 10, max 25.",
          default: 10,
        },
      },
    },
  },
  {
    name: "getOrganization",
    description:
      "Retrieve full details of one organization by its Notion page ID. " +
      "Returns the organization record (name, description, relationship depth, " +
      "contacts, etc). Use when the user references a specific org and you " +
      "need its profile. Does NOT list or search organizations.",
    input_schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Notion page ID of the organization (UUID format).",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "queryPaytonSocialPlan",
    description:
      "List posts from Payton's social-media campaign-planning database. " +
      "Returns each post's working name, target platform(s), status, publish " +
      "date, hook/angle, and draft asset link. Use to answer questions like " +
      "'what posts are scheduled this week', 'what LinkedIn drafts are in " +
      "progress'. Does NOT create, edit, or delete posts.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["idea", "drafting", "needs visuals", "ready", "scheduled", "published"],
          description: "Filter by post pipeline status. Omit for all statuses.",
        },
        platform: {
          type: "string",
          enum: ["Facebook", "Instagram", "Substack", "LinkedIn", "Email", "BlueSky"],
          description:
            "Filter to posts targeting this platform. Omit to include all platforms. " +
            "(Posts may target multiple platforms; filter matches any.)",
        },
        limit: {
          type: "number",
          description: "Max results to return. Defaults to 10, max 25.",
          default: 10,
        },
      },
    },
  },
  // ── queryContacts ─────────────────────────────────────────────────────
  {
    name: "queryContacts" as AgentToolName,
    description:
      "Search contacts in the CRM. Filter by organization ID or keyword search. " +
      "Returns name, email, role, and linked organization IDs for each contact. " +
      "Use to answer 'who do we know at IDB?', 'find contacts named Meredith', etc. " +
      "Does NOT create, edit, or delete contacts.",
    input_schema: {
      type: "object",
      properties: {
        orgId: {
          type: "string",
          description: "Filter contacts by organization page ID.",
        },
        search: {
          type: "string",
          description: "Keyword search across contact names.",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 25).",
          default: 10,
        },
      },
    },
  },
  // ── queryDeals ────────────────────────────────────────────────────────
  {
    name: "queryDeals" as AgentToolName,
    description:
      "List deals in the BD pipeline. Filter by stage or organization. " +
      "Returns deal name, stage, value, linked organization IDs, and close date. " +
      "Use to answer 'what deals are in proposal?', 'show won deals this year', etc. " +
      "Does NOT create, edit, or delete deals.",
    input_schema: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          enum: ["identified", "pitched", "proposal", "won", "lost"],
          description: "Filter by deal stage. Omit to return all stages.",
        },
        orgId: {
          type: "string",
          description: "Filter deals by organization page ID.",
        },
        limit: {
          type: "number",
          description: "Max results (default 10, max 25).",
          default: 10,
        },
      },
    },
  },
  // ── queryActivities ──────────────────────────────────────────────────
  {
    name: "queryActivities" as AgentToolName,
    description:
      "List recent CRM activity entries — meetings, calls, emails, notes, and other touchpoints. " +
      "Optionally filter to a specific organisation or contact by their Notion page ID. " +
      "Use to answer 'what did we last do with IDB?', 'show recent activities for Meredith', etc. " +
      "Returns newest first. Does NOT create, edit, or delete activities.",
    input_schema: {
      type: "object",
      properties: {
        orgId: {
          type: "string",
          description:
            "Notion page ID of an organisation. Use getOrganization first to resolve a name to an ID.",
        },
        contactId: {
          type: "string",
          description: "Notion page ID of a contact to filter activities to.",
        },
        search: {
          type: "string",
          description: "Partial match against activity title (case-insensitive).",
        },
        limit: {
          type: "number",
          description: "Max results to return. Defaults to 10, max 25.",
          default: 10,
        },
      },
    },
  },

  // ── Write tools (confirm-before-mutate) ──────────────────────────────
  {
    name: "logActivity" as AgentToolName,
    description:
      "Stage a new activity entry in the port's CRM. " +
      "Does NOT write immediately — stages the action and asks the user to confirm first. " +
      "Use to log a meeting, call, note, or other touchpoint against a contact or organisation. " +
      "Provide as much detail as possible so the user can make an informed confirmation. " +
      "Only call ONE write tool per turn.",
    input_schema: {
      type: "object",
      properties: {
        activity: {
          type: "string",
          description:
            "Short title for the activity (e.g. 'Call with Meredith — contract update').",
        },
        activityType: {
          type: "string",
          enum: [
            "email sent",
            "email opened",
            "link clicked",
            "email bounced",
            "email received",
            "site visit",
            "meeting",
            "call",
            "conference encounter",
            "intro made",
            "linkedin message",
            "proposal shared",
            "other",
          ],
          description: "Category of the activity. Defaults to 'other' if omitted.",
        },
        organizationIds: {
          type: "array",
          items: { type: "string" },
          description:
            "Notion page IDs of organisations to link (optional). " +
            "Use getOrganization first to resolve a name to an ID.",
        },
        contactIds: {
          type: "array",
          items: { type: "string" },
          description: "Notion page IDs of contacts to link (optional).",
        },
        notes: {
          type: "string",
          description: "Free-text notes about the activity (optional).",
        },
        outcome: {
          type: "string",
          enum: ["positive", "neutral", "no response", "declined"],
          description: "Outcome of the touchpoint. Defaults to 'neutral' if omitted.",
        },
        date: {
          type: "string",
          description:
            "ISO date string (YYYY-MM-DD). Defaults to today if omitted. " +
            "Use what the user specifies; don't guess if they don't mention a date.",
        },
      },
      required: ["activity"],
    },
  },
  {
    name: "updateOrganization" as AgentToolName,
    description:
      "Stage an update to a single organization's relationship status or notes. " +
      "Does NOT write immediately — stages the action and asks the user to confirm first. " +
      "Use getOrganization first to resolve a name to an ID. " +
      "Only edits relationship-signal fields (connection, outreachStatus, friendship, " +
      "fitRating, marketSegment, notes). Name, contacts, computed fields, and system " +
      "fields are NOT writable. Notes are APPENDED with a dated prefix — they never " +
      "overwrite existing notes. Only call ONE write tool per turn.",
    input_schema: {
      type: "object",
      properties: {
        organizationId: {
          type: "string",
          description: "Notion page ID of the organization (UUID format).",
        },
        connection: {
          type: "string",
          enum: [
            "unengaged",
            "exploring",
            "in progress",
            "collaborating",
            "champion",
            "steward",
            "past client",
          ],
          description: "Primary BD pipeline status. Omit to leave unchanged.",
        },
        outreachStatus: {
          type: "string",
          enum: [
            "Not started",
            "Researching",
            "Contacted",
            "In conversation",
            "Proposal sent",
            "Active client",
            "Opted out",
          ],
          description: "Campaign outreach stage. Omit to leave unchanged.",
        },
        friendship: {
          type: "string",
          enum: [
            "Inner circle",
            "Warm friend",
            "Friendly contact",
            "Loose tie",
            "Known-of / name in common",
            "Stranger",
          ],
          description: "Relationship warmth. Omit to leave unchanged.",
        },
        fitRating: {
          type: "string",
          enum: ["🔥 Perfect fit", "✅ Strong fit", "🟡 Moderate fit"],
          description: "Strategic fit assessment. Omit to leave unchanged.",
        },
        marketSegment: {
          type: "string",
          description:
            "Market segment label (free-text, but should match existing Notion select options if possible). Omit to leave unchanged.",
        },
        notes: {
          type: "string",
          description:
            "Text to APPEND to this organization's notes. A dated prefix is added " +
            "automatically; do not include a date yourself. Omit if no note to add.",
        },
      },
      required: ["organizationId"],
    },
  },
  {
    name: "updateCampaignStatus" as AgentToolName,
    description:
      "Stage a status change on a BD campaign (draft → active → paused → complete). " +
      "Does NOT write immediately — stages the action and asks the user to confirm first. " +
      "Use queryCampaigns first to resolve a name to an ID. " +
      "If a reason is provided, it is appended to the campaign's notes with a dated prefix " +
      "so the status history is preserved. Only call ONE write tool per turn.",
    input_schema: {
      type: "object",
      properties: {
        campaignId: {
          type: "string",
          description: "Notion page ID of the campaign to update (UUID format).",
        },
        newStatus: {
          type: "string",
          enum: ["draft", "active", "paused", "complete"],
          description: "The target status.",
        },
        reason: {
          type: "string",
          description:
            "Optional short explanation appended to campaign notes (e.g. " +
            "'kicking off Q2 outreach' or 'waiting on legal review'). " +
            "Omit if the user didn't give a reason.",
        },
      },
      required: ["campaignId", "newStatus"],
    },
  },
  {
    name: "createCampaign" as AgentToolName,
    description:
      "Stage the creation of a new BD outreach campaign in the port's campaigns database. " +
      "Does NOT write immediately — stages the action and asks the user to confirm first. " +
      "Use when the user asks to 'start a new campaign', 'spin up an outreach push', or similar. " +
      "Does NOT add campaign steps, send emails, or modify audience filters — only the campaign record. " +
      "Only call ONE write tool per turn.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Campaign name (required, free-text).",
        },
        type: {
          type: "string",
          enum: ["event-based", "recurring cadence", "one-off blast"],
          description: "Campaign cadence type (required).",
        },
        status: {
          type: "string",
          enum: ["draft", "active", "paused", "complete"],
          description:
            "Initial status. Omit to default to 'draft' — the safe choice for a newly staged campaign.",
        },
        owner: {
          type: "string",
          description:
            "Free-text owner name (e.g. 'Garrett', 'Maria'). Omit if not specified.",
        },
        startDate: {
          type: "string",
          description: "ISO date string (YYYY-MM-DD). Omit if not specified.",
        },
        endDate: {
          type: "string",
          description: "ISO date string (YYYY-MM-DD). Omit if not specified.",
        },
        notes: {
          type: "string",
          description:
            "Free-text notes about the campaign's goal or audience. Omit if not specified.",
        },
      },
      required: ["name", "type"],
    },
  },
  {
    name: "createOrganization" as AgentToolName,
    description:
      "Stage a new organization in the port's CRM. " +
      "Does NOT write immediately — stages the action and asks the user to confirm first. " +
      "Use to add a new org the team hasn't tracked before. " +
      "After creating, use updateOrganization to set relationship signals. " +
      "Only call ONE write tool per turn.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Organization name (required).",
        },
        type: {
          type: "string",
          description: "Organization type (e.g. 'NGO', 'University', 'Government'). Omit if unknown.",
        },
        category: {
          type: "string",
          description: "Category label. Omit if unknown.",
        },
        website: {
          type: "string",
          description: "Website URL. Omit if unknown.",
        },
        email: {
          type: "string",
          description: "Primary contact email. Omit if unknown.",
        },
        fitRating: {
          type: "string",
          enum: ["🔥 Perfect fit", "✅ Strong fit", "🟡 Moderate fit"],
          description: "Strategic fit assessment. Omit if unknown.",
        },
        marketSegment: {
          type: "string",
          description: "Market segment label. Omit if unknown.",
        },
        notes: {
          type: "string",
          description: "Initial notes about this organization. Omit if none.",
        },
      },
      required: ["name"],
    },
  },
  // ── queryRfpOpportunities ────────────────────────────────────────────
  {
    name: "queryRfpOpportunities" as AgentToolName,
    description:
      "List RFP opportunities from the port's RFP Lighthouse database. " +
      "Returns opportunity name, status, organization IDs, due date, estimated value, and fit score. " +
      "Use to answer 'what RFPs are we pursuing?', 'show submitted proposals', 'any RFPs due soon?'. " +
      "Does NOT create, edit, or delete opportunities.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["radar", "reviewing", "pursuing", "interviewing", "submitted", "won", "lost", "no-go", "missed deadline"],
          description: "Filter by RFP status. Omit to return all statuses.",
        },
        search: {
          type: "string",
          description: "Partial match against opportunity name (case-insensitive).",
        },
        limit: {
          type: "number",
          description: "Max results to return. Defaults to 20, max 50.",
          default: 20,
        },
      },
    },
  },
  // ── queryProjects ─────────────────────────────────────────────────────
  {
    name: "queryProjects" as AgentToolName,
    description:
      "List projects from the port's project management database. " +
      "Returns project name, status, priority, type, project leads, and timeline. " +
      "Use to answer 'what projects are in progress?', 'show contract projects', 'any suspended projects?'. " +
      "Does NOT create, edit, or delete projects.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["icebox", "in queue", "in progress", "under review", "suspended", "complete"],
          description: "Filter by project status. Omit to return all statuses.",
        },
        search: {
          type: "string",
          description: "Partial match against project name (case-insensitive).",
        },
        limit: {
          type: "number",
          description: "Max results to return. Defaults to 20, max 50.",
          default: 20,
        },
      },
    },
  },
  // ── updateDeal (staged write) ─────────────────────────────────────────
  {
    name: "updateDeal" as AgentToolName,
    description:
      "Stage an update to a deal's pipeline stage and optionally append a note. " +
      "Does NOT write immediately — stages the action and asks the user to confirm first. " +
      "Use queryDeals first to resolve a deal name to an ID. " +
      "Notes are APPENDED with a dated prefix — they never overwrite existing notes. " +
      "Only call ONE write tool per turn.",
    input_schema: {
      type: "object",
      properties: {
        dealId: {
          type: "string",
          description: "Notion page ID of the deal to update (UUID format).",
        },
        stage: {
          type: "string",
          enum: ["identified", "pitched", "proposal", "won", "lost"],
          description: "New pipeline stage for the deal.",
        },
        notes: {
          type: "string",
          description:
            "Text to APPEND to this deal's notes. A dated prefix is added " +
            "automatically; do not include a date yourself. Omit if no note to add.",
        },
      },
      required: ["dealId", "stage"],
    },
  },
  {
    name: "updateContact" as AgentToolName,
    description:
      "Stage an update to a single contact's email, role, or next action. " +
      "Does NOT write immediately — stages the action and asks the user to confirm first. " +
      "Only edits free-text fields (email, role, nextAction). Name, organization links, warmth/" +
      "responsiveness signals, phone, LinkedIn, and system fields are NOT writable. " +
      "nextAction is REPLACED (not appended) — it tracks the current next step, not a history log. " +
      "Only call ONE write tool per turn.",
    input_schema: {
      type: "object",
      properties: {
        contactId: {
          type: "string",
          description: "Notion page ID of the contact (UUID format).",
        },
        email: {
          type: "string",
          description: "New email address. Omit to leave unchanged.",
        },
        role: {
          type: "string",
          description:
            "New role / title (free-text). Omit to leave unchanged.",
        },
        nextAction: {
          type: "string",
          description:
            "Short description of the next step with this contact. REPLACES the existing value — pass the full new text, not a delta. Omit to leave unchanged.",
        },
      },
      required: ["contactId"],
    },
  },
  {
    name: "confirmAction" as AgentToolName,
    description:
      "Execute the pending write action you described in your previous message. " +
      "Call this when the user responds with 'confirm', 'yes', 'go ahead', " +
      "or any equivalent affirmative after you described a staged write operation. " +
      "Returns an error if there is no pending action or it has expired (5-minute window).",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  // ── queryTimesheets ───────────────────────────────────────────────────
  {
    name: "queryTimesheets" as AgentToolName,
    description:
      "List time entries from the port's timesheet database. " +
      "Returns entry description, hours, date, and status for each entry. " +
      "Use to answer 'how many hours did we log this week?', 'show recent time entries'. " +
      "Does NOT create or edit time entries.",
    input_schema: {
      type: "object",
      properties: {
        dateAfter: {
          type: "string",
          description: "ISO date string (YYYY-MM-DD). Return entries on or after this date.",
        },
        dateBefore: {
          type: "string",
          description: "ISO date string (YYYY-MM-DD). Return entries on or before this date.",
        },
        status: {
          type: "string",
          enum: ["draft", "submitted", "approved", "invoiced", "paid"],
          description: "Filter by approval status. Omit to return all statuses.",
        },
        search: {
          type: "string",
          description: "Partial match against entry description (case-insensitive).",
        },
        limit: {
          type: "number",
          description: "Max results to return. Defaults to 20, max 50.",
          default: 20,
        },
      },
    },
  },
  // ── queryWorkItems ────────────────────────────────────────────────────
  {
    name: "queryWorkItems" as AgentToolName,
    description:
      "List work items (tasks) from the port's project management database. " +
      "Returns task name, status, priority, type, and due date. " +
      "Use to answer 'what tasks are open?', 'show high-priority items'. " +
      "Does NOT create or edit work items.",
    input_schema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          description: "Filter by task status. Omit to return all statuses.",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium", "low"],
          description: "Filter by priority level. Omit to return all priorities.",
        },
        search: {
          type: "string",
          description: "Partial match against task name (case-insensitive).",
        },
        limit: {
          type: "number",
          description: "Max results to return. Defaults to 15, max 30.",
          default: 15,
        },
      },
    },
  },
  // ── queryEvents ───────────────────────────────────────────────────────
  {
    name: "queryEvents" as AgentToolName,
    description:
      "List events and conferences from the port's events database. " +
      "Returns event name, type, dates, location, and relevance tags. " +
      "Use to answer 'what conferences are coming up?', 'what events are relevant this year?'. " +
      "Does NOT create or edit events.",
    input_schema: {
      type: "object",
      properties: {
        search: {
          type: "string",
          description: "Partial match against event name (case-insensitive).",
        },
        limit: {
          type: "number",
          description: "Max results to return. Defaults to 15, max 30.",
          default: 15,
        },
      },
    },
  },
  // ── queryMembers ──────────────────────────────────────────────────────
  {
    name: "queryMembers" as AgentToolName,
    description:
      "List active members of the w.v collective. " +
      "Returns name, email, company role, and capacity for each active member. " +
      "Use to answer 'who is on the team?', 'what is Maria\\'s role?', 'who is full-time?'. " +
      "Does NOT create or edit members.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  // ── logTimeEntry (staged write) ───────────────────────────────────────
  {
    name: "logTimeEntry" as AgentToolName,
    description:
      "Stage a new time entry in the port's timesheet database. " +
      "Does NOT write immediately — stages the action and asks the user to confirm first. " +
      "Use queryMembers to find memberId and queryProjects to find projectId before calling. " +
      "Only call ONE write tool per turn.",
    input_schema: {
      type: "object",
      properties: {
        projectId: {
          type: "string",
          description: "Project notion_page_id to link this entry to. Use queryProjects to find.",
        },
        memberId: {
          type: "string",
          description: "Member notion_page_id (person who did the work). Use queryMembers to find.",
        },
        hours: {
          type: "number",
          description: "Hours worked (decimals allowed, e.g. 1.5 for 90 minutes).",
        },
        date: {
          type: "string",
          description: "ISO date string (YYYY-MM-DD). Defaults to today if omitted.",
        },
        notes: {
          type: "string",
          description: "What was worked on (e.g. 'PRME contract review', 'IDB proposal writing').",
        },
      },
      required: ["projectId", "memberId", "hours"],
    },
  },
];

/** Whitelisted tool names — mirrors the AgentToolName union. Cheap runtime guard. */
export const WHITELISTED_TOOLS: ReadonlySet<string> = new Set(
  AGENT_TOOLS.map((t) => t.name),
);
