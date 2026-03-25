/**
 * Audience resolver — converts filter rules into matching organizations.
 *
 * Reuses queryOrganizations() with full pagination to fetch all matching orgs.
 */

import { queryOrganizations } from "./organizations";
import type { AudienceFilter, Organization, OrganizationFilters } from "./types";

export async function resolveAudience(filters: AudienceFilter): Promise<Organization[]> {
  const orgFilters: OrganizationFilters = { ...filters };
  const allOrgs: Organization[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await queryOrganizations(orgFilters, { cursor, pageSize: 100 });
    allOrgs.push(...result.data);
    cursor = result.nextCursor ?? undefined;
    hasMore = result.hasMore;
  }

  return allOrgs;
}

export async function previewAudience(
  filters: AudienceFilter,
  limit = 10,
): Promise<{ count: number; preview: Organization[] }> {
  const all = await resolveAudience(filters);
  return {
    count: all.length,
    preview: all.slice(0, limit),
  };
}
