/**
 * GET /api/biz/opportunities?status=radar — list opportunities (with their
 * rfp_ids) so Biz can iterate a kanban column and act per-card. status can be a
 * specific stage (radar|reviewing|pursuing|interviewing|submitted|won|lost|no-go),
 * "active" (all non-terminal), or omitted/"all" (everything). Auth: Bearer CMO_API_TOKEN.
 */

import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";

const TERMINAL = new Set(["won", "lost", "no-go", "missed deadline"]);

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const status = param(req, "status");
  const isStage = status && status !== "all" && status !== "active";

  try {
    const { data } = await getRfpOpportunitiesFromSupabase(
      isStage ? { status } : {},
      { page: 1, pageSize: 500 },
    );

    let rows = data;
    if (status === "active") rows = data.filter((o) => !TERMINAL.has(o.status));

    const items = rows
      .slice()
      .sort((a, b) => (a.dueDate?.start ?? "9999").localeCompare(b.dueDate?.start ?? "9999"))
      .map((o) => ({
        id: o.id,
        name: o.opportunityName,
        status: o.status,
        type: o.opportunityType,
        fit: o.wvFitScore,
        value: o.estimatedValue,
        due_date: o.dueDate?.start ?? null,
        proposal_status: o.proposalStatus,
      }));

    return json({ status: status ?? "all", count: items.length, items });
  } catch (err) {
    console.error("[api/biz/opportunities] GET failed:", err);
    return error("failed to list opportunities", 500);
  }
}
