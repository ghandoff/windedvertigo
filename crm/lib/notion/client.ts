/**
 * CRM Notion client and database configuration.
 *
 * Database IDs and property name maps for all 6 CRM databases.
 * The organizations DB ID is set after the migration script runs.
 */

import { createNotionClient } from "@windedvertigo/notion";

export const notion = createNotionClient(process.env.NOTION_TOKEN!);

/**
 * Data source (collection) IDs — used with dataSources.query (API v2025-09-03).
 * These are the stable data source IDs, not page-based database IDs.
 */
export const CRM_DB = {
  organizations: "0d72822c-6d4e-4f0a-b737-620245147b7b",
  contacts: "829cd552-4516-45b7-a65b-2bcd8d47ff81",
  projects: "224e4ee7-4ba4-8128-b67e-000b7c51cf0e",
  bdAssets: "6e8dbbd9-0a14-4342-9154-88fa379b0533",
  competitive: "e65109a0-cbf9-49f6-871c-16643a7d010a",
  events: "bf0a6679-50ea-4bc1-9156-d023872be931",
  socialQueue: "076f97a5-88b8-4bca-8b26-47d26e75f516",
  emailDrafts: "084cb580-aaa2-4129-9fbc-f0435debcb33",
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
  bespokeEmailCopy: "bespoke email copy",
  outreachSuggestion: "outreach suggestion",
  notes: "notes",
  contacts: "contact(s)",
  projects: "project(s)",
  outreachStatus: "outreach status",
  bdAssets: "🧰 BD assets",
  competitors: "competitors",
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
} as const;

export const PROJECT_PROPS = {
  project: "project",
  status: "status",
  priority: "priority",
  eventType: "event type",
  timeline: "timeline",
  dateAndTime: "date & time",
  projectLeads: "project lead(s)",
  group: "group",
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
  resendMessageId: "resend message id",
  opens: "opens",
  clicks: "clicks",
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
