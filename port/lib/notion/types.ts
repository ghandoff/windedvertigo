/**
 * Port TypeScript types — derived from Notion database schemas.
 *
 * 6 databases post-consolidation:
 *   organizations (unified groups + market map)
 *   contacts (people)
 *   projects
 *   BD assets
 *   competitive landscape
 *   events & conferences
 */

import type { DateRange, Place } from "@/lib/shared/notion";

// ── re-export shared types ────────────────────────────────
export type { DateRange, Place };

// ── organizations (unified) ───────────────────────────────

export type ConnectionStatus =
  | "unengaged"
  | "exploring"
  | "in progress"
  | "collaborating"
  | "champion"
  | "steward"
  | "past client";

export type OrgType =
  | "ngo"
  | "studio"
  | "corporate"
  | "non-profit"
  | "foundation"
  | "government"
  | "individual donor"
  | "consultancy/firm"
  | "academic institution";

export type OrgCategory =
  | "arts & culture"
  | "community development"
  | "corporate training"
  | "education & learning"
  | "healthcare & wellbeing"
  | "international development"
  | "social innovation"
  | "sustainability & environment"
  | "technology & innovation"
  | "youth development";

export type Region =
  | "asia"
  | "global"
  | "europe"
  | "north america"
  | "africa";

export type OrgSource =
  | "cold research"
  | "conference"
  | "direct network"
  | "partner referral"
  | "rfp platform"
  | "internal";

export type Priority = "Tier 1 – Pursue now" | "Tier 2 – Warm up" | "Tier 3 – Monitor";

export type FitRating = "🔥 Perfect fit" | "✅ Strong fit" | "🟡 Moderate fit";

export type Friendship =
  | "Inner circle"
  | "Warm friend"
  | "Friendly contact"
  | "Loose tie"
  | "Known-of / name in common"
  | "Stranger";

export type HowTheyBuy =
  | "RFP/Tender"
  | "Direct outreach"
  | "Warm intro"
  | "Conference"
  | "Open call/Grant"
  | "Subcontract";

export type OutreachStatus =
  | "Not started"
  | "Researching"
  | "Contacted"
  | "In conversation"
  | "Proposal sent"
  | "Active client"
  | "Opted out";

/**
 * Unified relationship lifecycle — replaces the overlapping friendship,
 * connection status, and outreach status fields with a single progression.
 *
 * Mapped from the Notion "connection" status property:
 *   unengaged → stranger, exploring → aware, in progress → contacted,
 *   collaborating → in conversation, champion → collaborating,
 *   steward → active partner, past client → active partner
 *
 * Can be overridden once the Notion "relationship" status property
 * is created and backfilled.
 */
export type Relationship =
  | "stranger"
  | "aware"
  | "contacted"
  | "in conversation"
  | "collaborating"
  | "active partner"
  | "champion";

export type DerivedPriority = "tier 1" | "tier 2" | "tier 3";

export type Quadrant =
  | "Design + Deploy"
  | "Pinpoint + Prove"
  | "Build + Iterate"
  | "Test + Validate";

export interface Organization {
  id: string;
  organization: string;
  connection: ConnectionStatus;
  type: OrgType;
  category: OrgCategory[];
  regions: Region[];
  source: OrgSource;
  website: string;
  place: Place | null;
  email: string;
  outreachTarget: string;
  priority: Priority;
  fitRating: FitRating;
  friendship: Friendship;
  howTheyBuy: HowTheyBuy;
  marketSegment: string;
  quadrant: Quadrant;
  crossQuadrant: Quadrant[];
  serviceLine: string[];
  targetServices: string;
  buyingTrigger: string;
  buyerRole: string;
  subject: string;
  bespokeEmailCopy: string;
  outreachSuggestion: string;
  outreachStatus: OutreachStatus;
  /** Unified relationship lifecycle — derived from connection + friendship + outreach status. */
  relationship: Relationship;
  /** Auto-derived priority from fit + relationship. Replaces manually-set priority. */
  derivedPriority: DerivedPriority;
  notes: string;
  contactIds: string[];
  projectIds: string[];
  bdAssetIds: string[];
  competitorIds: string[];
  logo?: string;
  description?: string;
  linkedinUrl?: string;
  enrichedAt?: string;
  outreachReady?: boolean;
  createdTime: string;
  lastEditedTime: string;
}

