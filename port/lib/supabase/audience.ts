/**
 * Audience resolver — Supabase version of lib/notion/audience.ts
 *
 * Converts AudienceFilter rules into matching Organization records,
 * reading from Supabase instead of Notion.
 *
 * Handles:
 *   - Filter-based resolution via getOrganizationsFromSupabase (full pagination)
 *   - addedOrgIds: manually included orgs (fetched individually)
 *   - removedOrgIds: always excluded from results
 *   - region → regions field rename (Notion used "region", Supabase column is "regions")
 *   - relationship virtual field pass-through (Supabase query layer handles mapping)
 */

import { getOrganizationsFromSupabase, getOrganizationByIdFromSupabase } from "./organizations";
import type { OrganizationSupabaseFilters } from "./organizations";
import type { AudienceFilter, Organization } from "@/lib/notion/types";

export async function resolveAudienceFromSupabase(
  filters: AudienceFilter,
): Promise<Organization[]> {
  const {
    addedOrgIds = [],
    removedOrgIds = [],
    addedContactIds: _c,
    removedContactIds: _rc,
    region,
    ...orgFilters
  } = filters;
  const removedSet = new Set(removedOrgIds);

  // Map AudienceFilter keys to OrganizationSupabaseFilters
  const supabaseFilters: OrganizationSupabaseFilters = {};
  if (orgFilters.fitRating)      supabaseFilters.fitRating      = orgFilters.fitRating as string | string[];
  if (orgFilters.relationship)   supabaseFilters.relationship   = orgFilters.relationship as string | string[];
  if (orgFilters.source)         supabaseFilters.source         = orgFilters.source as string | string[];
  if (orgFilters.marketSegment)  supabaseFilters.marketSegment  = orgFilters.marketSegment as string | string[];
  if (orgFilters.quadrant)       supabaseFilters.quadrant       = orgFilters.quadrant as string | string[];
  if (orgFilters.type)           supabaseFilters.type           = orgFilters.type as string | string[];
  if (orgFilters.category)       supabaseFilters.category       = orgFilters.category as string | string[];
  // Notion: "region" (singular) → Supabase: "regions" (column name)
  if (region)                    supabaseFilters.regions        = region as string | string[];
  // Legacy fields — Supabase query layer maps these to derived columns
  if (orgFilters.priority)       supabaseFilters.priority       = orgFilters.priority as string | string[];
  if (orgFilters.friendship)     supabaseFilters.friendship     = orgFilters.friendship as string | string[];
  if (orgFilters.outreachStatus) supabaseFilters.outreachStatus = orgFilters.outreachStatus as string | string[];
  if (orgFilters.connection)     supabaseFilters.connection     = orgFilters.connection as string | string[];

  // 1. Filter-based resolution — paginate through all matching orgs
  const filtered: Organization[] = [];
  if (Object.keys(supabaseFilters).length > 0) {
    let page = 1;
    while (true) {
      const result = await getOrganizationsFromSupabase(supabaseFilters, { page, pageSize: 100 });
      filtered.push(...result.data);
      if (result.data.length < 100) break;
      page++;
    }
  }

  // 2. Apply removedOrgIds exclusion to filter results
  const filteredIds = new Set(filtered.map((o) => o.id));
  const base = filtered.filter((o) => !removedSet.has(o.id));

  // 3. Union manually added orgs (fetch by ID, skip already-present or removed)
  if (addedOrgIds.length > 0) {
    const toFetch = addedOrgIds.filter((id) => !filteredIds.has(id) && !removedSet.has(id));
    const fetched = await Promise.all(
      toFetch.map((id) => getOrganizationByIdFromSupabase(id).catch(() => null)),
    );
    base.push(...(fetched.filter(Boolean) as Organization[]));
  }

  return base;
}
