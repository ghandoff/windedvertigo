/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getBdAssetByIdFromSupabase,
  upsertBdAssetToSupabase,
  deleteBdAssetFromSupabase,
} from "@/lib/supabase/bd-assets";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const asset = await getBdAssetByIdFromSupabase(id);
    if (!asset) return error("BD asset not found", 404);
    return json(asset);
  } catch (err) {
    console.error("[api/bd-assets/[id]] GET failed:", err);
    return error("failed to load BD asset", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  try {
    const patch: Record<string, unknown> = {};
    if (body.asset !== undefined) patch.asset = body.asset;
    if (body.assetType !== undefined) patch.asset_type = body.assetType;
    if (body.readiness !== undefined) patch.readiness = body.readiness;
    if (body.description !== undefined) patch.description = body.description;
    if (body.slug !== undefined) patch.slug = body.slug;
    if (body.tags !== undefined) patch.tags = body.tags;
    if (body.url !== undefined) patch.url = body.url;
    if (body.thumbnailUrl !== undefined) patch.thumbnail_url = body.thumbnailUrl;
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.featured !== undefined) patch.featured = body.featured;
    if (body.showInPortfolio !== undefined) patch.show_in_portfolio = body.showInPortfolio;
    if (body.showInPackageBuilder !== undefined) patch.show_in_package_builder = body.showInPackageBuilder;
    if (body.passwordProtected !== undefined) patch.password_protected = body.passwordProtected;
    if (body.organizationIds !== undefined) patch.organization_ids = body.organizationIds;

    await upsertBdAssetToSupabase(id, patch);

    const updated = await getBdAssetByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/bd-assets/[id]] PATCH failed:", err);
    return error("failed to update BD asset", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteBdAssetFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/bd-assets/[id]] DELETE failed:", err);
    return error("failed to delete BD asset", 500);
  }
}
