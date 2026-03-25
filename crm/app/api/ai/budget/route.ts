import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { getBudgetStatus, setBudgetConfig } from "@/lib/ai/usage-store";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const budget = await getBudgetStatus();
  return json(budget);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return error("Invalid body");

  // Validate budget values
  const limit = Number(body.monthlyLimitUsd);
  const threshold = Number(body.warningThresholdPct);

  if (body.monthlyLimitUsd !== undefined && (isNaN(limit) || limit < 0 || limit > 10000)) {
    return error("monthlyLimitUsd must be a number between 0 and 10000");
  }
  if (body.warningThresholdPct !== undefined && (isNaN(threshold) || threshold < 0 || threshold > 100)) {
    return error("warningThresholdPct must be a number between 0 and 100");
  }

  const config = await setBudgetConfig({
    ...(body.monthlyLimitUsd !== undefined && { monthlyLimitUsd: limit }),
    ...(body.warningThresholdPct !== undefined && { warningThresholdPct: threshold }),
  });

  return json(config);
}
