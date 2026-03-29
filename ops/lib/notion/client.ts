/**
 * Ops Notion client and database configuration.
 *
 * Uses the shared @windedvertigo/notion client factory.
 * Only exposes what ops needs — the projects database.
 */

import { createNotionClient } from "@windedvertigo/notion";

export const notion = createNotionClient(process.env.NOTION_TOKEN!);

/**
 * Database IDs — same source of truth as the CRM.
 * Ops only queries projects for now.
 */
export const OPS_DB = {
  projects: "224e4ee7-4ba4-8128-b67e-000b7c51cf0e",
} as const;

/**
 * Property name map for the projects database.
 * Keys are camelCase for TypeScript; values are exact Notion column names.
 */
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
