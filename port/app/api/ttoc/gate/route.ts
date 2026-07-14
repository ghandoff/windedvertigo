/**
 * POST /api/ttoc/gate
 *
 * Score an opportunity/commitment/campaign against winded.vertigo's TToC
 * rubric (see lib/ai/ttoc-gate.ts — PLACEHOLDER rubric, docs/cmo/ttoc-rubric.md)
 * and log the verdict to ttoc_scorecards for auditability. Backs the shared
 * ttoc_gate MCP tool available to all six agents via /api/mcp/agents/all.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { scoreTtocGate, type TtocGateInput } from "@/lib/ai/ttoc-gate";
import { insertTtocScorecard } from "@/lib/supabase/ttoc";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

const VALID_KINDS = new Set<TtocGateInput["kind"]>(["opportunity", "commitment", "campaign"]);

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.kind || !VALID_KINDS.has(body.kind)) return error("kind must be one of: opportunity, commitment, campaign");
  if (!body?.title) return error("title is required");
  if (!body?.description) return error("description is required");

  try {
    const verdict = await scoreTtocGate(
      { kind: body.kind, title: body.title, description: body.description },
      body.requested_by ?? "garrett",
    );
    const scorecard = await insertTtocScorecard({
      kind: body.kind,
      subjectId: body.subject_id ?? undefined,
      title: body.title,
      verdict,
      requestedBy: body.requested_by ?? "garrett",
    });
    return json({ id: scorecard.id, verdict });
  } catch (err) {
    console.error("[api/ttoc/gate] POST failed:", err);
    return error("ttoc gate scoring failed", 500);
  }
}
