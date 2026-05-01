/**
 * Notion wrappers for the port agent — read-only (Week 2) and
 * confirm-gated writes (Week 3).
 *
 * Every function here:
 *   - Accepts a `dbId` argument (injected from the user's scope), never
 *     reads `PORT_DB` directly. This makes scoping the explicit control.
 *   - Returns plain-object results (no Notion SDK types leaked).
 *
 * Write functions (logActivityTool) stage a PendingAction via the pending
 * store rather than executing immediately. Execution only happens when the
 * user explicitly confirms — see executor.ts + pending-store.ts.
 *
 * The executor catches any thrown errors and surfaces them to Claude as
 * `is_error: true` tool results — so these functions are free to throw
 * on Notion API failure rather than returning sentinel values.
 */

import { notion } from "@/lib/notion/client";
import {
  queryCampaigns as existingQueryCampaigns,
  getCampaign,
  updateCampaign,
  createCampaign as existingCreateCampaign,
} from "@/lib/notion/campaigns";
import {
  getOrganization as existingGetOrganization,
  updateOrganization as existingUpdateOrganization,
  createOrganization as existingCreateOrganization,
} from "@/lib/notion/organizations";
import {
  getContact as existingGetContact,
  updateContact as existingUpdateContact,
} from "@/lib/notion/contacts";
import { deriveRelationship } from "@/lib/notion/derived-fields";
import {
  createActivity,
  queryActivities as existingQueryActivities,
} from "@/lib/notion/activities";
import { queryContacts as existingQueryContacts } from "@/lib/notion/contacts";
import { queryDeals as existingQueryDeals, getDeal, updateDeal as existingUpdateDeal } from "@/lib/notion/deals";
import { queryRfpOpportunities as existingQueryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { queryProjects as existingQueryProjects } from "@/lib/notion/projects";
import { PORT_DB } from "@/lib/notion/client";
import type { ActivityType, ActivityOutcome, RfpStatus, ProjectStatus } from "@/lib/notion/types";
import { createTimesheet } from "@/lib/notion/timesheets";
import { getTimesheetsFromSupabase } from "@/lib/supabase/timesheets";
import { getWorkItemsFromSupabase } from "@/lib/supabase/work-items";
import { queryEvents as existingQueryEvents } from "@/lib/notion/events";
import { getActiveMembersFromSupabase } from "@/lib/supabase/members";
import { getCampaignsFromSupabase } from "@/lib/supabase/campaigns";
import { getContactsFromSupabase } from "@/lib/supabase/contacts";
import { getOrganizationsFromSupabase } from "@/lib/supabase/organizations";
import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";

export interface QueryCampaignsInput {
  campaignsDbId: string;
  status?: "draft" | "active" | "paused" | "complete";
  type?: "event-based" | "recurring cadence" | "one-off blast";
  search?: string;
  limit?: number;
}

export interface CampaignSummary {
  id: string;
  name: string;
  status: string;
  type: string;
  owner: string;
  startDate: string | null;
  endDate: string | null;
}

export async function queryCampaignsTool(
  input: QueryCampaignsInput,
): Promise<{ campaigns: CampaignSummary[]; hasMore: boolean }> {
  // The existing function hardcodes PORT_DB.campaigns — defend against a
  // mis-scoped call landing here with a different dbId.
  if (input.campaignsDbId !== PORT_DB.campaigns) {
    throw new Error(
      `campaigns dbId mismatch: expected PORT_DB.campaigns, got ${input.campaignsDbId}`,
    );
  }

  let data = await getCampaignsFromSupabase(input.status, input.type);
  if (input.search) {
    const q = input.search.toLowerCase();
    data = data.filter(c => c.name.toLowerCase().includes(q));
  }
  const limit = Math.min(input.limit ?? 10, 25);
  const sliced = data.slice(0, limit);
  const campaigns: CampaignSummary[] = sliced.map(c => ({
    id: c.id,
    name: c.name ?? "",
    status: c.status ?? "",
    type: c.type ?? "",
    owner: c.owner ?? "",
    startDate: c.startDate ?? null,
    endDate: c.endDate ?? null,
  }));
  return { campaigns, hasMore: data.length > limit };
}

// ── getOrganization ─────────────────────────────────────────────────────────

export interface GetOrganizationInput {
  organizationsDbId: string;
  id: string;
}

export async function getOrganizationTool(input: GetOrganizationInput) {
  if (input.organizationsDbId !== PORT_DB.organizations) {
    throw new Error(
      `organizations dbId mismatch: expected PORT_DB.organizations, got ${input.organizationsDbId}`,
    );
  }

  const { data: orgsData } = await getOrganizationsFromSupabase();
  const org = orgsData.find(o => o.id === input.id);
  if (!org) throw new Error(`Organisation not found: ${input.id}`);
  return {
    id: org.id,
    name: org.name ?? null,
    website: org.website ?? null,
    priority: org.derivedPriority ?? null,
    connection: org.connection ?? null,
    regions: [],
    marketSegment: org.marketSegment ?? null,
    type: org.type ?? null,
    email: org.email ?? null,
  };
}

// ── queryPaytonSocialPlan ───────────────────────────────────────────────────

export interface QueryPaytonSocialPlanInput {
  socialPlanDbId: string;
  status?:
    | "idea"
    | "drafting"
    | "needs visuals"
    | "ready"
    | "scheduled"
    | "published";
  platform?:
    | "Facebook"
    | "Instagram"
    | "Substack"
    | "LinkedIn"
    | "Email"
    | "BlueSky";
  limit?: number;
}

export interface SocialPostSummary {
  id: string;
  postName: string;
  status: string;
  platforms: string[];
  publishDate: string | null;
  hook: string;
  assetLink: string | null;
}

export async function queryPaytonSocialPlanTool(
  input: QueryPaytonSocialPlanInput,
): Promise<{ posts: SocialPostSummary[]; hasMore: boolean }> {
  if (!input.socialPlanDbId) {
    throw new Error("socialPlanDbId is required");
  }

  const limit = Math.min(input.limit ?? 10, 25);

  const notionFilters: Record<string, unknown>[] = [];
  if (input.status) {
    notionFilters.push({
      property: "Status",
      select: { equals: input.status },
    });
  }
  if (input.platform) {
    notionFilters.push({
      property: "Platform",
      multi_select: { contains: input.platform },
    });
  }

  // Notion data_sources.query (we use data_source_id in this codebase for DBs).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (notion as any).dataSources.query({
    data_source_id: input.socialPlanDbId,
    filter:
      notionFilters.length > 1
        ? { and: notionFilters }
        : notionFilters[0] ?? undefined,
    sorts: [{ property: "Publish date", direction: "descending" }],
    page_size: limit,
  })) as { results: Array<Record<string, unknown>>; has_more: boolean };

  const posts: SocialPostSummary[] = res.results.map((page) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = (page as any).properties ?? {};
    const getTitle = (prop: string) =>
      (p[prop]?.title ?? []).map((t: { plain_text?: string }) => t.plain_text ?? "").join("");
    const getText = (prop: string) =>
      (p[prop]?.rich_text ?? []).map((t: { plain_text?: string }) => t.plain_text ?? "").join("");
    const getSelect = (prop: string) => p[prop]?.select?.name ?? "";
    const getMulti = (prop: string) =>
      (p[prop]?.multi_select ?? []).map((s: { name: string }) => s.name);
    const getDate = (prop: string) => p[prop]?.date?.start ?? null;
    const getUrl = (prop: string) => p[prop]?.url ?? null;

    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      id: (page as any).id,
      postName: getTitle("Post / campaign name"),
      status: getSelect("Status"),
      platforms: getMulti("Platform"),
      publishDate: getDate("Publish date"),
      hook: getText("Hook / angle"),
      assetLink: getUrl("Asset / draft link"),
    };
  });

  return { posts, hasMore: res.has_more };
}