// ── contacts (people) ─────────────────────────────────────

export type ContactType =
  | "decision maker"
  | "program officer"
  | "collaborator"
  | "referral source"
  | "team member"
  | "manager"
  | "ceo"
  | "consultant";

export type ContactWarmth = "cold" | "lukewarm" | "warm" | "hot";

export type RelationshipStage =
  | "stranger"
  | "introduced"
  | "in conversation"
  | "warm connection"
  | "active collaborator"
  | "inner circle";

export type Responsiveness =
  | "very responsive"
  | "usually responsive"
  | "slow to respond"
  | "non-responsive";

export interface Contact {
  id: string;
  name: string;
  email: string;
  role: string;
  contactType: ContactType;
  contactWarmth: ContactWarmth;
  responsiveness: Responsiveness;
  referralPotential: boolean;
  linkedin: string;
  phoneNumber: string;
  profilePhotoUrl: string;
  relationshipStage: RelationshipStage;
  lastContacted: DateRange | null;
  nextAction: string;
  organizationIds: string[];
  nodeUserIds: string[];
  createdTime: string;
  lastEditedTime: string;
}

export interface ContactFilters {
  contactType?: ContactType;
  contactWarmth?: ContactWarmth;
  responsiveness?: Responsiveness;
  relationshipStage?: RelationshipStage;
  referralPotential?: boolean;
  search?: string;
}

// ── activities ────────────────────────────────────────────

export type ActivityType =
  | "email sent"
  | "email opened"
  | "link clicked"
  | "email bounced"
  | "email received"
  | "site visit"
  | "meeting"
  | "call"
  | "conference encounter"
  | "intro made"
  | "linkedin message"
  | "proposal shared"
  | "other";

export type ActivityOutcome = "positive" | "neutral" | "no response" | "declined";

export interface Activity {
  id: string;
  activity: string;
  type: ActivityType;
  contactIds: string[];
  organizationIds: string[];
  eventIds: string[];
  date: DateRange | null;
  outcome: ActivityOutcome;
  notes: string;
  loggedBy: string;
  createdTime: string;
  lastEditedTime: string;
}

export interface ActivityFilters {
  type?: ActivityType;
  outcome?: ActivityOutcome;
  contactId?: string;
  orgId?: string;
  eventId?: string;
  search?: string;
}

// ── projects ──────────────────────────────────────────────

export type ProjectStatus =
  | "icebox"
  | "in queue"
  | "in progress"
  | "under review"
  | "suspended"
  | "complete"
  | "cancelled";

export type ProjectPriority = "low" | "medium" | "high" | "urgent";

export type ProjectType = "studio" | "contract";

export interface Project {
  id: string;
  project: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  type: ProjectType | null;
  budgetHours: number | null;
  eventType: string;
  timeline: DateRange | null;
  dateAndTime: DateRange | null;
  projectLeadIds: string[];
  organizationIds: string[];
  milestoneIds: string[];
  taskIds: string[];
  cycleIds: string[];
  archive: boolean;
  createdTime: string;
  lastEditedTime: string;
}

// ── BD assets ─────────────────────────────────────────────

export type ReadinessStatus =
  | "idea"
  | "needs prep"
  | "draft"
  | "seeking feedback"
  | "in production"
  | "needs trace support"
  | "needs final assets attached"
  | "ready"
  | "needs refresh";

export interface BdAsset {
  id: string;
  asset: string;
  assetType: string;
  readiness: ReadinessStatus;
  description: string;
  slug: string;
  tags: string[];
  url: string;
  thumbnailUrl: string;
  icon: string;
  featured: boolean;
  showInPortfolio: boolean;
  showInPackageBuilder: boolean;
  passwordProtected: boolean;
  organizationIds: string[];
  timesUsed: number | null;
  createdTime: string;
  lastEditedTime: string;
}

// ── competitive landscape ─────────────────────────────────

export type CompetitorType =
  | "Direct Competitor"
  | "Adjacent Player"
  | "Conference / Event"
  | "Network / Association"
  | "Certification Body";

