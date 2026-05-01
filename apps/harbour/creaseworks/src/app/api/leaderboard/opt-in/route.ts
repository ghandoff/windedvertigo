/**
 * API route: /api/leaderboard/opt-in
 *
 * POST – Update leaderboard opt-in status
 * Requires authentication.
 * Body: { opted_in: boolean, display_name?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { optInToLeaderboard, optOutOfLeaderboard } from "@/lib/queries/leaderboard";
import { parseJsonBody } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { opted_in, display_name } = body as Record<string, unknown>;

  // Validate opted_in boolean
  if (typeof opted_in !== "boolean") {
    return NextResponse.json(
      { error: "opted_in must be a boolean" },
      { status: 400 },
    );
  }

  // Validate display_name if provided
  if (display_name !== undefined && display_name !== null) {
    if (typeof display_name !== "string") {
      return NextResponse.json(
        { error: "display_name must be a string or null" },
        { status: 400 },
      );
    }

    const trimmed = display_name.trim();
    if (trimmed.length === 0) {
      return NextResponse.json(
        { error: "display_name cannot be empty" },
        { status: 400 },
      );
    }

    if (trimmed.length > 50) {
      return NextResponse.json(
        { error: "display_name must be 50 characters or less" },
        { status: 400 },
      );
    }
  }

  try {
    let status;
    if (opted_in) {
      status = await optInToLeaderboard(
        session.userId,
        display_name && typeof display_name === "string" ? display_name.trim() : null,
      );
    } else {
      status = await optOutOfLeaderboard(session.userId);
    }

    return NextResponse.json(
      {
        success: true,
        opted_in: status.opted_in,
        display_name: status.display_name,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[leaderboard/opt-in] POST error:", err);
    return NextResponse.json(
      { error: "failed to update leaderboard status" },
      { status: 500 },
    );
  }
}