// ── logActivity (write — confirm-gated) ────────────────────────────────────

export interface LogActivityInput {
  activity: string;
  activityType?: ActivityType;
  organizationIds?: string[];
  contactIds?: string[];
  notes?: string;
  outcome?: ActivityOutcome;
  /** ISO date string (YYYY-MM-DD). Defaults to today if omitted. */
  date?: string;
  /** Name of the user logging this — stamped in the loggedBy field. */
  loggedBy: string;
}

export interface ActivityRecord {
  id: string;
  activity: string;
  type: string;
  date: string | null;
  outcome: string;
  organizationIds: string[];
  contactIds: string[];
  notes: string;
  loggedBy: string;
}

/**
 * Execute a staged logActivity write against Notion.
 * Only called after the user has confirmed via confirmAction.
 */
export async function executeLogActivity(
  input: LogActivityInput,
): Promise<ActivityRecord> {
  const today = new Date().toISOString().slice(0, 10);
  const result = await createActivity({
    activity: input.activity,
    type: input.activityType ?? "other",
    organizationIds: input.organizationIds ?? [],
    contactIds: input.contactIds ?? [],
    notes: input.notes ?? "",
    outcome: input.outcome ?? "neutral",
    date: { start: input.date ?? today, end: null },
    loggedBy: input.loggedBy,
  });

  return {
    id: result.id,
    activity: result.activity,
    type: result.type ?? "",
    date: result.date?.start ?? null,
    outcome: result.outcome ?? "",
    organizationIds: result.organizationIds,
    contactIds: result.contactIds,
    notes: result.notes,
    loggedBy: result.loggedBy,
  };
}

