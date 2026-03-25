import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { generateEmailDraft } from "@/lib/ai/email-draft";
import { getBudgetStatus } from "@/lib/ai/usage-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.organizationId) return error("organizationId is required");

  const budget = await getBudgetStatus();
  if (budget.isOverBudget) {
    return error("Monthly AI budget exceeded. Adjust in AI Hub settings.", 429);
  }

  try {
    const result = await generateEmailDraft(body, session.user.email);
    return json(result);
  } catch (err) {
    console.error("[ai/email-draft]", err);
    return error("Failed to generate email draft", 500);
  }
}
