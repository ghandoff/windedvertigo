/**
 * POST /api/credits/redeem — spend credits on a reward.
 *
 * Accepts:
 *   { rewardType: "sampler_pdf" | "single_playdate" | "full_pack", packId?: string }
 *
 * - sampler_pdf (10 credits): no packId needed — grants access to sampler PDF
 * - single_playdate (25 credits): packId required — grants entitlement to that pack
 * - full_pack (50 credits): packId required — grants entitlement to that pack
 *
 * Returns { message, redemptionId } on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { parseJsonBody } from "@/lib/api-helpers";
import {
  spendCredits,
  getUserCredits,
  REDEMPTION_THRESHOLDS,
} from "@/lib/queries/credits";
import { grantEntitlement, grantUserEntitlement } from "@/lib/queries/entitlements";
import { logAccess } from "@/lib/queries/audit";

const VALID_REWARD_TYPES = Object.keys(REDEMPTION_THRESHOLDS) as Array<
  keyof typeof REDEMPTION_THRESHOLDS
>;

export async function POST(req: NextRequest) {
  const session = await requireAuth();

  const parsed = await parseJsonBody(req);
  if (parsed instanceof NextResponse) return parsed;
  const body = parsed as Record<string, unknown>;

  const { rewardType, packId } = body;

  // Validate rewardType
  if (
    typeof rewardType !== "string" ||
    !VALID_REWARD_TYPES.includes(rewardType as keyof typeof REDEMPTION_THRESHOLDS)
  ) {
    return NextResponse.json(
      { error: `rewardType must be one of: ${VALID_REWARD_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const reward = rewardType as keyof typeof REDEMPTION_THRESHOLDS;
  const cost = REDEMPTION_THRESHOLDS[reward];

  // Pack rewards require a packId
  if ((reward === "single_playdate" || reward === "full_pack") && !packId) {
    return NextResponse.json(
      { error: "packId is required for pack rewards" },
      { status: 400 },
    );
  }

  if (packId && typeof packId !== "string") {
    return NextResponse.json(
      { error: "packId must be a string" },
      { status: 400 },
    );
  }

  // Pre-flight balance check (the real guard is the atomic spendCredits)
  const balance = await getUserCredits(session.userId);
  if (balance < cost) {
    return NextResponse.json(
      {
        error: "insufficient credits",
        balance,
        cost,
      },
      { status: 400 },
    );
  }

  try {
    // Atomic spend — prevents TOCTOU double-spend
    const redemptionId = await spendCredits(
      session.userId,
      session.orgId,
      cost,
      reward,
      packId as string | undefined,
    );

    // Grant entitlement for pack-based rewards
    // Supports both org-level and individual user-level entitlements
    if ((reward === "single_playdate" || reward === "full_pack") && packId) {
      if (session.orgId) {
        await grantEntitlement(session.orgId, packId as string);
      } else {
        await grantUserEntitlement(session.userId, packId as string);
      }
    }

    // Audit log
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await logAccess(
      session.userId,
      session.orgId,
      null,
      null,
      "redeem_credits",
      ip,
      ["reward_type", "credits_spent"],
    );

    const newBalance = await getUserCredits(session.userId);
    return NextResponse.json(
      {
        message: "credits redeemed",
        redemptionId,
        creditsSpent: cost,
        newBalance,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("[credits/redeem] error:", err);
    // Don't leak internal error messages to client
    const isInsufficientCredits =
      err instanceof Error && err.message.startsWith("Insufficient credits");
    return NextResponse.json(
      { error: isInsufficientCredits ? "insufficient credits" : "redemption failed" },
      { status: isInsufficientCredits ? 400 : 500 },
    );
  }
}
