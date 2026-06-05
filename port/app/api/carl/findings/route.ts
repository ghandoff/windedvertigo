import { NextRequest } from "next/server";
import { json, error, param } from "@/lib/api-helpers";
import { getCarlFindings, insertCarlFinding } from "@/lib/supabase/carl";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const domain = param(req, "domain") ?? undefined;
  const tag = param(req, "tags") ?? undefined;
  const search = param(req, "search") ?? undefined;

  try {
    const findings = await getCarlFindings({ domain, tag, search });
    return json(findings);
  } catch (err) {
    console.error("[api/carl/findings] GET failed:", err);
    return error("failed to load findings", 500);
  }
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.domain) return error("domain is required");
  if (!body?.title) return error("title is required");
  if (!body?.summary) return error("summary is required");

  try {
    const result = await insertCarlFinding({
      domain: body.domain,
      title: body.title,
      summary: body.summary,
      source: body.source ?? undefined,
      citation: body.citation ?? undefined,
      relevance: body.relevance ?? undefined,
      tags: body.tags ?? [],
      connected_to: body.connected_to ?? undefined,
    });
    return json(result, 201);
  } catch (err) {
    console.error("[api/carl/findings] POST failed:", err);
    return error("failed to add finding", 500);
  }
}