export type ThreatLevel = "🔴 High" | "🟡 Medium" | "🟢 Low";

export type Geography =
  | "Global"
  | "US"
  | "UK"
  | "Europe"
  | "Latin America"
  | "East Africa"
  | "Middle East"
  | "Asia-Pacific";

export interface Competitor {
  id: string;
  organisation: string;
  type: CompetitorType;
  threatLevel: ThreatLevel;
  quadrantOverlap: Quadrant[];
  geography: Geography[];
  whatTheyOffer: string;
  whereWvWins: string;
  relevanceToWv: string;
  notes: string;
  url: string;
  organizationIds: string[];
  lastEditedTime: string;
}

// ── events & conferences ──────────────────────────────────

export type EventType =
  | "Conference"
  | "Summit"
  | "Trade Show"
  | "Academic Conference"
  | "Awards / Ceremony"
  | "Network Event";

export type EventFrequency = "Annual" | "Biannual" | "Quarterly" | "One-off";

export type TeamMember = "Garrett" | "María" | "Jamie" | "Lamis" | "Yigal";

export interface CrmEvent {
  id: string;
  event: string;
  type: EventType;
  eventDates: DateRange | null;
  proposalDeadline: DateRange | null;
  frequency: EventFrequency;
  location: string;
  estAttendance: string;
  registrationCost: string;
  quadrantRelevance: Quadrant[];
  bdSegments: string;
  whoShouldAttend: TeamMember[];
  whyItMatters: string;
  notes: string;
  url: string;
  lastEditedTime: string;
}

// ── email & social drafts ─────────────────────────────────

export type EmailDraftStatus = "draft" | "scheduled" | "sending" | "sent" | "failed";

export interface EmailDraft {
  id: string;
  organizationId: string;
  /** Contact ID when sent via contact fan-out (null = org email fallback). */
  contactId: string | null;
  campaignId: string | null;
  stepId: string | null;
  subject: string;
  body: string;
  status: EmailDraftStatus;
  sentAt: string | null;
  /** Actual email address the message was delivered to. */
  sentTo: string;
  resendMessageId: string;
  opens: number;
  clicks: number;
  machineOpens: number;
  createdTime: string;
  lastEditedTime: string;
}

export type SocialPlatform = "linkedin" | "twitter" | "bluesky" | "instagram" | "facebook" | "substack";
export type SocialDraftStatus = "draft" | "scheduled" | "posted";

export interface SocialDraft {
  id: string;
  content: string;
  platform: SocialPlatform;
  mediaUrls: string;
  scheduledFor: DateRange | null;
  status: SocialDraftStatus;
  organizationId: string;
  notes: string;
  createdTime: string;
  lastEditedTime: string;
}

// ── RFP radar ────────────────────────────────────────────

export type RfpStatus =
  | "radar"
  | "reviewing"
  | "pursuing"
  | "interviewing"
  | "submitted"
  | "won"
  | "lost"
  | "no-go"
  | "missed deadline";

export type OpportunityType =
  | "RFP"
  | "RFQ"
  | "RFI"
  | "Grant"
  | "EOI"
  | "Cold Lead"
  | "Warm Intro"
  | "Conference Contact"
  | "Direct Outreach";

export type WvFitScore = "high fit" | "medium fit" | "low fit" | "TBD";

export type RfpServiceMatch =
  | "MEL & Evaluation"
  | "Curriculum Design"
  | "Play-Based Learning"
  | "Professional Learning & PD"
  | "Learning Design"
  | "Assessment & Research"
  | "Facilitation"
  | "Dashboards & Tech"
  | "Strategic Planning";

export type RfpSource =
  | "RFP Platform"
  | "Google Alert"
  | "RSS Feed"
  | "Cold Research"
  | "Conference"
  | "Direct Network"
  | "Partner Referral"
  | "Email Alert"
  | "Manual Entry";

