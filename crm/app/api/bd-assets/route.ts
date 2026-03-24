import { NextRequest } from "next/server";
import { queryBdAssets, createBdAsset } from "@/lib/notion/bd-assets";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const filters: { search?: string } = {};
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryBdAssets(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.asset) return error("asset (name) is required");

  return withNotionError(async () => {
    const asset = await createBdAsset(body);
    return json(asset, 201);
  });
}
