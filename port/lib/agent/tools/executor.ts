/**
 * Agent tool executor.
 *
 * Given a Claude `tool_use` block and the resolved user scope:
 *   1. Gate: tool name must be in WHITELISTED_TOOLS AND scope.allowedTools.
 *   2. Gate: required DB IDs for the tool must be present in scope.
 *   3. Dispatch to the matching notion.ts wrapper.
 *   4. Shape the result as Anthropic-compatible ToolResult content.
 *
 * Errors NEVER throw — they return `is_error: true` tool results. That
 * keeps Claude's turn alive: it can reason about a tool failure and
 * reply gracefully, rather than the whole agent loop crashing.
 *
 * Hard Week 2 security rules (enforced here):
 *   - NO tool name outside WHITELISTED_TOOLS can be invoked (explicit deny).
 *   - NO cross-user scope is possible — each scope is resolved per-event.
 *   - NO write operations of any kind (enforced by the wrappers in
 *     tools/notion.ts which only import read-side functions).
 *   - NO eval / Function / shell / dynamic import / arbitrary fetch.
 */

import type { UserScope, AgentToolName, PendingAction } from "../types";
import { WHITELISTED_TOOLS } from "./definitions";
import { setPending, getPending, clearPending } from "../pending-store";
import {
  queryCampaignsTool,
  getOrganizationTool,
  queryPaytonSocialPlanTool,
  executeLogActivity,
  queryActivitiesTool,
  queryContactsTool,
  type QueryContactsInput,
  queryDealsTool,
  type QueryDealsInput,
  executeUpdateCampaignStatus,
  executeUpdateOrganization,
  executeCreateCampaign,
  executeCreateOrganization,
  queryRfpOpportunitiesTool,
  queryProjectsTool,
  executeUpdateDeal,
  queryTimesheetsTool,
  queryWorkItemsTool,
  queryEventsTool,
  queryMembersTool,
  executeLogTimeEntry,
  executeUpdateContact,
  getContactTool,
} from "./notion";
import {
  AGENT_WRITABLE_ORG_FIELDS,
  AGENT_WRITABLE_CONTACT_FIELDS,
  type AgentWritableOrgField,
  type AgentWritableContactField,
} from "../agent-writable-fields";

export interface ToolUseRequest {
  tool_use_id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string; // JSON-stringified result (success) or error message
  is_error: boolean;
}

/**
 * Wrap a whitelist/scope check and tool dispatch in a try/catch so
 * failures become tool results rather than thrown exceptions.
 */
