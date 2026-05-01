/**
 * Supabase read layer for bd_assets (BD / portfolio assets).
 *
 * Filter parity with lib/notion/bd-assets.ts queryBdAssets():
 * - search → ILIKE '%value%' on asset name
 *
 * Phase G.1.3: GET /api/bd-assets now reads from Supabase.
 * POST still writes to Notion — source of truth.
 */

import { supabase } from "./client";
import type { BdAsset } from "@/lib/notion/types";

// ── types ────────────────────────────────────────────────────────

interface BdAssetRow {
  notion_page_id: string;
  asset: string;
  asset_type: string | null;
  readiness: string | null;
  description: string | null;
  slug: string | null;
  tags: string[];
  url: string | null;
  thumbnail_url: string | null;
  icon: string | null;
  featured: boolean;
  show_in_portfolio: boolean;
  show_in_package_builder: boolean;
  password_protected: boolean;
  organization_ids: string[];
  times_used: number | null;
}

export interface BdAssetSupabaseFilters {
  search?: string;
  assetType?: string;
  readiness?: string;
  featured?: boolean;
}

export interface BdAssetSupabasePagination {
  page?: number;
  pageSize?: number;
}

// ── helpers ──────────────────────────────────────────────────────

function mapRowToBdAsset(row: BdAssetRow): BdAsset {
  return {
    id: row.notion_page_id,
    asset: row.asset,
    assetType: row.asset_type ?? "",
    readiness: (row.readiness as BdAsset["readiness"]) ?? "idea",
    description: row.description ?? "",
    slug: row.slug ?? "",
    tags: row.tags ?? [],
    url: row.url ?? "",
    thumbnailUrl: row.thumbnail_url ?? "",
    icon: row.icon ?? "",
    featured: row.featured ?? false,
    showInPortfolio: row.show_in_portfolio ?? false,
    showInPackageBuilder: row.show_in_package_builder ?? false,
    passwordProtected: row.password_protected ?? false,
    organizationIds: row.organization_ids ?? [],
    timesUsed: row.times_used ?? null,
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, asset, asset_type, readiness, description, slug, tags, url, " +
  "thumbnail_url, icon, featured, show_in_portfolio, show_in_package_builder, " +
  "password_protected, organization_ids, times_used";

// ── query functions ───────────────────────────────────────────────

export async function getBdAssetsFromSupabase(
  filters: BdAssetSupabaseFilters = {},
  pagination: BdAssetSupabasePagination = {},
): Promise<{ data: BdAsset[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("bd_assets")
    .select(SELECT_COLS, { count: "exact" })
    .order("asset", { ascending: true })
    .range(from, to);

  if (filters.search)    query = query.ilike("asset", `%${filters.search}%`);
  if (filters.assetType) query = query.eq("asset_type", filters.assetType);
  if (filters.readiness) query = query.eq("readiness", filters.readiness);
  if (filters.featured !== undefined) query = query.eq("featured", filters.featured);

  const { data, error, count } = await query;
  if (error) throw new Error(`[supabase/bd-assets] query: ${error.message}`);
  return {
    data: (data as unknown as BdAssetRow[]).map(mapRowToBdAsset),
    total: count ?? 0,
  };
}

/**
 * Fetch a single BD asset by its Notion page id.
 */
export async function getBdAssetByIdFromSupabase(
  notionPageId: string,
): Promise<BdAsset | null> {
  const { data, error } = await supabase
    .from("bd_assets")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/bd-assets] getById: ${error.message}`);
  }
  return data ? mapRowToBdAsset(data as unknown as BdAssetRow) : null;
}
