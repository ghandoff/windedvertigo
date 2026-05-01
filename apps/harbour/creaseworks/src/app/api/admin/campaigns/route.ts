/**
 * API route: /api/admin/campaigns
 *
 * GET  — list all campaigns (admin)
 * POST — create a new campaign (admin)
 * PUT  — update an existing campaign (admin)
 * DELETE — delete a campaign (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseJsonBody } from "@/lib/validation";
import {
  getAllCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from "@/lib/queries/campaigns";

export async function GET() {
  await requireAdmin();
  const campaigns = await getAllCampaigns();
  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  await requireAdmin();
  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { slug, title, description } = body;
  if (!slug || !title) {
    return NextResponse.json(
      { error: "slug and title are required" },
      { status: 400 },
    );
  }

  // Sanitise slug: lowercase, hyphens only
  const cleanSlug = String(slug)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleanSlug) {
    return NextResponse.json(
      { error: "slug must contain at least one alphanumeric character" },
      { status: 400 },
    );
  }

  try {
    const campaign = await createCampaign(cleanSlug, title, description ?? null);
    return NextResponse.json({ campaign }, { status: 201 });
  } catch (err: any) {
    if (err.code === "23505") {
      return NextResponse.json(
        { error: "a campaign with this slug already exists" },
        { status: 409 },
      );
    }
    throw err;
  }
}

export async function PUT(req: NextRequest) {
  await requireAdmin();
  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { id, title, description, active } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const campaign = await updateCampaign(id, { title, description, active });
  if (!campaign) {
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign });
}

export async function DELETE(req: NextRequest) {
  await requireAdmin();
  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const ok = await deleteCampaign(id);
  if (!ok) {
    return NextResponse.json({ error: "campaign not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
