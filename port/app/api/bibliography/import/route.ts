/**
 * Citation import (agent-token). Lets the assistant run the reference-list
 * backfill: POST { text, asset, apply } — `apply:false` (default) parses + returns
 * the plan for review; `apply:true` writes (tags matched rows, inserts new ones).
 * Bearer-auth with the agent token, same as /api/carl/*.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import {
  parseReferences,
  planImport,
  applyImport,
  parseInTextCitations,
  planInText,
  applyInText,
} from "@/lib/bibliography/import";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const body = (await req.json()) as {
      text?: string;
      asset?: string;
      apply?: boolean;
      mode?: "references" | "in-text";
    };
    const text = body.text?.trim();
    const asset = body.asset?.trim();
    if (!text) return error("text is required", 400);
    if (!asset) return error("asset is required", 400);

    // in-text mode: tag the rows inline cites point to; never insert.
    if (body.mode === "in-text") {
      const parsed = await parseInTextCitations(text);
      const plan = await planInText(parsed, asset);
      if (!body.apply) {
        return json({
          applied: false,
          mode: "in-text",
          asset,
          parsed: parsed.length,
          matched: plan.matched.length,
          already_tagged: plan.alreadyTagged.length,
          unresolved: plan.unresolved.length,
          plan,
        });
      }
      const res = await applyInText(plan);
      return json({
        applied: true,
        mode: "in-text",
        asset,
        parsed: parsed.length,
        tagged: res.tagged,
        already_tagged: plan.alreadyTagged.length,
        unresolved: plan.unresolved.length,
      });
    }

    const parsed = await parseReferences(text);
    const plan = await planImport(parsed, asset);

    if (!body.apply) {
      return json({
        applied: false,
        mode: "references",
        asset,
        parsed: parsed.length,
        matched: plan.matched.length,
        new: plan.newCitations.length,
        already_tagged: plan.alreadyTagged.length,
        plan,
      });
    }

    const res = await applyImport(plan);
    return json({
      applied: true,
      mode: "references",
      asset,
      parsed: parsed.length,
      tagged: res.tagged,
      inserted: res.inserted,
      already_tagged: plan.alreadyTagged.length,
    });
  } catch (err) {
    console.error("[api/bibliography/import] failed:", err);
    return error("import failed", 500);
  }
}
