/**
 * API route: /api/admin/gallery
 *
 * GET   — fetch pending gallery items awaiting admin approval
 *         ?limit=50&offset=0
 *
 * POST  — approve or reject a gallery item
 *         Body: { evidenceId, action: "approve" | "reject" }
 *
 * Admin-only.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseJsonBody } from "@/lib/validation";
import {
  getPendingGalleryItems,
  countPendingGalleryItems,
  approveGalleryItem,
  rejectGalleryItem,
} from "@/lib/queries/gallery";

export async function GET(req: NextRequest) {
  const session = await requireAdmin();

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)), 200);
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

    const [items, total] = await Promise.all([
      getPendingGalleryItems(session, limit, offset),
      countPendingGalleryItems(session),
    ]);

    return NextResponse.json({
      items,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("admin gallery GET error:", error);
    return NextResponse.json(
      { error: "failed to fetch pending items" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { evidenceId, action } = body as {
    evidenceId?: string;
    action?: string;
  };

  if (!evidenceId || typeof evidenceId !== "string") {
    return NextResponse.json(
      { error: "evidenceId is required" },
      { status: 400 },
    );
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: 'action must be "approve" or "reject"' },
      { status: 400 },
    );
  }

  try {
    let success = false;
    if (action === "approve") {
      success = await approveGalleryItem(evidenceId, session);
    } else {
      success = await rejectGalleryItem(evidenceId, session);
    }

    if (!success) {
      return NextResponse.json(
        { error: "evidence not found or not shared" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        success: true,
        evidenceId,
        action,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("admin gallery POST error:", error);
    return NextResponse.json(
      { error: "failed to moderate gallery item" },
      { status: 500 },
    );
  }
}