// ── queryActivities ────────────────────────────────────────────────────────

export interface QueryActivitiesInput {
  orgId?: string;
  contactId?: string;
  search?: string;
  limit?: number;
}

export interface ActivitySummary {
  id: string;
  activity: string;
  type: string;
  date: string | null;
  outcome: string;
  notes: string;
  loggedBy: string;
}

/**
 * List recent CRM activities — optionally filtered by org or contact.
 * Read-only. Sorted newest first.
 */
export async function queryActivitiesTool(
  input: QueryActivitiesInput,
): Promise<{ activities: ActivitySummary[]; hasMore: boolean }> {
  const limit = Math.min(input.limit ?? 10, 25);
  const result = await existingQueryActivities(
    {
      orgId: input.orgId,
      contactId: input.contactId,
      search: input.search,
    },
    { pageSize: limit },
  );

  const activities: ActivitySummary[] = result.data.map((a) => ({
    id: a.id,
    activity: a.activity ?? "",
    type: a.type ?? "",
    date: a.date?.start ?? null,
    outcome: a.outcome ?? "",
    notes: a.notes ?? "",
    loggedBy: a.loggedBy ?? "",
  }));

  return { activities, hasMore: result.hasMore };
}

// Silence an unused-import warning — keep the import for future expansion.
void getCampaign;

// ── updateOrganization (write — confirm-gated) ─────────────────────────────

export interface UpdateOrganizationInput {
  organizationId: string;
  connection?: string;
  outreachStatus?: string;
  friendship?: string;
  fitRating?: string;
  marketSegment?: string;
  /**
   * Raw text to APPEND to the org's existing notes. A dated prefix is
   * added here; the existing notes value is fetched from Notion fresh
   * (not staged) to avoid a race with parallel updates.
   */
  notesAppend?: string;
}

export interface UpdateOrganizationResult {
  id: string;
  name: string;
  changedFields: string[];
}

/**
 * Execute a staged organization update.
 * Only called after the user has confirmed via confirmAction.
 *
 * Recomputes `relationship` when any of the trio (connection +
 * outreachStatus + friendship) is in the update, mirroring the logic
 * in updateConnection / updateOutreachStatus so the derived field stays
 * consistent with the inputs.
 */
