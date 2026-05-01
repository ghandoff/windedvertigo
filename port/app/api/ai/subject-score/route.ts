import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { getBudgetStatus } from "@/lib/ai/usage-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.subject || typeof body.subject !== "string") {
    return error("subject is required");
  }

  const budget = await getBudgetStatus();
  if (budget.isOverBudget) {
    return error("Monthly AI budget exceeded", 429);
  }

  try {
    const result = await callClaude({
      feature: "nl-search", // uses Haiku for cheap scoring
      system: `You score email subject lines for port outreach on a scale of 1-10. Consider: personalization, clarity, length (4-8 words ideal), urgency, and relevance. Output ONLY JSON: {"score": number, "tip": "brief improvement tip"}`,
      userMessage: body.subject,
      userId: session.user.email,
      maxTokens: 100,
      temperature: 0.2,
    });

    const parsed = parseJsonResponse<{ score: number; tip: string }>(result.text);
    return json({
      score: Math.max(1, Math.min(10, Math.round(parsed.score))),
      tip: parsed.tip ?? "",
    });
  } catch (err) {
    console.error("[ai/subject-score]", err);
    return error("Failed to score subject line", 500);
  }
}
