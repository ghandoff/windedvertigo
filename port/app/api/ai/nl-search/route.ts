import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { naturalLanguageSearch } from "@/lib/ai/nl-search";
import { getBudgetStatus } from "@/lib/ai/usage-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.query) return error("query is required");

  const budget = await getBudgetStatus();
  if (budget.isOverBudget) {
    return error("Monthly AI budget exceeded", 429);
  }

  try {
    const result = await naturalLanguageSearch(body, session.user.email);
    return json(result);
  } catch (err) {
    console.error("[ai/nl-search]", err);
    return error("Failed to process search", 500);
  }
}
