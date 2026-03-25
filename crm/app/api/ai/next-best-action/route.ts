import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { getNextBestActions } from "@/lib/ai/next-best-action";
import { getBudgetStatus } from "@/lib/ai/usage-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const body = await req.json().catch(() => null);

  const budget = await getBudgetStatus();
  if (budget.isOverBudget) {
    return error("Monthly AI budget exceeded", 429);
  }

  try {
    const result = await getNextBestActions(
      session.user.email,
      body?.limit,
    );
    return json(result);
  } catch (err) {
    console.error("[ai/next-best-action]", err);
    return error("Failed to generate recommendations", 500);
  }
}
