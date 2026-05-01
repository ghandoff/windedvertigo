/**
 * GET /api/cron/sync-bd-assets-pilot
 *
 * One-way mirror: Notion BD Assets DB → Supabase `bd_assets` table.
 * Runs daily. Upserts on notion_page_id (idempotent).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAllBdAssets } from "@/lib/notion/bd-assets";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 60;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const assets = await getAllBdAssets();

  if (assets.length === 0) {
    return NextResponse.json({ message: "no BD assets to sync", upserted: 0, total: 0 });
  }

  const rows = assets.map((a) => ({
    notion_page_id: a.id,
    asset: a.asset,
    asset_type: a.assetType ?? null,
    readiness: a.readiness ?? null,
    description: a.description ?? null,
    slug: a.slug ?? null,
    tags: a.tags ?? [],
    url: a.url ?? null,
    thumbnail_url: a.thumbnailUrl ?? null,
    icon: a.icon ?? null,
    featured: a.featured ?? false,
    show_in_portfolio: a.showInPortfolio ?? false,
    show_in_package_builder: a.showInPackageBuilder ?? false,
    password_protected: a.passwordProtected ?? false,
    organization_ids: a.organizationIds ?? [],
    times_used: a.timesUsed ?? null,
    updated_at: new Date().toISOString(),
  }));

  const { error, count } = await supabase
    .from("bd_assets")
    .upsert(rows, { onConflict: "notion_page_id", count: "exact" });

  if (error) {
    console.error("[sync-bd-assets-pilot] upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `synced ${count ?? rows.length} BD assets to Supabase`,
    upserted: count ?? rows.length,
    total: rows.length,
  });
}
