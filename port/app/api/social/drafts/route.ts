import { NextRequest } from "next/server";
import { querySocialDrafts, createSocialDraft } from "@/lib/notion/social";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const filters: { platform?: string; status?: string; search?: string } = {};

  if (param(req, "platform")) filters.platform = param(req, "platform");
  if (param(req, "status")) filters.status = param(req, "status");
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    querySocialDrafts(
      filters as Parameters<typeof querySocialDrafts>[0],
      parsePagination(req),
      parseSort(req),
    ),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.content) return error("content is required");

  return withNotionError(async () => {
    const draft = await createSocialDraft(body);
    return json(draft, 201);
  });
}
