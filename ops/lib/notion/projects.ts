/**
 * Query projects from Notion and map to ops Project type.
 *
 * Falls back to null when Notion is unavailable so the caller
 * can use static data instead.
 */

import {
  getTitle,
  getStatus,
  getDate,
  getCheckbox,
  getPeopleNames,
  queryDatabase,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, OPS_DB, PROJECT_PROPS } from "./client";
import type { Project } from "../types";

const P = PROJECT_PROPS;

/**
 * Map a Notion project status (e.g. "in progress", "suspended") to the
 * ops traffic-light status. This is a simple heuristic — refine as needed.
 */
function mapStatus(notionStatus: string | null): Project["status"] {
  if (!notionStatus) return "green";

  const s = notionStatus.toLowerCase();

  // red — blocked or cancelled
  if (s === "cancelled" || s === "suspended") return "red";

  // yellow — not yet in progress or under review
  if (s === "icebox" || s === "in queue" || s === "under review") return "yellow";

  // green — in progress or complete
  return "green";
}

/**
 * Format a Notion DateRange into a human-readable deadline string.
 */
function formatDeadline(date: { start: string; end: string | null } | null): string | undefined {
  if (!date) return undefined;
  const target = date.end ?? date.start;
  try {
    return new Date(target).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return target;
  }
}

function mapPageToOpsProject(page: PageObjectResponse): Project {
  const props = page.properties;
  const status = getStatus(props[P.status]);
  const timeline = getDate(props[P.timeline]);

  return {
    id: page.id,
    name: getTitle(props[P.project]) || "Untitled",
    status: mapStatus(status),
    deadline: formatDeadline(timeline),
    owner: getPeopleNames(props[P.projectLeads]).join(", ") || undefined,
    description: undefined,
  };
}

/**
 * Fetch all non-archived projects from Notion.
 *
 * Returns `null` if Notion is unavailable so the caller can fall back
 * to static data.
 */
export async function fetchProjects(): Promise<Project[] | null> {
  try {
    const result = await queryDatabase(notion, {
      database_id: OPS_DB.projects,
      filter: {
        property: P.archive,
        checkbox: { equals: false },
      },
      sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
      page_size: 50,
      label: "ops:fetchProjects",
    });

    return result.pages.map(mapPageToOpsProject);
  } catch (err) {
    console.error("[ops] Failed to fetch projects from Notion:", err);
    return null;
  }
}