export async function executeUpdateOrganization(
  input: UpdateOrganizationInput,
): Promise<UpdateOrganizationResult> {
  const existing = await existingGetOrganization(input.organizationId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {};
  const changed: string[] = [];

  if (input.connection !== undefined) {
    fields.connection = input.connection;
    changed.push("connection");
  }
  if (input.outreachStatus !== undefined) {
    fields.outreachStatus = input.outreachStatus;
    changed.push("outreachStatus");
  }
  if (input.friendship !== undefined) {
    fields.friendship = input.friendship;
    changed.push("friendship");
  }
  if (input.fitRating !== undefined) {
    fields.fitRating = input.fitRating;
    changed.push("fitRating");
  }
  if (input.marketSegment !== undefined) {
    fields.marketSegment = input.marketSegment;
    changed.push("marketSegment");
  }
  if (input.notesAppend !== undefined && input.notesAppend.trim() !== "") {
    const stamp = new Date().toISOString().slice(0, 10);
    const line = `[${stamp}] ${input.notesAppend.trim()}`;
    const existingNotes = existing.notes ?? "";
    fields.notes = existingNotes ? `${existingNotes}\n${line}` : line;
    changed.push("notes");
  }

  // Keep derived `relationship` consistent when any trio input changes.
  const connection = input.connection ?? existing.connection;
  const outreachStatus = input.outreachStatus ?? existing.outreachStatus;
  const friendship = input.friendship ?? existing.friendship;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fields.relationship = deriveRelationship(
    connection as Parameters<typeof deriveRelationship>[0],
    outreachStatus as Parameters<typeof deriveRelationship>[1],
    friendship as Parameters<typeof deriveRelationship>[2],
  );

  const result = await existingUpdateOrganization(input.organizationId, fields);

  return {
    id: result.id,
    name: result.organization,
    changedFields: changed,
  };
}

// ── updateCampaignStatus (write — confirm-gated) ───────────────────────────

export interface UpdateCampaignStatusInput {
  campaignId: string;
  newStatus: "draft" | "active" | "paused" | "complete";
  /** Optional human reason for the change, appended to campaign notes. */
  reason?: string;
}

export interface UpdateCampaignStatusResult {
  id: string;
  name: string;
  previousStatus: string | null;
  newStatus: string;
}

/**
 * Execute a staged campaign-status change.
 * Only called after the user has confirmed via confirmAction.
 *
 * Reads the current campaign first to capture the previous status for
 * the result payload — helpful feedback when Claude describes what
 * changed to the user. If `reason` is provided, appends it to the
 * campaign's `notes` with a dated prefix so the history is preserved.
 */
export async function executeUpdateCampaignStatus(
  input: UpdateCampaignStatusInput,
): Promise<UpdateCampaignStatusResult> {
  const existing = await getCampaign(input.campaignId);
  const previousStatus = existing.status ?? null;

  const updateFields: Parameters<typeof updateCampaign>[1] = {
    status: input.newStatus,
  };

  if (input.reason && input.reason.trim().length > 0) {
    const stamp = new Date().toISOString().slice(0, 10);
    const line = `[${stamp}] status → ${input.newStatus}: ${input.reason.trim()}`;
    updateFields.notes = existing.notes
      ? `${existing.notes}\n${line}`
      : line;
  }

  const result = await updateCampaign(input.campaignId, updateFields);

  return {
    id: result.id,
    name: result.name,
    previousStatus,
    newStatus: result.status,
  };
}

// ── createCampaign (write — confirm-gated) ─────────────────────────────────

export interface CreateCampaignInput {
  name: string;
  type: "event-based" | "recurring cadence" | "one-off blast";
  status?: "draft" | "active" | "paused" | "complete";
  owner?: string;
  /** ISO date string (YYYY-MM-DD). */
  startDate?: string;
  /** ISO date string (YYYY-MM-DD). */
  endDate?: string;
  notes?: string;
}

export interface CreateCampaignResult {
  id: string;
  name: string;
  type: string;
  status: string;
  owner: string;
  startDate: string | null;
  endDate: string | null;
}

/**
 * Execute a staged campaign creation.
 * Only called after the user has confirmed via confirmAction.
 *
 * Defaults `status` to "draft" when omitted — the safe initial state for
 * a freshly-staged campaign (no auto-activation from conversational intent).
 */
export async function executeCreateCampaign(
  input: CreateCampaignInput,
): Promise<CreateCampaignResult> {
  const campaign = await existingCreateCampaign({
    name: input.name,
    type: input.type,
    status: input.status ?? "draft",
    ...(input.owner ? { owner: input.owner } : {}),
    ...(input.startDate
      ? { startDate: { start: input.startDate, end: null } }
      : {}),
    ...(input.endDate
      ? { endDate: { start: input.endDate, end: null } }
      : {}),
    ...(input.notes ? { notes: input.notes } : {}),
  });

  return {
    id: campaign.id,
    name: campaign.name,
    type: campaign.type ?? "",
    status: campaign.status ?? "",
    owner: campaign.owner ?? "",
    startDate: campaign.startDate?.start ?? null,
    endDate: campaign.endDate?.start ?? null,
  };
}

// ── createOrganization (write — confirm-gated) ────────────────────────────

export interface CreateOrganizationInput {
  organization: string;
  type?: string;
  category?: string[];
  website?: string;
  email?: string;
  fitRating?: string;
  marketSegment?: string;
  notes?: string;
}

export interface CreateOrganizationResult {
  id: string;
  name: string;
}

export async function executeCreateOrganization(
  input: CreateOrganizationInput,
): Promise<CreateOrganizationResult> {
  const result = await existingCreateOrganization({
    organization: input.organization,
    type: input.type as Parameters<typeof existingCreateOrganization>[0]["type"],
    category: input.category as Parameters<typeof existingCreateOrganization>[0]["category"],
    website: input.website,
    email: input.email,
    fitRating: input.fitRating as Parameters<typeof existingCreateOrganization>[0]["fitRating"],
    marketSegment: input.marketSegment as Parameters<typeof existingCreateOrganization>[0]["marketSegment"],
    notes: input.notes,
  });

  return {
    id: result.id,
    name: result.organization,
  };
}

// ── queryContacts ──────────────────────────────────────────────────────────

export interface QueryContactsInput {
  orgId?: string;
  search?: string;
  limit?: number;
}

export interface ContactSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  orgIds: string[];
}

