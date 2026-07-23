/**
 * /api/cmo/strategy-brief — the port's first human write-UI backend.
 *
 * GET: current brief (?history=1 for version list, ?version=N for a snapshot).
 *   Readable by either a signed-in session OR the agent bearer token
 *   (CMO_API_TOKEN), so Mo can read/seed it from Cowork mirroring the
 *   existing /api/cmo/* pattern.
 * PUT/POST: save an edit. Human action only — gated on NextAuth session,
 *   never the bearer token (same posture as
 *   /api/council/actions/[id]/promote-to-commitment: "any signed-in port
 *   user... small team, high trust").
 * POST ?restore=N: write a NEW forward version whose content = snapshot N.
 */

import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import {
  getStrategyBrief,
  getStrategyBriefHistory,
  getStrategyBriefVersion,
  saveStrategyBrief,
  restoreStrategyBriefVersion,
  type StrategyBriefContent,
} from "@/lib/supabase/cmo-strategy-brief";

function hasBearerAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

async function sessionEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

export async function GET(req: NextRequest) {
  const email = await sessionEmail();
  if (!email && !hasBearerAuth(req)) return error("unauthorized", 401);

  try {
    if (param(req, "history")) {
      const history = await getStrategyBriefHistory();
      return json(history);
    }
    const versionParam = param(req, "version");
    if (versionParam) {
      const snapshot = await getStrategyBriefVersion(Number(versionParam));
      if (!snapshot) return error("version not found", 404);
      return json(snapshot);
    }
    const brief = await getStrategyBrief();
    return json(brief);
  } catch (err) {
    console.error("[api/cmo/strategy-brief] GET failed:", err);
    return error("failed to load strategy brief", 500);
  }
}

function isValidContent(body: unknown): body is { content: StrategyBriefContent; change_note?: string } {
  if (!body || typeof body !== "object") return false;
  const content = (body as Record<string, unknown>).content;
  if (!content || typeof content !== "object") return false;
  const c = content as Record<string, unknown>;
  return Array.isArray(c.sections) && Array.isArray(c.decisions) && Array.isArray(c.actions);
}

async function handleSave(req: NextRequest) {
  const email = await sessionEmail();
  if (!email) return error("unauthorized — sign in to edit the strategy brief", 401);

  const restoreParam = param(req, "restore");
  if (restoreParam) {
    try {
      const result = await restoreStrategyBriefVersion({ version: Number(restoreParam), restoredBy: email });
      return json(result);
    } catch (err) {
      console.error("[api/cmo/strategy-brief] restore failed:", err);
      return error("failed to restore version", 500);
    }
  }

  const body = await req.json().catch(() => null);
  if (!isValidContent(body)) {
    return error("content.sections / content.decisions / content.actions (arrays) are required");
  }

  try {
    const result = await saveStrategyBrief({
      content: body.content,
      updatedBy: email,
      changeNote: body.change_note,
    });
    return json(result);
  } catch (err) {
    console.error("[api/cmo/strategy-brief] save failed:", err);
    return error("failed to save strategy brief", 500);
  }
}

export async function PUT(req: NextRequest) {
  return handleSave(req);
}
export async function POST(req: NextRequest) {
  return handleSave(req);
}
