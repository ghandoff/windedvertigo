/**
 * CRM TypeScript types — derived from Notion database schemas.
 *
 * 6 databases post-consolidation:
 *   organizations (unified groups + market map)
 *   contacts (people)
 *   projects
 *   BD assets
 *   competitive landscape
 *   events & conferences
 */

import type { DateRange, Place } from "@windedvertigo/notion";

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
  notes: string;
  contactIds: string[];
  projectIds: string[];
  bdAssetIds: string[];
  competitorIds: string[];
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
  | "email received"
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

export interface Project {
  id: string;
  project: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  eventType: string;
  timeline: DateRange | null;
  dateAndTime: DateRange | null;
  projectLeadIds: string[];
  organizationIds: string[];
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
  createdTime: string;
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
  subject: string;
  body: string;
  status: EmailDraftStatus;
  sentAt: string | null;
  resendMessageId: string;
  opens: number;
  clicks: number;
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
  createdTime: string;
  lastEditedTime: string;
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
  priority?: Priority | Priority[];
  fitRating?: FitRating | FitRating[];
  friendship?: Friendship | Friendship[];
  outreachStatus?: OutreachStatus | OutreachStatus[];
  connection?: ConnectionStatus | ConnectionStatus[];
  quadrant?: Quadrant | Quadrant[];
  marketSegment?: string | string[];
  type?: OrgType | OrgType[];
  category?: OrgCategory | OrgCategory[];
  region?: Region | Region[];
  source?: OrgSource | OrgSource[];
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

// ── query helpers ─────────────────────────────────────────

export interface PaginationParams {
  cursor?: string;
  pageSize?: number;
}

export interface SortParams {
  property: string;
  direction: "ascending" | "descending";
}

export interface OrganizationFilters {
  connection?: ConnectionStatus | ConnectionStatus[];
  outreachStatus?: OutreachStatus | OutreachStatus[];
  type?: OrgType | OrgType[];
  category?: OrgCategory | OrgCategory[];
  region?: Region | Region[];
  source?: OrgSource | OrgSource[];
  priority?: Priority | Priority[];
  fitRating?: FitRating | FitRating[];
  friendship?: Friendship | Friendship[];
  marketSegment?: string | string[];
  quadrant?: Quadrant | Quadrant[];
  search?: string;
}



export interface ProjectFilters {
  status?: ProjectStatus;
  priority?: ProjectPriority;
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
