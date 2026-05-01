import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { scoreRelationships } from "@/lib/ai/relationship-score";
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
    const contactIds = Array.isArray(body?.contactIds)
      ? body.contactIds.filter((id: unknown) => typeof id === "string")
      : undefined;
    const result = await scoreRelationships(
      session.user.email,
      contactIds,
    );
    return json(result);
  } catch (err) {
    console.error("[ai/relationship-score]", err);
    return error("Failed to score relationships", 500);
  }
}
