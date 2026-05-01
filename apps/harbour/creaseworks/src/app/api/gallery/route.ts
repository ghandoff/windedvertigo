/**
 * API route: /api/gallery
 *
 * GET  — fetch approved community gallery evidence with pagination.
 *        ?limit=20&offset=0 (default limit 20, offset 0)
 *
 * Public endpoint — no auth required.
 */

import { NextRequest, NextResponse } from "next/server";
import { getGalleryEvidence, countGalleryEvidence } from "@/lib/queries/gallery";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)), 100);
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));

    const [items, total] = await Promise.all([
      getGalleryEvidence(limit, offset),
      countGalleryEvidence(),
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
    console.error("gallery GET error:", error);
    return NextResponse.json(
      { error: "failed to fetch gallery" },
      { status: 500 },
    );
  }
}