export interface RfpOpportunity {
  id: string;
  opportunityName: string;
  status: RfpStatus;
  opportunityType: OpportunityType;
  organizationIds: string[];
  relatedProjectIds: string[];
  ownerIds: string[];
  dueDate: DateRange | null;
  estimatedValue: number | null;
  wvFitScore: WvFitScore;
  serviceMatch: RfpServiceMatch[];
  category: string[];
  geography: string[];
  source: RfpSource;
  requirementsSnapshot: string;
  decisionNotes: string;
  url: string;
  proposalStatus: "queued" | "generating" | "ready-for-review" | "complete" | "failed" | null;
  proposalDraftUrl: string | null;
  rfpDocumentUrl: string | null;
  questionBankUrl: string | null;
  questionCount: number | null;
  coverLetterUrl: string | null;
  teamCvsUrl: string | null;
  // debrief — populated after won/lost/no-go
  whatWorked: string;
  whatFellFlat: string;
  clientFeedback: string;
  lessonsForNextTime: string;
  // delta capture — timestamped log of human edits to AI-generated content
  proposalNotes: string;
  createdTime: string;
  lastEditedTime: string;
}

// ── rate reference ────────────────────────────────────────

export interface RateReference {
  id: string;
  role: string;
  dailyRateLow: number | null;
  dailyRateHigh: number | null;
  funderType: string | null;
  geography: string | null;
  source: string | null;
  icsLevel: string | null;
  notes: string;
}

export interface RfpFilters {
  status?: RfpStatus;
  opportunityType?: OpportunityType;
  wvFitScore?: WvFitScore;
  source?: RfpSource;
  search?: string;
}

// ── campaigns ─────────────────────────────────────────────

export type CampaignType = "event-based" | "recurring cadence" | "one-off blast";
export type CampaignStatus = "draft" | "active" | "paused" | "complete";

export interface AudienceFilter {
  // ── primary filters (4 promoted) ──────────────────────────
  fitRating?: FitRating | FitRating[];
  relationship?: Relationship | Relationship[];
  source?: OrgSource | OrgSource[];
  marketSegment?: string | string[];

  // ── secondary / structural (retained for power users) ─────
  quadrant?: Quadrant | Quadrant[];
  type?: OrgType | OrgType[];
  category?: OrgCategory | OrgCategory[];
  region?: Region | Region[];

  // ── legacy keys (silently ignored by UI, kept for old campaign JSON compat) ─
  /** @deprecated Use `relationship` instead. Kept so existing campaign audience JSON doesn't break. */
  priority?: Priority | Priority[];
  /** @deprecated Use `relationship` instead. */
  friendship?: Friendship | Friendship[];
  /** @deprecated Use `relationship` instead. */
  outreachStatus?: OutreachStatus | OutreachStatus[];
  /** @deprecated Use `relationship` instead. */
  connection?: ConnectionStatus | ConnectionStatus[];

  // ── manual overrides ──────────────────────────────────────
  /** Org IDs manually added to the campaign audience (persisted in the audienceFilters JSON blob). */
  addedOrgIds?: string[];
  /** Org IDs explicitly excluded from the campaign audience. */
  removedOrgIds?: string[];
  /** Contact IDs manually added to the campaign audience. */
  addedContactIds?: string[];
  /** Contact IDs explicitly excluded from the org fan-out (won't receive even if linked to an audience org). */
  removedContactIds?: string[];
}

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  status: CampaignStatus;
  eventIds: string[];
  audienceFilters: AudienceFilter;
  owner: string;
  startDate: DateRange | null;
  endDate: DateRange | null;
  notes: string;
  createdTime: string;
  lastEditedTime: string;
}

export interface CampaignFilters {
  status?: CampaignStatus;
  type?: CampaignType;
  search?: string;
}

// ── campaign steps ────────────────────────────────────────

export type StepChannel = "email" | "linkedin" | "twitter" | "bluesky";
export type StepStatus = "draft" | "scheduled" | "sending" | "sent" | "skipped";

export interface CampaignStep {
  id: string;
  name: string;
  campaignIds: string[];
  stepNumber: number | null;
  channel: StepChannel;
  subject: string;
  body: string;
  delayDays: number | null;
  sendDate: DateRange | null;
  status: StepStatus;
  variantBSubject: string;
  variantBBody: string;
  condition: string;
  sentCount: number | null;
  skippedCount: number | null;
  failedCount: number | null;
  createdTime: string;
  lastEditedTime: string;
}

