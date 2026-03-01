/**
 * GET /api/credits — fetch current user's credit balance and recent history.
 *
 * Returns { balance, history, thresholds }.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getUserCredits,
  getUserCreditHistory,
  REDEMPTION_THRESHOLDS,
} from "@/lib/queries/credits";

export async function GET() {
  const session = await requireAuth();

  const [balance, history] = await Promise.all([
    getUserCredits(session.userId),
    getUserCreditHistory(session.userId, 10),
  ]);

  return NextResponse.json({
    balance,
    history,
    thresholds: REDEMPTION_THRESHOLDS,
  });
}
