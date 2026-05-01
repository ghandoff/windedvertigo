/**
 * Supabase read layer for organizations.
 *
 * `id` is set to `notion_page_id` so callers matching against Notion
 * relation arrays work unchanged. `derived_priority` is computed at sync
 * time by `computePriority()` and stored here directly.
 *
 * Filter parity with lib/notion/organizations.ts queryOrganizations():
 * - fitRating, outreachStatus, connection, friendship, priority → direct column match
 * - marketSegment, type, source, quadrant → direct column match
 * - category, regions → comma-joined text; filter uses ILIKE '%value%'
 * - search → ILIKE '%value%' on name (uses pg_trgm gin index for speed)
 * - relationship → alias for connection (legacy compat)
 *
 * Pagination: limit + offset (page × pageSize) — matches Notion cursor pagination
 * semantics for the purposes of the list API (which always fetches all and paginates
 * client-side in most UIs, but the API supports server-side pagination).
 */

import { supabase } from "./client";

// ── types ────────────────────────────────────────────────────────

interface OrganizationRow {
  notion_page_id: string;
  name: string;
  type: string | null;
  category: string | null;
  market_segment: string | null;
  website: string | null;
  email: string | null;
  connection: string | null;
  outreach_status: string | null;
  friendship: string | null;
  fit_rating: string | null;
  notes: string | null;
  derived_priority: string | null;
  source: string | null;
  regions: string | null;
  quadrant: string | null;
}

export interface OrganizationFromSupabase {
  id: string;
  name: string;
  type: string | null;
  category: string | null;
  marketSegment: string | null;
  website: string | null;
  email: string | null;
  connection: string | null;
  outreachStatus: string | null;
  friendship: string | null;
  fitRating: string | null;
  notes: string | null;
  derivedPriority: string | null;
  source: string | null;
  regions: string | null;
  quadrant: string | null;
}

export interface OrganizationSupabaseFilters {
  // Primary filters
  fitRating?: string | string[];
  outreachStatus?: string | string[];
  marketSegment?: string | string[];
  source?: string | string[];

  // Structural
  type?: string | string[];
  category?: string | string[];
  regions?: string | string[];
  quadrant?: string | string[];

  // Legacy / backward compat
  connection?: string | string[];
  friendship?: string | string[];
  priority?: string | string[];     // maps to derived_priority
  relationship?: string | string[]; // alias for connection

  // Text search on name
  search?: string;
}

export interface OrganizationSupabasePagination {
  page?: number;     // 1-indexed, default 1
  pageSize?: number; // default 100
}

export interface OrganizationSupabaseSort {
  field?: string;
  direction?: "asc" | "desc";
}

// ── helpers ──────────────────────────────────────────────────────

function mapRowToOrganization(row: OrganizationRow): OrganizationFromSupabase {
  return {
    id: row.notion_page_id,
    name: row.name,
    type: row.type,
    category: row.category,
    marketSegment: row.market_segment,
    website: row.website,
    email: row.email,
    connection: row.connection,
    outreachStatus: row.outreach_status,
    friendship: row.friendship,
    fitRating: row.fit_rating,
    notes: row.notes,
    derivedPriority: row.derived_priority,
    source: row.source,
    regions: row.regions,
    quadrant: row.quadrant,
  };
}

/** Returns true if a value (single or array) matches none / should skip the filter. */
function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null || v === "") return true;
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/** Normalize a possibly-stringified array filter value to a string[]. */
function toArray(v: string | string[]): string[] {
  return Array.isArray(v) ? v : [v];
}

const SELECT_COLS =
  "notion_page_id, name, type, category, market_segment, website, email, " +
  "connection, outreach_status, friendship, fit_rating, notes, derived_priority, " +
  "source, regions, quadrant";

// ── query function ────────────────────────────────────────────────

/**
 * Query organizations from Supabase with filter/pagination/sort parity
 * with the Notion queryOrganizations() function.
 *
 * For comma-joined multi-value columns (category, regions) this uses
 * ILIKE '%value%' which is approximate but matches the Notion "contains" behaviour.
 * The pg_trgm gin index on `name` ensures text search is O(n/k) not O(n).
 */
