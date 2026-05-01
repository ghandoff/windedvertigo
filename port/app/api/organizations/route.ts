/**
 * GET /api/organizations — list + filter organizations
 * POST /api/organizations — create a new organization (writes still go to Notion)
 *
 * Phase G.1.2: GET reads from Supabase (faster, no rate limits).
 * POST (create) still writes to Notion — Notion is the source of truth;
 * the Supabase sync cron mirrors it back within 15 minutes.
 *
 * Response shape is backwards-compatible with the Notion version:
 * { data: Organization[], nextCursor: null, hasMore: false, total: number }
 */

import { NextRequest } from "next/server";
import {
  getOrganizationsFromSupabase,
  type OrganizationSupabaseFilters,
} from "@/lib/supabase/organizations";
import { createOrganization } from "@/lib/notion/organizations";
import { json, error, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const p = (key: string) => param(req, key);
  const url = new URL(req.url);

  const filters: OrganizationSupabaseFilters = {};

  // Primary filters
  if (p("fitRating"))      filters.fitRating      = p("fitRating");
  if (p("outreachStatus")) filters.outreachStatus = p("outreachStatus");
  if (p("marketSegment"))  filters.marketSegment  = p("marketSegment");
  if (p("source"))         filters.source         = p("source");

  // Structural
  if (p("type"))     filters.type     = p("type");
  if (p("category")) filters.category = p("category");
  if (p("region"))   filters.regions  = p("region"); // map from API param name
  if (p("quadrant")) filters.quadrant = p("quadrant");

  // Legacy / backward compat
  if (p("connection"))    filters.connection    = p("connection");
  if (p("relationship"))  filters.relationship  = p("relationship");
  if (p("priority"))      filters.priority      = p("priority");
  if (p("friendship"))    filters.friendship    = p("friendship");

  // Text search
  if (p("search")) filters.search = p("search");

  // Pagination — Notion used cursor; Supabase uses page/pageSize.
  // The search-as-you-type UI passes ?pageSize=10 and doesn't use cursors.
  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  // Sort
  const sortBy = p("sortBy");
  const sortDir = (p("sortDir") === "descending" ? "desc" : "asc") as "asc" | "desc";

  try {
    const result = await getOrganizationsFromSupabase(
      filters,
      { page, pageSize },
      sortBy ? { field: sortBy, direction: sortDir } : undefined,
    );

    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,   // Supabase uses offset pagination; cursors not applicable
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/organizations] Supabase query failed:", err);
    return error("failed to load organizations", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.organization) return error("organization (name) is required");

  // Creates still go to Notion — source of truth.
  // The sync cron will mirror the new org to Supabase within 15 minutes.
  return withNotionError(async () => {
    const org = await createOrganization(body);
    return json(org, 201);
  });
}
