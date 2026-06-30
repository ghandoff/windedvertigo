/**
 * Agent co-production self-log — lets cARL, Mo, Biz (and any agent) record that they
 * contributed a concrete deliverable to a cv-entry, without waiting for Garrett to
 * update the Notion record.
 *
 * POST /api/carl/coproduction
 *   body: {
 *     cvEntryId:          string  — knowledge_nodes id, e.g. "cv:cv-entry:abc123"
 *     agentId:            string  — "mo" | "carl" | "pam" | "opsy" | "biz" | "fin"
 *     artifactType:       string  — e.g. "lit review", "eval instrument", "rubric"
 *     summary:            string  — what was produced and how it was applied
 *     publishedExternally?: boolean
 *   }
 *
 * Writes a `deliverable` node + `co-produced` + `fed-into` edges directly to
 * knowledge_nodes/knowledge_edges. The entry stays kind:"human" (no Notion
 * attribution yet) which triggers the `unattributed-coproduction` gap on the
 * next knowledge-sync, prompting Garrett to update the Notion record.
 *
 * Auth: CMO_API_TOKEN (same bearer pattern used by all agent APIs).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { upsertNodes, upsertEdges } from "@/lib/knowledge/supabase";
import { canonicalKey } from "@/lib/knowledge/types";

const VALID_AGENTS = new Set(["mo", "carl", "pam", "opsy", "biz", "fin"]);

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.cvEntryId) return error("cvEntryId is required");
  if (!body?.agentId) return error("agentId is required");
  if (!body?.artifactType) return error("artifactType is required");
  if (!body?.summary) return error("summary is required");
  if (!VALID_AGENTS.has(body.agentId)) {
    return error(`agentId must be one of: ${[...VALID_AGENTS].join(", ")}`);
  }

  const syncTs = new Date().toISOString();
  const agentNodeId = `agent:${body.agentId}`;

  // Stable id: keyed by agent + artifactType + cv-entry so re-logging the same
  // contribution is idempotent (the upsert bumps last_seen_at, not duplicates).
  const slugBase = `${body.agentId}-${body.artifactType}-${body.cvEntryId}`
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase()
    .slice(0, 80);
  const deliverableId = `deliverable:${slugBase}`;

  try {
    await upsertNodes(
      [
        {
          id: deliverableId,
          kind: "co-created",
          category: "deliverable",
          label: `${body.artifactType} (${body.agentId})`,
          canonicalKey: canonicalKey(`${body.artifactType} ${body.agentId}`),
          source: "agent-log",
          sourceRef: `${agentNodeId}:coproduction`,
          description: body.summary,
          attrs: {
            agentId: body.agentId,
            artifactType: body.artifactType,
            appliedInEntry: body.cvEntryId,
            publishedExternally: body.publishedExternally ?? false,
          },
        },
      ],
      syncTs,
    );

    await upsertEdges(
      [
        {
          sourceId: agentNodeId,
          targetId: deliverableId,
          relationship: "co-produced",
          source: "agent-log",
          sourceRef: `${agentNodeId}:coproduction`,
        },
        {
          sourceId: deliverableId,
          targetId: body.cvEntryId,
          relationship: "fed-into",
          source: "agent-log",
          sourceRef: `${agentNodeId}:coproduction`,
        },
      ],
      syncTs,
    );

    return json({ ok: true, deliverableId }, 201);
  } catch (err) {
    console.error("[api/carl/coproduction] POST failed:", err);
    return error("failed to log co-production", 500);
  }
}