export async function getOrganizationsFromSupabase(
  filters: OrganizationSupabaseFilters = {},
  pagination: OrganizationSupabasePagination = {},
  sort: OrganizationSupabaseSort = {},
): Promise<{ data: OrganizationFromSupabase[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const sortField = sort.field ?? "name";
  const sortDir = sort.direction ?? "asc";

  // Map sort field name from camelCase API to snake_case DB column
  const sortColMap: Record<string, string> = {
    name: "name",
    outreachStatus: "outreach_status",
    fitRating: "fit_rating",
    marketSegment: "market_segment",
    derivedPriority: "derived_priority",
  };
  const sortCol = sortColMap[sortField] ?? "name";

  let query = supabase
    .from("organizations")
    .select(SELECT_COLS, { count: "exact" })
    .order(sortCol, { ascending: sortDir === "asc" })
    .range(from, to);

  // ── single-value exact-match filters ────────────────────────────

  // connection / relationship (relationship is a legacy alias)
  const connection = filters.connection ?? filters.relationship;
  if (!isEmpty(connection)) {
    const vals = toArray(connection!);
    query = vals.length === 1
      ? query.eq("connection", vals[0])
      : query.in("connection", vals);
  }

  if (!isEmpty(filters.outreachStatus)) {
    const vals = toArray(filters.outreachStatus!);
    query = vals.length === 1
      ? query.eq("outreach_status", vals[0])
      : query.in("outreach_status", vals);
  }

  if (!isEmpty(filters.friendship)) {
    const vals = toArray(filters.friendship!);
    query = vals.length === 1
      ? query.eq("friendship", vals[0])
      : query.in("friendship", vals);
  }

  if (!isEmpty(filters.fitRating)) {
    const vals = toArray(filters.fitRating!);
    query = vals.length === 1
      ? query.eq("fit_rating", vals[0])
      : query.in("fit_rating", vals);
  }

  if (!isEmpty(filters.marketSegment)) {
    const vals = toArray(filters.marketSegment!);
    query = vals.length === 1
      ? query.eq("market_segment", vals[0])
      : query.in("market_segment", vals);
  }

  if (!isEmpty(filters.type)) {
    const vals = toArray(filters.type!);
    query = vals.length === 1
      ? query.eq("type", vals[0])
      : query.in("type", vals);
  }

  if (!isEmpty(filters.source)) {
    const vals = toArray(filters.source!);
    query = vals.length === 1
      ? query.eq("source", vals[0])
      : query.in("source", vals);
  }

  if (!isEmpty(filters.quadrant)) {
    const vals = toArray(filters.quadrant!);
    query = vals.length === 1
      ? query.eq("quadrant", vals[0])
      : query.in("quadrant", vals);
  }

  if (!isEmpty(filters.priority)) {
    const vals = toArray(filters.priority!);
    query = vals.length === 1
      ? query.eq("derived_priority", vals[0])
      : query.in("derived_priority", vals);
  }

  // ── ILIKE filters for comma-joined multi-select columns ─────────
  // category and regions are stored as comma-joined strings ("val1, val2").
  // We filter using ILIKE '%value%' to approximate the Notion "contains" semantic.
  // Multiple values use OR logic (any match).

  if (!isEmpty(filters.category)) {
    const vals = toArray(filters.category!);
    // Build OR: (category ilike '%a%' or category ilike '%b%')
    const pattern = vals.map((v) => `category.ilike.%${v}%`).join(",");
    query = query.or(pattern);
  }

  if (!isEmpty(filters.regions)) {
    const vals = toArray(filters.regions!);
    const pattern = vals.map((v) => `regions.ilike.%${v}%`).join(",");
    query = query.or(pattern);
  }

  // ── text search ──────────────────────────────────────────────────
  // Uses ILIKE '%term%' on name; the pg_trgm gin index makes this fast.
  if (!isEmpty(filters.search)) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw new Error(`[supabase/organizations] query: ${error.message}`);

  return {
    data: (data as unknown as OrganizationRow[]).map(mapRowToOrganization),
    total: count ?? 0,
  };
}

/**
 * Fetch a single organization by its Notion page id.
 */
export async function getOrganizationByIdFromSupabase(
  notionPageId: string,
): Promise<OrganizationFromSupabase | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw new Error(`[supabase/organizations] getById: ${error.message}`);
  }
  return data ? mapRowToOrganization(data as unknown as OrganizationRow) : null;
}
