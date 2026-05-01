/**
 * Port Notion client and database configuration.
 *
 * Database IDs and property name maps for all port databases.
 * The organizations DB ID is set after the migration script runs.
 */

import { createNotionClient } from "@/lib/shared/notion";

export const notion = createNotionClient(process.env.NOTION_TOKEN!);

/**
 * Data source (collection) IDs — used with dataSources.query (API v2025-09-03).
 * These are the stable data source IDs, not page-based database IDs.
 */
export const PORT_DB = {
  organizations: "0d72822c-6d4e-4f0a-b737-620245147b7b",
  contacts: "829cd552-4516-45b7-a65b-2bcd8d47ff81",
  projects: "224e4ee7-4ba4-8128-b67e-000b7c51cf0e",
  bdAssets: "6e8dbbd9-0a14-4342-9154-88fa379b0533",
  competitive: "e65109a0-cbf9-49f6-871c-16643a7d010a",
  events: "bf0a6679-50ea-4bc1-9156-d023872be931",
  socialQueue: "076f97a5-88b8-4bca-8b26-47d26e75f516",
  emailDrafts: "084cb580-aaa2-4129-9fbc-f0435debcb33",
  rfpRadar: "685b0a16-d861-4380-b04a-f6ac276b9319",
  campaigns: "2a797407-75fc-409b-a93a-7311c884dc91",
  campaignSteps: "31aa2804-d803-4af9-91bd-bdad5dd9996e",
  emailTemplates: "9e57d0c9-1477-4af6-aa9d-772de010774e",
  activities: "f61e3d25-72d6-482c-a595-ff1236dcc8c6",
  members: "cc118d3a-960e-4cb6-b78e-f2709f3c64b7",
  blueprints: "8c5fa843-c9de-4746-b312-4a1222bcb2b3",
  blueprintSteps: "aa1497c5-16e0-4ba7-98f8-36938dacaa98",
  deals: "7a76db3a-f9bc-4914-9fec-4873a720520d",
  rfpFeeds: "da87fc15-21d2-486a-b993-bb68b37a5ab8",
  bibliography: "e6c41c13-ed92-4916-84da-ced2201fc508",
  rateReference: "d4eda88c-35c9-4503-9732-c00416f42b16",
  // ── content calendar (set NOTION_CONTENT_CALENDAR_DB_ID env var once Cowork creates the DB) ──
  contentCalendar: (process.env.NOTION_CONTENT_CALENDAR_DB_ID ?? "") as string,
  // ── PM databases (Phase 1) ──────────────────────────────
  milestones: "248e4ee7-4ba4-80ee-af37-000b8d6f33f8",
  workItems: "224e4ee7-4ba4-81c9-9fa7-000b194bb2fd",
  timesheets: "7f82a1f4-4d00-43ff-93d8-9d038ea0801a",
  cycles: "83d01ed3-e9f5-4f4f-bcfd-6738a8d361bc",
  allowances: "d50c748e-5acb-4b9d-b24b-1e442cb429f5",
} as const;

// ── property name maps ────────────────────────────────────
// Keys are camelCase for TypeScript; values are exact Notion column names.

export const ORG_PROPS = {
  organization: "organization",
  connection: "connection",
  type: "type",
  category: "category",
  regions: "region(s)",
  source: "source",
  website: "website",
  place: "Place",
  email: "email",
  outreachTarget: "outreach target",
  priority: "priority",
  fitRating: "fit rating",
  friendship: "friendship",
  howTheyBuy: "how they buy",
  marketSegment: "market segment",
  quadrant: "quadrant",
  crossQuadrant: "cross-quadrant",
  serviceLine: "service line",
  targetServices: "target service(s)",
  buyingTrigger: "buying trigger",
  buyerRole: "buyer role",
  subject: "subject",
  bespokeEmailCopy: "bespoke email copy",
  outreachSuggestion: "outreach suggestion",
  notes: "notes",
  contacts: "contact(s)",
  projects: "project(s)",
  outreachStatus: "outreach status",
  bdAssets: "🧰 BD assets",
  competitors: "competitors",
  logo: "logo",
  description: "description",
  linkedinUrl: "linkedin url",
  enrichedAt: "enriched at",
  outreachReady: "outreach ready",
  relationship: "relationship",
} as const;