/**
 * List CRM contacts — optionally filtered by keyword search.
 * The orgId param is accepted for API consistency but post-filters the results
 * since ContactFilters does not expose an orgId predicate.
 * Read-only. Sorted newest-edited first.
 */
export async function queryContactsTool(
  input: QueryContactsInput,
): Promise<{ contacts: ContactSummary[]; hasMore: boolean }> {
  const { data: contactsData, total: contactsTotal } = await getContactsFromSupabase(
    { orgId: input.orgId, search: input.search },
    { pageSize: Math.min(input.limit ?? 10, 25) + 1 }, // +1 to detect hasMore
  );
  const limit = Math.min(input.limit ?? 10, 25);
  const sliced = contactsData.slice(0, limit);
  const contacts: ContactSummary[] = sliced.map(c => ({
    id: c.id,
    name: c.name ?? "",
    email: c.email ?? "",
    role: c.role ?? "",
    orgIds: c.orgId ? [c.orgId] : [],
  }));
  return { contacts, hasMore: contactsTotal > limit };
}

// ── queryDeals ─────────────────────────────────────────────────────────────

export interface QueryDealsInput {
  stage?: string;
  orgId?: string;
  limit?: number;
}

export interface DealSummary {
  id: string;
  name: string;
  stage: string;
  value: number | null;
  orgIds: string[];
  closeDate: string | null;
}

/**
 * List BD pipeline deals — optionally filtered by stage or organisation.
 * The orgId param post-filters results since DealFilters does not expose an
 * orgId predicate.
 * Read-only. Sorted newest-edited first.
 */