export interface CampaignStepFilters {
  campaignId?: string;
  status?: StepStatus;
  channel?: StepChannel;
  search?: string;
}

// ── email templates ───────────────────────────────────────

export type TemplateCategory = "outreach" | "follow-up" | "event invite" | "newsletter" | "other";

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: TemplateCategory;
  channel: StepChannel;
  notes: string;
  timesUsed: number;
  createdTime: string;
  lastEditedTime: string;
}

export interface EmailTemplateFilters {
  category?: TemplateCategory;
  channel?: StepChannel;
  search?: string;
}

// ── campaign blueprints ───────────────────────────────────

export type BlueprintCategory = "event-based" | "outreach" | "nurture" | "social" | "follow-up";
export type DelayReference = "after previous step" | "before event" | "after event";

export interface Blueprint {
  id: string;
  name: string;
  description: string;
  channels: StepChannel[];
  category: BlueprintCategory;
  stepCount: number;
  totalDays: number;
  notes: string;
  createdTime: string;
}

export interface BlueprintStep {
  id: string;
  name: string;
  blueprintIds: string[];
  stepNumber: number;
  channel: StepChannel;
  templateIds: string[];
  delayDays: number;
  delayReference: DelayReference;
  notes: string;
}

export interface BlueprintFilters {
  category?: BlueprintCategory;
  channel?: StepChannel;
  search?: string;
}

// ── deals ─────────────────────────────────────────────

export type DealStage = "identified" | "pitched" | "proposal" | "won" | "lost";

export type DealLostReason =
  | "budget"
  | "timing"
  | "no fit"
  | "went with competitor"
  | "no response"
  | "other";

export interface Deal {
  id: string;
  deal: string;
  stage: DealStage;
  organizationIds: string[];
  rfpOpportunityIds: string[];
  owner: string;
  value: number | null;
  closeDate: DateRange | null;
  lostReason: DealLostReason | null;
  notes: string;
  documents?: string; // newline-separated Google Drive URLs
  debriefWhatWorked: string;
  debriefWhatFellFlat: string;
  debriefWhatWasMissing: string;
  debriefClientFeedback: string;
  createdTime: string;
  lastEditedTime: string;
}

export interface DealFilters {
  stage?: DealStage;
  search?: string;
}

// ── annotated bibliography ─────────────────────────────────

export interface BibliographyEntry {
  id: string;
  fullCitation: string;
  abstract: string;
  keywords: string;
  notes: string;
  topic: string | null;
  sourceType: string | null;
  year: number | null;
  doi: string | null;
  publisherLink: string | null;
  citationCount: number | null;
}

// ── query helpers ─────────────────────────────────────────

export interface PaginationParams {
  cursor?: string;
  pageSize?: number;
  /** When true, exhaust all pages (loops until has_more === false). Use for
   *  bulk server-side fetches (projects page milestone→task map, etc). */
  fetchAll?: boolean;
}

export interface SortParams {
  property: string;
  direction: "ascending" | "descending";
}

export interface OrganizationFilters {
  // ── primary filters ───────────────────────────────────────
  fitRating?: FitRating | FitRating[];
  relationship?: Relationship | Relationship[];
  source?: OrgSource | OrgSource[];
  marketSegment?: string | string[];

  // ── structural ────────────────────────────────────────────
  type?: OrgType | OrgType[];
  category?: OrgCategory | OrgCategory[];
  region?: Region | Region[];
  quadrant?: Quadrant | Quadrant[];
  search?: string;

  // ── legacy (still functional for API backward compat) ─────
  connection?: ConnectionStatus | ConnectionStatus[];
  outreachStatus?: OutreachStatus | OutreachStatus[];
  priority?: Priority | Priority[];
  friendship?: Friendship | Friendship[];
}



export interface ProjectFilters {
  status?: ProjectStatus;
  priority?: ProjectPriority;
  type?: ProjectType;
  archive?: boolean;
  search?: string;
}

export interface CompetitorFilters {
  type?: CompetitorType;
  threatLevel?: ThreatLevel;
  quadrantOverlap?: Quadrant;
  geography?: Geography;
  search?: string;
}