export const CONTACT_PROPS = {
  name: "first & last name",
  email: "email",
  role: "role",
  contactType: "contact type",
  contactWarmth: "contact warmth",
  responsiveness: "responsiveness",
  referralPotential: "referral potential",
  linkedin: "linkedin",
  phoneNumber: "Phone Number",
  organization: "organization",
  node: "node",
  relationshipStage: "relationship stage",
  lastContacted: "last contacted",
  nextAction: "next action",
  profilePhotoUrl: "profile photo",
} as const;

export const PROJECT_PROPS = {
  project: "project",
  status: "status",
  priority: "priority",
  type: "type",
  budgetHours: "budget hours",
  eventType: "event type",
  timeline: "timeline",
  dateAndTime: "date & time",
  projectLeads: "project lead(s)",
  group: "group",
  milestones: "milestones",
  tasks: "task(s)",
  cycles: "cycle(s)",
  archive: "archive",
} as const;

export const BD_ASSET_PROPS = {
  asset: "asset",
  assetType: "asset type",
  readiness: "readiness",
  description: "Description",
  slug: "Slug",
  tags: "Tags",
  url: "userDefined:url",
  thumbnailUrl: "Thumbnail URL",
  icon: "Icon",
  featured: "Featured",
  showInPortfolio: "Show in Portfolio",
  showInPackageBuilder: "Show in Package Builder",
  passwordProtected: "Password Protected",
  groups: "groups",
  timesUsed: "times used",
} as const;

export const COMPETITIVE_PROPS = {
  organisation: "Organisation",
  type: "Type",
  threatLevel: "Threat Level",
  quadrantOverlap: "Quadrant Overlap",
  geography: "Geography",
  whatTheyOffer: "What They Offer",
  whereWvWins: "Where w.v. Wins",
  relevanceToWv: "Relevance to w.v.",
  notes: "Notes",
  url: "userDefined:URL",
  marketMapOrgs: "Market Map Orgs",
} as const;

export const EVENT_PROPS = {
  event: "Event",
  type: "Type",
  eventDates: "Event Dates",
  proposalDeadline: "Proposal Deadline",
  frequency: "Frequency",
  location: "Location",
  estAttendance: "Est. Attendance",
  registrationCost: "Registration Cost",
  quadrantRelevance: "Quadrant Relevance",
  bdSegments: "BD Segments",
  whoShouldAttend: "Who Should Attend",
  whyItMatters: "Why It Matters",
  notes: "Notes",
  url: "userDefined:URL",
} as const;

export const EMAIL_DRAFT_PROPS = {
  subject: "subject",
  body: "body",
  status: "status",
  organization: "organization",
  sentAt: "sent at",
  sentTo: "sent to",
  contact: "contact",
  resendMessageId: "resend message id",
  opens: "opens",
  clicks: "clicks",
  machineOpens: "machine opens",
  campaignId: "campaign",
  stepId: "step",
} as const;

export const RFP_PROPS = {
  opportunityName: "opportunity name",
  status: "status",
  opportunityType: "opportunity type",
  organization: "organization",
  relatedProject: "related project",
  owner: "owner",
  dueDate: "due date",
  estimatedValue: "estimated value",
  wvFitScore: "wv fit score",
  serviceMatch: "service match",
  category: "category",
  geography: "geography",
  source: "source",
  requirementsSnapshot: "requirements snapshot",
  decisionNotes: "decision notes",
  url: "url",
  proposalStatus: "proposal status",
  proposalDraftUrl: "proposal draft",
  rfpDocumentUrl: "rfp document",
  questionBankUrl: "question bank",
  questionCount: "question count",
  coverLetterUrl: "cover letter",
  teamCvsUrl: "team cvs",
  whatWorked: "what worked",
  whatFellFlat: "what fell flat",
  clientFeedback: "client feedback",
  lessonsForNextTime: "lessons for next time",
  proposalNotes: "proposal notes",
} as const;

export const RATE_REFERENCE_PROPS = {
  role: "role",
  dailyRateLow: "daily rate low (USD)",
  dailyRateHigh: "daily rate high (USD)",
  funderType: "funder type",
  geography: "geography",
  source: "source",
  icsLevel: "ics level",
  notes: "notes",
} as const;

export const SOCIAL_PROPS = {
  content: "content",
  platform: "platform",
  status: "status",
  mediaUrls: "media urls",
  scheduledFor: "scheduled for",
  organization: "organization",
  notes: "notes",
} as const;

export const CAMPAIGN_PROPS = {
  name: "name",
  type: "type",
  status: "status",
  event: "event",
  audienceFilters: "audience filters",
  owner: "owner",
  startDate: "start date",
  endDate: "end date",
  notes: "notes",
} as const;