export async function executeTool(
  request: ToolUseRequest,
  scope: UserScope,
): Promise<ToolResult> {
  try {
    // Step 1: whitelist gate
    if (!WHITELISTED_TOOLS.has(request.name)) {
      return errorResult(
        request.tool_use_id,
        `tool '${request.name}' is not allowed`,
      );
    }

    // Step 2: per-user scope gate
    const toolName = request.name as AgentToolName;
    if (!scope.allowedTools.includes(toolName)) {
      return errorResult(
        request.tool_use_id,
        `tool '${request.name}' is not in the caller's allowed tools`,
      );
    }

    // Step 3: dispatch
    switch (toolName) {
      case "queryCampaigns": {
        if (!scope.notionContext.campaignsDbId) {
          return errorResult(
            request.tool_use_id,
            "caller's scope has no campaigns database configured",
          );
        }
        const result = await queryCampaignsTool({
          campaignsDbId: scope.notionContext.campaignsDbId,
          status: request.input.status,
          type: request.input.type,
          search: request.input.search,
          limit: request.input.limit,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "getOrganization": {
        if (!scope.notionContext.organizationsDbId) {
          return errorResult(
            request.tool_use_id,
            "caller's scope has no organizations database configured",
          );
        }
        if (typeof request.input.id !== "string" || !request.input.id) {
          return errorResult(
            request.tool_use_id,
            "missing or invalid 'id' (expected a Notion page ID string)",
          );
        }
        const result = await getOrganizationTool({
          organizationsDbId: scope.notionContext.organizationsDbId,
          id: request.input.id,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryPaytonSocialPlan": {
        if (!scope.notionContext.socialPlanDbId) {
          return errorResult(
            request.tool_use_id,
            "caller's scope has no social-plan database configured",
          );
        }
        const result = await queryPaytonSocialPlanTool({
          socialPlanDbId: scope.notionContext.socialPlanDbId,
          status: request.input.status,
          platform: request.input.platform,
          limit: request.input.limit,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryActivities": {
        const result = await queryActivitiesTool({
          orgId: typeof request.input.orgId === "string" ? request.input.orgId : undefined,
          contactId: typeof request.input.contactId === "string" ? request.input.contactId : undefined,
          search: typeof request.input.search === "string" ? request.input.search : undefined,
          limit: typeof request.input.limit === "number" ? request.input.limit : undefined,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryContacts": {
        const result = await queryContactsTool(request.input as QueryContactsInput);
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryDeals": {
        const result = await queryDealsTool(request.input as QueryDealsInput);
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryRfpOpportunities": {
        const result = await queryRfpOpportunitiesTool({
          status: typeof request.input.status === "string" ? request.input.status : undefined,
          search: typeof request.input.search === "string" ? request.input.search : undefined,
          limit: typeof request.input.limit === "number" ? request.input.limit : undefined,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryProjects": {
        const result = await queryProjectsTool({
          status: typeof request.input.status === "string" ? request.input.status : undefined,
          search: typeof request.input.search === "string" ? request.input.search : undefined,
          limit: typeof request.input.limit === "number" ? request.input.limit : undefined,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "updateDeal": {
        const dealId = String(request.input.dealId ?? "").trim();
        if (!dealId) {
          return errorResult(
            request.tool_use_id,
            "missing 'dealId' (Notion page ID of the deal)",
          );
        }
        const stage = String(request.input.stage ?? "").trim();
        const validStages = ["identified", "pitched", "proposal", "won", "lost"] as const;
        if (!validStages.includes(stage as (typeof validStages)[number])) {
          return errorResult(
            request.tool_use_id,
            `invalid stage '${stage}' — must be one of ${validStages.join(", ")}`,
          );
        }
        const notes = typeof request.input.notes === "string" ? request.input.notes.trim() : undefined;
        const pending: PendingAction = {
          type: "updateDeal",
          payload: {
            dealId,
            stage,
            notes: notes || undefined,
          },
          preview:
            `update deal ${dealId} stage → '${stage}'` +
            (notes ? ` + append note: '${notes.slice(0, 80)}'` : ""),
        };
        setPending(scope.authEmail, pending);
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify({
            status: "pending_confirmation",
            preview: pending.preview,
            instruction:
              "Tell the user exactly what you're about to change (deal stage, and note if any), then ask them to reply with 'confirm' to proceed or 'cancel' to abort. Do not execute yet.",
          }),
          is_error: false,
        };
      }

      case "logActivity": {
        // Stage the action — don't write yet. Return a pending result so
        // Claude describes the action to the user and asks for confirmation.
        const today = new Date().toISOString().slice(0, 10);
        const pending: PendingAction = {
          type: "logActivity",
          payload: {
            activity: String(request.input.activity ?? ""),
            activityType: String(request.input.activityType ?? "other"),
            organizationIds: Array.isArray(request.input.organizationIds)
              ? (request.input.organizationIds as string[])
              : [],
            contactIds: Array.isArray(request.input.contactIds)
              ? (request.input.contactIds as string[])
              : [],
            notes: String(request.input.notes ?? ""),
            outcome: String(request.input.outcome ?? "neutral"),
            date: String(request.input.date ?? today),
            loggedBy: scope.displayName,
          },
          preview:
            `log activity "${request.input.activity}" ` +
            `(type: ${request.input.activityType ?? "other"}, ` +
            `date: ${request.input.date ?? today}, ` +
            `outcome: ${request.input.outcome ?? "neutral"})`,
        };
        setPending(scope.authEmail, pending);

        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify({
            status: "pending_confirmation",
            preview: pending.preview,
            instruction:
              "Tell the user exactly what you're about to create, then ask them to reply with 'confirm' to proceed or 'cancel' to abort. Do not execute yet.",
          }),
          is_error: false,
        };
      }

      case "updateOrganization": {
        if (!scope.notionContext.organizationsDbId) {
          return errorResult(
            request.tool_use_id,
            "caller's scope has no organizations database configured",
          );
        }
        const orgId = String(request.input.organizationId ?? "").trim();
        if (!orgId) {
          return errorResult(
            request.tool_use_id,
            "missing 'organizationId' (Notion page ID of the organization)",
          );
        }
        // Whitelist: reject any input key outside the agent-writable set
        // (plus the one required identifier `organizationId`).
        const allowedInputKeys = new Set<string>([
          "organizationId",
          ...AGENT_WRITABLE_ORG_FIELDS,
        ]);
        for (const key of Object.keys(request.input)) {
          if (!allowedInputKeys.has(key)) {
            return errorResult(
              request.tool_use_id,
              `field '${key}' is not agent-writable on organizations`,
            );
          }
        }
        // Must set at least one editable field.
        const hasWrite = AGENT_WRITABLE_ORG_FIELDS.some(
          (k: AgentWritableOrgField) => request.input[k] !== undefined,
        );
        if (!hasWrite) {
          return errorResult(
            request.tool_use_id,
            "no updatable fields provided — include at least one of: " +
              AGENT_WRITABLE_ORG_FIELDS.join(", "),
          );
        }

        // Fetch existing to validate the ID + capture notes + org name for preview.
        // Throws if the page doesn't exist; outer try/catch surfaces as tool error.
        const existing = await getOrganizationTool({
          organizationsDbId: scope.notionContext.organizationsDbId,
          id: orgId,
        });

        const notesAppend =
          typeof request.input.notes === "string" ? request.input.notes.trim() : "";

        const fieldsSetPreview: string[] = [];
        for (const k of AGENT_WRITABLE_ORG_FIELDS) {
          if (k === "notes") continue;
          const v = request.input[k];
          if (v !== undefined) fieldsSetPreview.push(`${k} → ${String(v)}`);
        }
        if (notesAppend) fieldsSetPreview.push(`notes append: '${notesAppend.slice(0, 80)}'`);

        const pending: PendingAction = {
          type: "updateOrganization",
          payload: {
            organizationId: orgId,
            organizationName: existing.name ?? "",
            connection: request.input.connection,
            outreachStatus: request.input.outreachStatus,
            friendship: request.input.friendship,
            fitRating: request.input.fitRating,
            marketSegment: request.input.marketSegment,
            notesAppend: notesAppend || undefined,
          },
          preview:
            `update organization "${existing.name}": ` + fieldsSetPreview.join(", "),
        };
        setPending(scope.authEmail, pending);

        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify({
            status: "pending_confirmation",
            preview: pending.preview,
            instruction:
              "Tell the user exactly which fields will change on which organization (by name), and if a note is being appended include a brief preview of that text, then ask them to reply with 'confirm' to proceed or 'cancel' to abort. Do not execute yet.",
          }),
          is_error: false,
        };
      }

      case "updateCampaignStatus": {
        if (!scope.notionContext.campaignsDbId) {
          return errorResult(
            request.tool_use_id,
            "caller's scope has no campaigns database configured",
          );
        }
        const campaignId = String(request.input.campaignId ?? "").trim();
        const newStatus = String(request.input.newStatus ?? "").trim();
        const validStatuses = ["draft", "active", "paused", "complete"] as const;
        if (!campaignId) {
          return errorResult(
            request.tool_use_id,
            "missing 'campaignId' (Notion page ID of the campaign)",
          );
        }
        if (!validStatuses.includes(newStatus as (typeof validStatuses)[number])) {
          return errorResult(
            request.tool_use_id,
            `invalid newStatus '${newStatus}' — must be one of ${validStatuses.join(", ")}`,
          );
        }
        const reason = String(request.input.reason ?? "").trim();
        const pending: PendingAction = {
          type: "updateCampaignStatus",
          payload: {
            campaignId,
            newStatus: newStatus as (typeof validStatuses)[number],
            reason,
          },
          preview:
            `update campaign ${campaignId} status → '${newStatus}'` +
            (reason ? ` (reason: ${reason})` : ""),
        };
        setPending(scope.authEmail, pending);
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify({
            status: "pending_confirmation",
            preview: pending.preview,
            instruction:
              "Tell the user exactly what you're about to change, including the target status and reason if any, then ask them to reply with 'confirm' to proceed or 'cancel' to abort. Do not execute yet.",
          }),
          is_error: false,
        };
      }

      case "createCampaign": {
        if (!scope.notionContext.campaignsDbId) {
          return errorResult(
            request.tool_use_id,
            "caller's scope has no campaigns database configured",
          );
        }
        // Whitelist: reject any input key outside the agent-writable set.
        const allowedInputKeys = new Set<string>([
          "name",
          "type",
          "status",
          "owner",
          "startDate",
          "endDate",
          "notes",
        ]);
        for (const key of Object.keys(request.input)) {
          if (!allowedInputKeys.has(key)) {
            return errorResult(
              request.tool_use_id,
              `field '${key}' is not accepted by createCampaign`,
            );
          }
        }

        const name = String(request.input.name ?? "").trim();
        if (!name) {
          return errorResult(
            request.tool_use_id,
            "missing 'name' (campaign title, required)",
          );
        }

        const type = String(request.input.type ?? "").trim();
        const validTypes = [
          "event-based",
          "recurring cadence",
          "one-off blast",
        ] as const;
        if (!validTypes.includes(type as (typeof validTypes)[number])) {
          return errorResult(
            request.tool_use_id,
            `invalid type '${type}' — must be one of ${validTypes.join(", ")}`,
          );
        }

        const validStatuses = ["draft", "active", "paused", "complete"] as const;
        let status: (typeof validStatuses)[number] | undefined;
        if (request.input.status !== undefined) {
          const s = String(request.input.status).trim();
          if (!validStatuses.includes(s as (typeof validStatuses)[number])) {
            return errorResult(
              request.tool_use_id,
              `invalid status '${s}' — must be one of ${validStatuses.join(", ")}`,
            );
          }
          status = s as (typeof validStatuses)[number];
        }

        const owner =
          typeof request.input.owner === "string" && request.input.owner.trim()
            ? request.input.owner.trim()
            : undefined;
        const startDate =
          typeof request.input.startDate === "string" && request.input.startDate.trim()
            ? request.input.startDate.trim()
            : undefined;
        const endDate =
          typeof request.input.endDate === "string" && request.input.endDate.trim()
            ? request.input.endDate.trim()
            : undefined;
        const notes =
          typeof request.input.notes === "string" && request.input.notes.trim()
            ? request.input.notes.trim()
            : undefined;

        const previewParts: string[] = [`type: ${type}`];
        previewParts.push(`status: ${status ?? "draft"}`);
        if (owner) previewParts.push(`owner: ${owner}`);
        if (startDate) previewParts.push(`start: ${startDate}`);
        if (endDate) previewParts.push(`end: ${endDate}`);
        if (notes) previewParts.push(`notes: '${notes.slice(0, 80)}'`);

        const pending: PendingAction = {
          type: "createCampaign",
          payload: {
            name,
            type: type as (typeof validTypes)[number],
            status,
            owner,
            startDate,
            endDate,
            notes,
          },
          preview: `create campaign "${name}" (${previewParts.join(", ")})`,
        };
        setPending(scope.authEmail, pending);

        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify({
            status: "pending_confirmation",
            preview: pending.preview,
            instruction:
              "Tell the user exactly what campaign you're about to create — name, type, initial status, and any other fields they gave you — then ask them to reply with 'confirm' to proceed or 'cancel' to abort. Do not execute yet.",
          }),
          is_error: false,
        };
      }

      case "createOrganization": {
        if (!scope.notionContext.organizationsDbId) {
          return errorResult(
            request.tool_use_id,
            "caller's scope has no organizations database configured",
          );
        }
        const orgName = String(request.input.name ?? "").trim();
        if (!orgName) {
          return errorResult(
            request.tool_use_id,
            "missing 'name' (organization name is required)",
          );
        }
        const pending: PendingAction = {
          type: "createOrganization",
          payload: {
            organization: orgName,
            type: typeof request.input.type === "string" ? request.input.type : undefined,
            category: typeof request.input.category === "string" ? [request.input.category] : undefined,
            website: typeof request.input.website === "string" ? request.input.website : undefined,
            email: typeof request.input.email === "string" ? request.input.email : undefined,
            fitRating: typeof request.input.fitRating === "string" ? request.input.fitRating : undefined,
            marketSegment: typeof request.input.marketSegment === "string" ? request.input.marketSegment : undefined,
            notes: typeof request.input.notes === "string" ? request.input.notes : undefined,
          },
          preview:
            `create organization "${orgName}"` +
            (request.input.type ? ` (type: ${request.input.type})` : "") +
            (request.input.website ? `, website: ${request.input.website}` : ""),
        };
        setPending(scope.authEmail, pending);
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify({
            status: "pending_confirmation",
            preview: pending.preview,
            instruction:
              "Tell the user exactly what you're about to create (org name and any provided details), then ask them to reply with 'confirm' to proceed or 'cancel' to abort. Do not execute yet.",
          }),
          is_error: false,
        };
      }

      case "queryTimesheets": {
        const result = await queryTimesheetsTool({
          dateAfter: typeof request.input.dateAfter === "string" ? request.input.dateAfter : undefined,
          dateBefore: typeof request.input.dateBefore === "string" ? request.input.dateBefore : undefined,
          status: typeof request.input.status === "string" ? request.input.status : undefined,
          search: typeof request.input.search === "string" ? request.input.search : undefined,
          limit: typeof request.input.limit === "number" ? request.input.limit : undefined,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryWorkItems": {
        const result = await queryWorkItemsTool({
          status: typeof request.input.status === "string" ? request.input.status : undefined,
          priority: typeof request.input.priority === "string" ? request.input.priority : undefined,
          search: typeof request.input.search === "string" ? request.input.search : undefined,
          limit: typeof request.input.limit === "number" ? request.input.limit : undefined,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryEvents": {
        const result = await queryEventsTool({
          search: typeof request.input.search === "string" ? request.input.search : undefined,
          limit: typeof request.input.limit === "number" ? request.input.limit : undefined,
        });
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "queryMembers": {
        const result = await queryMembersTool();
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify(result),
          is_error: false,
        };
      }

      case "logTimeEntry": {
        const projectId = String(request.input.projectId ?? "").trim();
        if (!projectId) {
          return errorResult(request.tool_use_id, "missing 'projectId' (use queryProjects to find the project's Notion page ID)");
        }
        const memberId = String(request.input.memberId ?? "").trim();
        if (!memberId) {
          return errorResult(request.tool_use_id, "missing 'memberId' (use queryMembers to find the member's Notion page ID)");
        }
        const hoursRaw = request.input.hours;
        const hours = typeof hoursRaw === "number" ? hoursRaw : parseFloat(String(hoursRaw ?? "0"));
        if (!hours || hours <= 0) {
          return errorResult(request.tool_use_id, "missing or invalid 'hours' (must be a positive number)");
        }
        const today = new Date().toISOString().slice(0, 10);
        const date = typeof request.input.date === "string" && request.input.date ? request.input.date : today;
        const notes = typeof request.input.notes === "string" ? request.input.notes.trim() : "";
        const entryLabel = notes ? `${hours}h — ${notes}` : `${hours}h`;
        const pending: PendingAction = {
          type: "logTimeEntry",
          payload: {
            entry: entryLabel,
            projectIds: [projectId],
            personIds: [memberId],
            hours,
            date,
            notes,
          },
          preview: `Log ${hours}h on project ${projectId} for member ${memberId} on ${date}${notes ? ` — "${notes}"` : ""}`,
        };
        await setPending(scope.authEmail, pending);
        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify({
            status: "pending_confirmation",
            preview: pending.preview,
            instruction:
              "Tell the user exactly what you're about to log (hours, project, member, and date), then ask them to reply with 'confirm' to proceed or 'cancel' to abort. Do not execute yet.",
          }),
          is_error: false,
        };
      }

      case "updateContact": {
        if (!scope.notionContext.contactsDbId) {
          return errorResult(
            request.tool_use_id,
            "caller's scope has no contacts database configured",
          );
        }
        const contactId = String(request.input.contactId ?? "").trim();
        if (!contactId) {
          return errorResult(
            request.tool_use_id,
            "missing 'contactId' (Notion page ID of the contact)",
          );
        }

        // Whitelist: reject any input key outside the agent-writable set
        // (plus the one required identifier `contactId`).
        const allowedInputKeys = new Set<string>([
          "contactId",
          ...AGENT_WRITABLE_CONTACT_FIELDS,
        ]);
        for (const key of Object.keys(request.input)) {
          if (!allowedInputKeys.has(key)) {
            return errorResult(
              request.tool_use_id,
              `field '${key}' is not agent-writable on contacts`,
            );
          }
        }

        // Must set at least one editable field.
        const hasWrite = AGENT_WRITABLE_CONTACT_FIELDS.some(
          (k: AgentWritableContactField) => request.input[k] !== undefined,
        );
        if (!hasWrite) {
          return errorResult(
            request.tool_use_id,
            "no updatable fields provided — include at least one of: " +
              AGENT_WRITABLE_CONTACT_FIELDS.join(", "),
          );
        }

        // Fetch existing contact to validate the ID + capture name for preview.
        // Throws if the page doesn't exist; outer try/catch surfaces as tool error.
        const existing = await getContactTool({
          contactsDbId: scope.notionContext.contactsDbId,
          id: contactId,
        });

        const fieldsSetPreview: string[] = [];
        for (const k of AGENT_WRITABLE_CONTACT_FIELDS) {
          const v = request.input[k];
          if (v !== undefined) {
            const display =
              typeof v === "string" && v.length > 80 ? `${v.slice(0, 80)}…` : String(v);
            fieldsSetPreview.push(`${k} → ${display}`);
          }
        }

        const pending: PendingAction = {
          type: "updateContact",
          payload: {
            contactId,
            contactName: existing.name ?? "",
            email:
              typeof request.input.email === "string"
                ? request.input.email
                : undefined,
            role:
              typeof request.input.role === "string"
                ? request.input.role
                : undefined,
            nextAction:
              typeof request.input.nextAction === "string"
                ? request.input.nextAction
                : undefined,
          },
          preview:
            `update contact "${existing.name}": ` + fieldsSetPreview.join(", "),
        };
        setPending(scope.authEmail, pending);

        return {
          tool_use_id: request.tool_use_id,
          content: JSON.stringify({
            status: "pending_confirmation",
            preview: pending.preview,
            instruction:
              "Tell the user exactly which fields will change on which contact (by name) — and note that nextAction REPLACES the current value, not appends — then ask them to reply with 'confirm' to proceed or 'cancel' to abort. Do not execute yet.",
          }),
          is_error: false,
        };
      }

      case "confirmAction": {
        const pendingAction = getPending(scope.authEmail);
        if (!pendingAction) {
          return errorResult(
            request.tool_use_id,
            "No pending action found. It may have expired (5-minute window) — please re-issue the original request.",
          );
        }

        // Execute the staged action.
        clearPending(scope.authEmail);

        if (pendingAction.type === "logActivity") {
          const result = await executeLogActivity({
            activity: pendingAction.payload.activity,
            activityType: pendingAction.payload.activityType as Parameters<typeof executeLogActivity>[0]["activityType"],
            organizationIds: pendingAction.payload.organizationIds,
            contactIds: pendingAction.payload.contactIds,
            notes: pendingAction.payload.notes,
            outcome: pendingAction.payload.outcome as Parameters<typeof executeLogActivity>[0]["outcome"],
            date: pendingAction.payload.date,
            loggedBy: pendingAction.payload.loggedBy,
          });
          return {
            tool_use_id: request.tool_use_id,
            content: JSON.stringify({ status: "success", created: result }),
            is_error: false,
          };
        }

        if (pendingAction.type === "updateCampaignStatus") {
          const result = await executeUpdateCampaignStatus({
            campaignId: pendingAction.payload.campaignId,
            newStatus: pendingAction.payload.newStatus,
            reason: pendingAction.payload.reason,
          });
          return {
            tool_use_id: request.tool_use_id,
            content: JSON.stringify({ status: "success", updated: result }),
            is_error: false,
          };
        }

        if (pendingAction.type === "updateOrganization") {
          const p = pendingAction.payload;
          // executeUpdateOrganization handles the notes-append merge
          // itself (fetches current notes fresh to avoid overwriting a
          // parallel update that happened between staging and confirm).
          const result = await executeUpdateOrganization({
            organizationId: p.organizationId,
            connection: p.connection,
            outreachStatus: p.outreachStatus,
            friendship: p.friendship,
            fitRating: p.fitRating,
            marketSegment: p.marketSegment,
            notesAppend: p.notesAppend,
          });
          return {
            tool_use_id: request.tool_use_id,
            content: JSON.stringify({ status: "success", updated: result }),
            is_error: false,
          };
        }

        if (pendingAction.type === "createCampaign") {
          const p = pendingAction.payload;
          const result = await executeCreateCampaign({
            name: p.name,
            type: p.type,
            status: p.status,
            owner: p.owner,
            startDate: p.startDate,
            endDate: p.endDate,
            notes: p.notes,
          });
          return {
            tool_use_id: request.tool_use_id,
            content: JSON.stringify({ status: "success", created: result }),
            is_error: false,
          };
        }

        if (pendingAction.type === "createOrganization") {
          const result = await executeCreateOrganization(pendingAction.payload);
          return {
            tool_use_id: request.tool_use_id,
            content: JSON.stringify({ status: "success", created: result }),
            is_error: false,
          };
        }

        if (pendingAction.type === "updateDeal") {
          const result = await executeUpdateDeal({
            dealId: pendingAction.payload.dealId,
            stage: pendingAction.payload.stage,
            notes: pendingAction.payload.notes,
          });
          return {
            tool_use_id: request.tool_use_id,
            content: JSON.stringify({ status: "success", updated: result }),
            is_error: false,
          };
        }

        if (pendingAction.type === "updateContact") {
          const p = pendingAction.payload;
          const result = await executeUpdateContact({
            contactId: p.contactId,
            email: p.email,
            role: p.role,
            nextAction: p.nextAction,
          });
          return {
            tool_use_id: request.tool_use_id,
            content: JSON.stringify({ status: "success", updated: result }),
            is_error: false,
          };
        }

        if (pendingAction.type === "logTimeEntry") {
          const result = await executeLogTimeEntry({
            entry: pendingAction.payload.entry,
            projectIds: pendingAction.payload.projectIds,
            personIds: pendingAction.payload.personIds,
            hours: pendingAction.payload.hours,
            date: pendingAction.payload.date,
            notes: pendingAction.payload.notes,
          });
          return {
            tool_use_id: request.tool_use_id,
            content: JSON.stringify({ status: "success", message: `Time entry logged: ${pendingAction.payload.entry}`, created: result }),
            is_error: false,
          };
        }

        // Exhaustiveness check — TS will flag if a new PendingAction variant
        // ships without a confirmAction handler.
        const _exhaustive: never = pendingAction;
        return errorResult(
          request.tool_use_id,
          `unhandled pending action type: ${String((_exhaustive as PendingAction).type)}`,
        );
      }

      default: {
        // Exhaustiveness check. TS will flag if a new AgentToolName is
        // added but not handled.
        const _exhaustive: never = toolName;
        return errorResult(
          request.tool_use_id,
          `unhandled tool: ${String(_exhaustive)}`,
        );
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "tool execution failed";
    console.warn(`[agent/tool] ${request.name} failed:`, message);
    return errorResult(request.tool_use_id, message);
  }
}

function errorResult(toolUseId: string, message: string): ToolResult {
  return {
    tool_use_id: toolUseId,
    content: `Error: ${message}`,
    is_error: true,
  };
}