export async function queryDealsTool(
  input: QueryDealsInput,
): Promise<{ deals: DealSummary[]; hasMore: boolean }> {
  const limit = Math.min(input.limit ?? 10, 25);
  const result = await existingQueryDeals(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { stage: input.stage as any },
    { pageSize: limit },
  );

  let data = result.data;
  if (input.orgId) {
    data = data.filter((d) => d.organizationIds.includes(input.orgId!));
  }

  const deals: DealSummary[] = data.map((d) => ({
    id: d.id,
    name: d.deal ?? "",
    stage: d.stage ?? "",
    value: d.value ?? null,
    orgIds: d.organizationIds ?? [],
    closeDate: d.closeDate?.start ?? null,
  }));
  return { deals, hasMore: result.hasMore };
}

// ── queryRfpOpportunities ─────────────────────────────────────────────────

export interface QueryRfpOpportunitiesInput {
  status?: string;
  search?: string;
  limit?: number;
}

export interface RfpOpportunitySummary {
  id: string;
  name: string;
  status: string;
  orgIds: string[];
  dueDate: string | null;
  estimatedValue: number | null;
  fitScore: string | null;
}

/**
 * List RFP opportunities — optionally filtered by status or keyword search.
 * Read-only. Sorted by due date ascending (soonest first).
 */
export async function queryRfpOpportunitiesTool(
  input: QueryRfpOpportunitiesInput,
): Promise<{ opportunities: RfpOpportunitySummary[]; hasMore: boolean }> {
  const limit = Math.min(input.limit ?? 20, 50);
  const result = await getRfpOpportunitiesFromSupabase(
    { status: input.status, search: input.search },
    { page: 1, pageSize: limit },
  );
  const sliced = result.data;
  const opportunities: RfpOpportunitySummary[] = sliced.map((r) => ({
    id: r.id,
    name: r.opportunityName ?? "",
    status: r.status ?? "",
    orgIds: r.organizationIds ?? [],
    dueDate: r.dueDate?.start ?? null,
    estimatedValue: r.estimatedValue ?? null,
    fitScore: r.wvFitScore ?? null,
  }));
  return { opportunities, hasMore: result.total > limit };
}

// ── queryProjects ──────────────────────────────────────────────────────────

export interface QueryProjectsInput {
  status?: string;
  search?: string;
  limit?: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  status: string;
  priority: string | null;
  type: string | null;
  projectLeadIds: string[];
  timeline: string | null;
}

/**
 * List projects — optionally filtered by status or keyword search.
 * Read-only. Sorted newest-edited first.
 */
export async function queryProjectsTool(
  input: QueryProjectsInput,
): Promise<{ projects: ProjectSummary[]; hasMore: boolean }> {
  const limit = Math.min(input.limit ?? 20, 50);
  const result = await existingQueryProjects(
    {
      status: input.status as ProjectStatus | undefined,
      search: input.search,
    },
    { pageSize: limit },
  );

  const projects: ProjectSummary[] = result.data.map((p) => ({
    id: p.id,
    name: p.project ?? "",
    status: p.status ?? "",
    priority: p.priority ?? null,
    type: p.type ?? null,
    projectLeadIds: p.projectLeadIds ?? [],
    timeline: p.timeline?.start ?? null,
  }));

  return { projects, hasMore: result.hasMore };
}

// ── updateDeal (write — confirm-gated) ────────────────────────────────────

export interface ExecuteUpdateDealInput {
  dealId: string;
  stage: string;
  notes?: string;
}

export interface UpdateDealResult {
  updated: true;
  dealId: string;
  stage: string;
}

/**
 * Execute a staged deal update.
 * Only called after the user has confirmed via confirmAction.
 *
 * Reads the current deal first to append notes (not overwrite).
 * Returns a minimal result — the caller summarises what changed.
 */
