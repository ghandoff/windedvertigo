/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */

import { NextRequest } from "next/server";
import {
  getBdAssetsFromSupabase,
  upsertBdAssetToSupabase,
  type BdAssetSupabaseFilters,
} from "@/lib/supabase/bd-assets";
import { json, error, param } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const filters: BdAssetSupabaseFilters = {};
  if (param(req, "search")) filters.search = param(req, "search");

  const pageSize = url.searchParams.has("pageSize")
    ? Math.min(500, Math.max(1, Number(url.searchParams.get("pageSize"))))
    : 100;
  const page = url.searchParams.has("page")
    ? Math.max(1, Number(url.searchParams.get("page")))
    : 1;

  try {
    const result = await getBdAssetsFromSupabase(filters, { page, pageSize });
    const hasMore = page * pageSize < result.total;
    return json({
      data: result.data,
      nextCursor: null,
      hasMore,
      total: result.total,
    });
  } catch (err) {
    console.error("[api/bd-assets] Supabase query failed:", err);
    return error("failed to load BD assets", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.asset) return error("asset (name) is required");

  try {
    const id = crypto.randomUUID();
    await upsertBdAssetToSupabase(id, {
      asset: body.asset,
      asset_type: body.assetType ?? null,
      readiness: body.readiness ?? "idea",
      description: body.description ?? null,
      slug: body.slug ?? null,
      tags: body.tags ?? [],
      url: body.url ?? null,
      thumbnail_url: body.thumbnailUrl ?? null,
      icon: body.icon ?? null,
      featured: body.featured ?? false,
      show_in_portfolio: body.showInPortfolio ?? false,
      show_in_package_builder: body.showInPackageBuilder ?? false,
      password_protected: body.passwordProtected ?? false,
      organization_ids: body.organizationIds ?? [],
      times_used: 0,
    });

    return json({
      id,
      asset: body.asset,
      assetType: body.assetType ?? "",
      readiness: body.readiness ?? "idea",
      description: body.description ?? "",
      slug: body.slug ?? "",
      tags: body.tags ?? [],
      url: body.url ?? "",
      thumbnailUrl: body.thumbnailUrl ?? "",
      icon: body.icon ?? "",
      featured: body.featured ?? false,
      showInPortfolio: body.showInPortfolio ?? false,
      showInPackageBuilder: body.showInPackageBuilder ?? false,
      passwordProtected: body.passwordProtected ?? false,
      organizationIds: body.organizationIds ?? [],
      timesUsed: null,
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/bd-assets] POST failed:", err);
    return error("failed to create BD asset", 500);
  }
}
