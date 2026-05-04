/**
 * GET /api/organizations — list + filter organizations
 * POST /api/organizations — create a new organization
 *
 * Phase G.1.2: GET reads from Supabase (faster, no rate limits).
 * Phase A3: POST writes to Supabase directly (Notion write retired).
 *
 * Response shape is backwards-compatible:
 * { data: Organization[], nextCursor: null, hasMore: false, total: number }
 */

import { NextRequest } from "next/server";
import {
  getOrganizationsFromSupabase,
  upsertOrganizationToSupabase,
  type OrganizationSupabaseFilters,
} from "@/lib/supabase/organizations";
import { json, error, param } from "@/lib/api-helpers";
import { deriveRelationship, computePriority } from "@/lib/notion/derived-fields";

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

  // Pagination
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
      nextCursor: null,
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

  try {
    const id = crypto.randomUUID();
    const connection = body.connection ?? "";
    const outreachStatus = body.outreachStatus ?? "";
    const friendship = body.friendship ?? "";
    const relationship = body.relationship || deriveRelationship(connection, outreachStatus, friendship);
    const fitRating = body.fitRating ?? "";
    const derivedPriority = computePriority(fitRating, relationship);

    await upsertOrganizationToSupabase(id, {
      name: body.organization,
      type: body.type ?? null,
      category: Array.isArray(body.category) ? body.category.join(", ") : (body.category ?? null),
      market_segment: body.marketSegment ?? null,
      website: body.website ?? null,
      email: body.email ?? null,
      connection: connection || null,
      outreach_status: outreachStatus || null,
      friendship: friendship || null,
      fit_rating: fitRating || null,
      notes: body.notes ?? null,
      derived_priority: derivedPriority || null,
      source: body.source ?? null,
      regions: Array.isArray(body.regions) ? body.regions.join(", ") : (body.regions ?? null),
      quadrant: body.quadrant ?? null,
    });

    // Return a minimal Organization shape matching what callers expect
    return json({
      id,
      organization: body.organization,
      connection,
      type: body.type ?? "",
      category: Array.isArray(body.category) ? body.category : (body.category ? [body.category] : []),
      regions: Array.isArray(body.regions) ? body.regions : (body.regions ? [body.regions] : []),
      source: body.source ?? "",
      website: body.website ?? "",
      place: null,
      email: body.email ?? "",
      outreachTarget: "",
      priority: derivedPriority,
      fitRating,
      friendship,
      howTheyBuy: "",
      marketSegment: body.marketSegment ?? "",
      quadrant: body.quadrant ?? "",
      crossQuadrant: [],
      serviceLine: [],
      targetServices: "",
      buyingTrigger: "",
      buyerRole: "",
      subject: "",
      bespokeEmailCopy: "",
      outreachSuggestion: "",
      outreachStatus,
      relationship,
      derivedPriority,
      notes: body.notes ?? "",
      contactIds: [],
      projectIds: [],
      bdAssetIds: [],
      competitorIds: [],
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/organizations] POST failed:", err);
    return error("failed to create organization", 500);
  }
}
