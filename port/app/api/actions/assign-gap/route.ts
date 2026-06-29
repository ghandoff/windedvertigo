/**
 * POST /api/actions/assign-gap
 *
 * Assigns a brain knowledge-graph gap to cARL for research. Creates:
 *  1. A curriculum topic in carl_curriculum (status: planned, requested_by: garrett)
 *  2. A PaM commitment (commitment_type: learning) to track resolution
 *  3. A Slack DM to Garrett confirming the assignment
 *
 * Called from the gap-analysis component when a user clicks "→ assign to cARL".
 * Auth: dashboard middleware gates the route; no additional secret needed.
 */

import { supabase } from "@/lib/supabase/client";
import { insertCarlCurriculumTopic } from "@/lib/supabase/carl-curriculum";
import { sendDm } from "@/lib/slack";
import type { GapType } from "@/lib/knowledge/types";

// Map gap type to a curriculum domain meaningful to cARL
const DOMAIN_MAP: Partial<Record<GapType, string>> = {
  "capability-gap":       "capabilities",
  "ungrounded-framework": "foundations",
  "framework-adoption":   "application",
  "thin-bridge":          "connections",
  "isolated":             "connections",
  "shallow-research":     "depth",
  "ungrounded-product":   "evidence",
  "no-methodology":       "methodology",
  "population-coverage":  "populations",
};

export async function POST(req: Request): Promise<Response> {
  let body: {
    gapType: GapType;
    title: string;
    curriculumSuggestion?: string;
    nodeIds?: string[];
    severity?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const { gapType, title, curriculumSuggestion, nodeIds = [], severity = "medium" } = body;
  if (!gapType || !title) {
    return Response.json({ error: "gapType and title are required" }, { status: 400 });
  }

  const domain = DOMAIN_MAP[gapType] ?? "general";
  const topic  = curriculumSuggestion ?? `Research gap: ${title}`;
  const priority = severity === "high" ? 1 : severity === "medium" ? 2 : 3;

  // 1. Insert curriculum topic
  let curriculumId: string | null = null;
  try {
    const row = await insertCarlCurriculumTopic({
      domain,
      topic,
      priority,
      notes: `auto-assigned from /brain gap analysis · type: ${gapType} · gap: "${title}" · nodes: ${nodeIds.slice(0, 5).join(", ")}`,
      requested_by: "garrett",
    });
    curriculumId = row.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[assign-gap] carl_curriculum insert failed:", msg);
    return Response.json({ error: "curriculum insert failed", detail: msg }, { status: 500 });
  }

  // 2. Create PaM commitment to track resolution
  const now = new Date().toISOString();
  const { error: pamErr } = await supabase.from("pam_commitments").insert({
    who:             "garrett",
    what:            `[brain-gap] ${title} — cARL to research`,
    source:          "brain-gap",
    status:          "not-started",
    commitment_type: "learning",
    programme:       "brain-gap-research",
    visibility:      "public",
    created_at:      now,
    updated_at:      now,
  });
  if (pamErr) {
    // Non-fatal — curriculum row is committed; log and continue
    console.warn("[assign-gap] pam_commitments insert failed:", pamErr.message);
  }

  // 3. Slack DM to Garrett (fail-open — GARRETT_SLACK_USER_ID or SLACK_BOT_TOKEN may be absent)
  const slackUserId = process.env.GARRETT_SLACK_USER_ID;
  if (slackUserId) {
    const nodeList = nodeIds.slice(0, 3).join(", ");
    await sendDm(
      slackUserId,
      `📚 *Gap assigned to cARL* · ${severity} severity\n\n*Gap:* ${title}\n*Research topic:* ${topic}\n*Type:* ${gapType}${nodeList ? `\n*Nodes:* ${nodeList}` : ""}\n\n_cARL will add findings to the curriculum. Track progress at port.windedvertigo.com/carl_`,
    );
  }

  return Response.json({ ok: true, curriculumId });
}
