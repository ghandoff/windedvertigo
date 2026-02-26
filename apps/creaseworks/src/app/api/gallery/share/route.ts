/**
 * API route: /api/gallery/share
 *
 * POST  — share evidence to gallery (opt-in) or unshare (opt-out).
 *         Body: { evidenceId, shared: boolean }
 *         Returns the updated status and approval state.
 *
 * Requires authentication.
 * User can only share/unshare their own evidence.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { parseJsonBody } from "@/lib/validation";
import {
  shareToGallery,
  unshareFromGallery,
  isEvidenceSharedToGallery,
} from "@/lib/queries/gallery";

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { evidenceId, shared } = body as {
    evidenceId?: string;
    shared?: boolean;
  };

  if (!evidenceId || typeof evidenceId !== "string") {
    return NextResponse.json(
      { error: "evidenceId is required" },
      { status: 400 },
    );
  }

  if (typeof shared !== "boolean") {
    return NextResponse.json(
      { error: "shared must be a boolean" },
      { status: 400 },
    );
  }

  try {
    let success = false;
    if (shared) {
      success = await shareToGallery(evidenceId, session);
    } else {
      success = await unshareFromGallery(evidenceId, session);
    }

    if (!success) {
      return NextResponse.json(
        { error: "evidence not found or not authorized" },
        { status: 404 },
      );
    }

    // Return current state
    const isShared = await isEvidenceSharedToGallery(evidenceId);

    return NextResponse.json(
      {
        success: true,
        evidenceId,
        shared: isShared,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("gallery share POST error:", error);
    return NextResponse.json(
      { error: "failed to update gallery share status" },
      { status: 500 },
    );
  }
}