export const CAMPAIGN_STEP_PROPS = {
  name: "name",
  campaign: "campaign",
  stepNumber: "step number",
  channel: "channel",
  subject: "subject",
  body: "body",
  delayDays: "delay days",
  sendDate: "send date",
  status: "status",
  variantBSubject: "variant b subject",
  variantBBody: "variant b body",
  condition: "condition",
  sentCount: "sent count",
  skippedCount: "skipped count",
  failedCount: "failed count",
} as const;

export const MEMBER_PROPS = {
  name: "first & last name",
  active: "active",
  email: "email",
  companyRole: "company role",
  capacity: "capacity",
  hourlyRate: "hourly rate",
} as const;

export const ALLOWANCE_PROPS = {
  description: "description",
  member: "member",
  category: "category",
  amount: "amount",
  active: "active",
  notes: "notes",
} as const;

export const ACTIVITY_PROPS = {
  activity: "activity",
  type: "type",
  contact: "contact",
  organization: "organization",
  event: "event",
  date: "date",
  outcome: "outcome",
  notes: "notes",
  loggedBy: "logged by",
} as const;

export const EMAIL_TEMPLATE_PROPS = {
  name: "name",
  subject: "subject",
  body: "body",
  category: "category",
  channel: "channel",
  notes: "notes",
  timesUsed: "times used",
} as const;

export const BLUEPRINT_PROPS = {
  name: "name",
  description: "description",
  channels: "channels",
  category: "category",
  stepCount: "step count",
  totalDays: "total days",
  notes: "notes",
} as const;

export const DEAL_PROPS = {
  deal: "deal",
  stage: "stage",
  organization: "organization",
  owner: "owner",
  value: "value",
  closeDate: "close date",
  lostReason: "lost reason",
  notes: "notes",
  documents: "documents",
  debriefWhatWorked: "debrief: what worked",
  debriefWhatFellFlat: "debrief: what fell flat",
  debriefWhatWasMissing: "debrief: what was missing",
  debriefClientFeedback: "debrief: client feedback",
  rfpOpportunity: "rfp opportunity",
  createdTime: "created time",
  lastEditedTime: "last edited time",
} as const;

// ── PM property maps ─────────────────────────────────────

export const MILESTONE_PROPS = {
  milestone: "milestone",
  kind: "kind",
  milestoneStatus: "milestone status",
  project: "project",
  tasks: "task(s)",
  startDate: "start date",
  endDate: "end date",
  owner: "owner",
  clientVisible: "client-visible",
  description: "description",
  brief: "brief",
  billingTotal: "billing total",
  archive: "archive",
} as const;

export const WORK_ITEM_PROPS = {
  task: "task",
  status: "status",
  taskType: "task type",
  priority: "priority",
  owner: "owner",
  person: "Person",
  project: "project(s)",
  milestone: "milestone",
  dueDate: "due date",
  estimateHours: "estimate hours",
  parentTask: "parent task",
  subTasks: "sub-task(s)",
  blocking: "Blocking",
  blockedBy: "Blocked by",
  timesheets: "timesheet(s)",
  meeting: "meeting",
  archive: "archive",
} as const;

export const TIMESHEET_PROPS = {
  entry: "entry",
  person: "person",
  dateAndTime: "date & time",
  hours: "hours",
  minutes: "minutes",
  totalTime: "total time",
  status: "status",
  type: "type",
  task: "task",
  meeting: "meeting",
  billable: "billable",
  rate: "rate",
  amount: "amount",
  explanation: "explanation of time spent",
} as const;

export const CYCLE_PROPS = {
  cycle: "cycle",
  startDate: "start date",
  endDate: "end date",
  project: "project",
  status: "status",
  goal: "goal",
} as const;

export const BIBLIOGRAPHY_PROPS = {
  fullCitation: "full citation",
  abstract: "abstract",
  keywords: "keywords",
  notes: "notes",
  topic: "topic",
  sourceType: "source type",
  year: "year",
  doi: "DOI",
  publisherLink: "publisher link",
  citationCount: "citation count",
} as const;

export const BLUEPRINT_STEP_PROPS = {
  name: "name",
  blueprint: "blueprint",
  stepNumber: "step number",
  channel: "channel",
  template: "template",
  delayDays: "delay days",
  delayReference: "delay reference",
  notes: "notes",
} as const;
