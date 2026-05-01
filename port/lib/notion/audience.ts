/**
 * Audience resolver — converts filter rules into matching organizations.
 *
 * Supports two modes that can be combined:
 *   - Filter-based: standard AudienceFilter fields (priority, type, etc.)
 *   - Manual overrides: addedOrgIds (always included) and removedOrgIds (always excluded)
 *
 * Reuses queryOrganizations() with full pagination for filter-based resolution.
 */

import { queryOrganizations, getOrganization } from "./organizations";
import type { AudienceFilter, Organization, OrganizationFilters } from "./types";

export async function resolveAudience(filters: AudienceFilter): Promise<Organization[]> {
  // Destructure ALL non-query keys so they don't leak into orgFilters and trigger
  // an unintended full-table scan. Add new AudienceFilter meta-keys here as they're added.
  const { addedOrgIds = [], removedOrgIds = [], addedContactIds: _c, removedContactIds: _rc, ...orgFilters } = filters;
  const removedSet = new Set(removedOrgIds);

  // 1. Filter-based resolution (only if any filter fields are set)
  const filtered: Organization[] = [];
  if (Object.keys(orgFilters).length > 0) {
    const queryFilters: OrganizationFilters = { ...orgFilters };
    let cursor: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const result = await queryOrganizations(queryFilters, { cursor, pageSize: 100 });
      filtered.push(...result.data);
      cursor = result.nextCursor ?? undefined;
      hasMore = result.hasMore;
    }
  }

  // 2. Apply removedOrgIds exclusion to filter results
  const filteredIds = new Set(filtered.map((o) => o.id));
  const base = filtered.filter((o) => !removedSet.has(o.id));

  // 3. Union manually added orgs (fetch by ID, skip already-present or removed)
  if (addedOrgIds.length > 0) {
    const toFetch = addedOrgIds.filter((id) => !filteredIds.has(id) && !removedSet.has(id));
    const fetched = await Promise.all(
      toFetch.map((id) => getOrganization(id).catch(() => null)),
    );
    base.push(...(fetched.filter(Boolean) as Organization[]));
  }

  return base;
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