export async function executeUpdateDeal(
  input: ExecuteUpdateDealInput,
): Promise<UpdateDealResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {
    stage: input.stage as Parameters<typeof existingUpdateDeal>[1]["stage"],
  };

  if (input.notes && input.notes.trim().length > 0) {
    const existing = await getDeal(input.dealId);
    const stamp = new Date().toISOString().slice(0, 10);
    const line = `[${stamp}] ${input.notes.trim()}`;
    const existingNotes = existing.notes ?? "";
    fields.notes = existingNotes ? `${existingNotes}\n${line}` : line;
  }

  await existingUpdateDeal(input.dealId, fields);

  return {
    updated: true,
    dealId: input.dealId,
    stage: input.stage,
  };
}

// ── queryTimesheets ────────────────────────────────────────────────────

export interface QueryTimesheetsInput {
  dateAfter?: string;
  dateBefore?: string;
  status?: string;
  personId?: string;
  search?: string;
  limit?: number;
}

export interface TimesheetEntrySummary {
  id: string;
  description: string;
  hours: number | null;
  minutes: number | null;
  date: string | null;
  status: string;
  billable: boolean;
  type: string;
  amount: number | null;
}

export async function queryTimesheetsTool(
  input: QueryTimesheetsInput,
): Promise<{ entries: TimesheetEntrySummary[]; hasMore: boolean }> {
  let data = await getTimesheetsFromSupabase(
    input.status,
    input.personId,
    input.dateAfter,
    input.dateBefore,
  );

  if (input.search) {
    const q = input.search.toLowerCase();
    data = data.filter((t) => t.entry?.toLowerCase().includes(q));
  }

  const limit = Math.min(input.limit ?? 20, 50);
  const sliced = data.slice(0, limit);

  const entries: TimesheetEntrySummary[] = sliced.map((t) => ({
    id: t.id,
    description: t.entry ?? "",
    hours: t.hours ?? null,
    minutes: t.minutes ?? null,
    date: t.dateAndTime?.start ?? null,
    status: t.status ?? "",
    billable: t.billable ?? false,
    type: t.type ?? "time",
    amount: t.amount ?? null,
  }));

  return { entries, hasMore: data.length > limit };
}

// ── queryWorkItems ─────────────────────────────────────────────────────

export interface QueryWorkItemsInput {
  status?: string;
  priority?: string;
  ownerId?: string;
  projectId?: string;
  search?: string;
  limit?: number;
}

export interface WorkItemSummary {
  id: string;
  task: string;
  status: string;
  priority: string | null;
  taskType: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  projectIds: string[];
  ownerIds: string[];
}

export async function queryWorkItemsTool(
  input: QueryWorkItemsInput,
): Promise<{ items: WorkItemSummary[]; hasMore: boolean }> {
  let data = await getWorkItemsFromSupabase(input.status, input.ownerId, input.projectId);

  if (input.search) {
    const q = input.search.toLowerCase();
    data = data.filter((w) => w.task?.toLowerCase().includes(q));
  }
  if (input.priority) {
    data = data.filter((w) => w.priority === input.priority);
  }

  const limit = Math.min(input.limit ?? 20, 50);
  const sliced = data.slice(0, limit);

  const items: WorkItemSummary[] = sliced.map((w) => ({
    id: w.id,
    task: w.task ?? "",
    status: w.status ?? "",
    priority: w.priority ?? null,
    taskType: w.taskType ?? null,
    dueDate: w.dueDate?.start ?? null,
    estimateHours: w.estimateHours ?? null,
    projectIds: w.projectIds ?? [],
    ownerIds: w.ownerIds ?? [],
  }));

  return { items, hasMore: data.length > limit };
}

// ── queryEvents ────────────────────────────────────────────────────────

export interface QueryEventsInput {
  search?: string;
  limit?: number;
}

export interface EventSummary {
  id: string;
  event: string;
  type: string | null;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  relevanceTags: string[];
}

export async function queryEventsTool(
  input: QueryEventsInput,
): Promise<{ events: EventSummary[]; hasMore: boolean }> {
  const limit = Math.min(input.limit ?? 15, 30);
  const result = await existingQueryEvents(
    { search: input.search },
    { pageSize: limit },
  );

  const events: EventSummary[] = result.data.map((e) => ({
    id: e.id,
    event: e.event ?? "",
    type: e.type ?? null,
    startDate: e.eventDates?.start ?? null,
    endDate: e.eventDates?.end ?? null,
    location: e.location ?? null,
    relevanceTags: e.quadrantRelevance ?? [],
  }));

  return { events, hasMore: result.hasMore };
}