export interface EventFilters {
  type?: EventType;
  quadrantRelevance?: Quadrant;
  whoShouldAttend?: TeamMember;
  upcoming?: boolean;
  search?: string;
}

// ── PM: phases & milestones ──────────────────────────────
// A row in this DB is either a `phase` (duration-bearing, contains work items,
// tied to billing) or a `milestone` (zero-duration checkpoint — approval,
// delivery, launch). Renders as a bar or a diamond on the project timeline.

export type MilestoneKind = "phase" | "milestone";

export type MilestoneStatus =
  | "not started"
  | "in progress"
  | "complete"
  | "blocked";

export interface Milestone {
  id: string;
  milestone: string;
  kind: MilestoneKind;
  milestoneStatus: MilestoneStatus;
  projectIds: string[];
  taskIds: string[];
  startDate: string | null;
  endDate: string | null;
  ownerIds: string[];
  clientVisible: boolean;
  description: string;
  brief: string;
  billingTotal: number | null;
  archive: boolean;
  createdTime: string;
  lastEditedTime: string;
}

export interface MilestoneFilters {
  kind?: MilestoneKind;
  milestoneStatus?: MilestoneStatus;
  projectId?: string;
  clientVisible?: boolean;
  includeArchived?: boolean;
  search?: string;
}

// ── PM: work items (tasks) ───────────────────────────────

export type WorkItemStatus =
  | "icebox"
  | "in queue"
  | "in progress"
  | "suspended"
  | "internal review"
  | "needs documentation"
  | "client review"
  | "complete"
  | "cancelled";

export type WorkItemType =
  | "plan"
  | "design"
  | "research"
  | "implement"
  | "publish/present"
  | "adapt"
  | "review"
  | "admin"
  | "coordinate"
  | "weekly/recurring"
  | "support";

export type WorkItemPriority = "low" | "medium" | "high" | "urgent";

export interface WorkItem {
  id: string;
  task: string;
  status: WorkItemStatus;
  taskType: WorkItemType;
  priority: WorkItemPriority;
  ownerIds: string[];
  personIds: string[];
  projectIds: string[];
  milestoneIds: string[];
  parentTaskIds: string[];
  subTaskIds: string[];
  blockingIds: string[];
  blockedByIds: string[];
  timesheetIds: string[];
  meetingIds: string[];
  dueDate: DateRange | null;
  estimateHours: number | null;
  archive: boolean;
  createdTime: string;
  lastEditedTime: string;
}

export interface WorkItemFilters {
  status?: WorkItemStatus;
  taskType?: WorkItemType;
  priority?: WorkItemPriority;
  projectId?: string;
  milestoneId?: string;
  archive?: boolean;
  search?: string;
}

// ── PM: timesheets (time entries) ────────────────────────

export type TimesheetStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "invoiced"
  | "paid";

export type TimesheetType = "time" | "reimbursement";

export interface Timesheet {
  id: string;
  entry: string;
  personIds: string[];
  dateAndTime: DateRange | null;
  hours: number | null;
  minutes: number | null;
  status: TimesheetStatus;
  /** "time" (default) or "reimbursement" for expense entries. */
  type: TimesheetType;
  taskIds: string[];
  meetingIds: string[];
  billable: boolean;
  rate: number | null;
  /** Flat dollar amount — used for reimbursement entries. */
  amount: number | null;
  explanation: string;
  createdTime: string;
  lastEditedTime: string;
}

export interface TimesheetFilters {
  status?: TimesheetStatus;
  type?: TimesheetType;
  billable?: boolean;
  taskId?: string;
  personId?: string;
  dateAfter?: string;
  dateBefore?: string;
  search?: string;
}

// ── PM: cycles (studio sprints) ──────────────────────────

export type CycleStatus = "planned" | "active" | "complete";

export interface Cycle {
  id: string;
  cycle: string;
  startDate: DateRange | null;
  endDate: DateRange | null;
  projectIds: string[];
  status: CycleStatus;
  goal: string;
  createdTime: string;
  lastEditedTime: string;
}

export interface CycleFilters {
  status?: CycleStatus;
  projectId?: string;
  search?: string;
}
