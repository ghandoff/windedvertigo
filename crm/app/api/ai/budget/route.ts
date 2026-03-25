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

  const config = await setBudgetConfig({
    monthlyLimitUsd: body.monthlyLimitUsd,
    warningThresholdPct: body.warningThresholdPct,
  });

  return json(config);
}