// ── queryMembers ───────────────────────────────────────────────────────

export interface MemberSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  capacity: string | null;
}

export async function queryMembersTool(): Promise<{ members: MemberSummary[] }> {
  const members = await getActiveMembersFromSupabase();
  return {
    members: members.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: m.companyRole,
      capacity: m.capacity,
    })),
  };
}

// ── logTimeEntry (write — confirm-gated) ──────────────────────────────

export interface LogTimeEntryInput {
  entry: string;
  projectIds: string[];
  personIds: string[];
  hours: number;
  date: string;
  notes: string;
}

export interface TimeEntryRecord {
  id: string;
  entry: string;
  hours: number | null;
  date: string | null;
  status: string;
}

/**
 * Execute a staged logTimeEntry write against Notion.
 * Only called after the user has confirmed via confirmAction.
 * Links the entry to a project (via taskIds) and person.
 */
export async function executeLogTimeEntry(
  input: LogTimeEntryInput,
): Promise<TimeEntryRecord> {
  const result = await createTimesheet({
    entry: input.entry,
    personIds: input.personIds.length ? input.personIds : undefined,
    taskIds: input.projectIds.length ? input.projectIds : undefined,
    hours: input.hours,
    dateAndTime: { start: input.date, end: null },
    explanation: input.notes || undefined,
    status: "draft",
  });

  return {
    id: result.id,
    entry: result.entry ?? "",
    hours: result.hours ?? null,
    date: result.dateAndTime?.start ?? null,
    status: result.status ?? "draft",
  };
}

// ── updateContact (write — confirm-gated) ──────────────────────────────────

export interface UpdateContactInput {
  contactId: string;
  email?: string;
  role?: string;
  /**
   * REPLACES the existing nextAction value (not appended) — semantically
   * this field tracks the current next step, not a log of past steps.
   */
  nextAction?: string;
}

export interface UpdateContactResult {
  id: string;
  name: string;
  changedFields: string[];
}

/**
 * Execute a staged contact update.
 * Only called after the user has confirmed via confirmAction.
 *
 * Narrow by design: only email / role / nextAction may be written —
 * see AGENT_WRITABLE_CONTACT_FIELDS for the rationale on exclusions.
 */
export async function executeUpdateContact(
  input: UpdateContactInput,
): Promise<UpdateContactResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fields: Record<string, any> = {};
  const changed: string[] = [];

  if (input.email !== undefined) {
    fields.email = input.email;
    changed.push("email");
  }
  if (input.role !== undefined) {
    fields.role = input.role;
    changed.push("role");
  }
  if (input.nextAction !== undefined) {
    fields.nextAction = input.nextAction;
    changed.push("nextAction");
  }

  const result = await existingUpdateContact(input.contactId, fields);

  return {
    id: result.id,
    name: result.name,
    changedFields: changed,
  };
}

// ── getContactTool (internal — preview helper for updateContact) ───────────

export interface GetContactInput {
  contactsDbId: string;
  id: string;
}

/**
 * Resolve a contact page to a flat projection. Used by the updateContact
 * staging path to capture the contact's name for the preview line. Not
 * exposed as a standalone agent tool (yet) — contact-list reads aren't in
 * the agent's tool surface.
 */
export async function getContactTool(input: GetContactInput) {
  if (input.contactsDbId !== PORT_DB.contacts) {
    throw new Error(
      `contacts dbId mismatch: expected PORT_DB.contacts, got ${input.contactsDbId}`,
    );
  }
  const contact = await existingGetContact(input.id);
  return {
    id: contact.id,
    name: contact.name ?? null,
    email: contact.email ?? null,
    role: contact.role ?? null,
    nextAction: contact.nextAction ?? null,
  };
}
