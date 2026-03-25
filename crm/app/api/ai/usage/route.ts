import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import { getUsageSummary, getUsageEntries } from "@/lib/ai/usage-store";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const from = param(req, "from");
  const to = param(req, "to");
  const detail = param(req, "detail");

  if (!from || !to) {
    // Default to current month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    if (detail === "entries") {
      const entries = await getUsageEntries(monthStart, monthEnd);
      return json({ entries });
    }

    const summary = await getUsageSummary(monthStart, monthEnd);
    return json(summary);
  }

  if (detail === "entries") {
    const entries = await getUsageEntries(from, to);
    return json({ entries });
  }

  const summary = await getUsageSummary(from, to);
  return json(summary);
}
