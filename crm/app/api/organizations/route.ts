import { NextRequest } from "next/server";
import { queryOrganizations, createOrganization } from "@/lib/notion/organizations";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";
import type { OrganizationFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: OrganizationFilters = {};
  const p = (key: string) => param(req, key);

  if (p("connection")) filters.connection = p("connection") as OrganizationFilters["connection"];
  if (p("outreachStatus")) filters.outreachStatus = p("outreachStatus") as OrganizationFilters["outreachStatus"];
  if (p("type")) filters.type = p("type") as OrganizationFilters["type"];
  if (p("category")) filters.category = p("category") as OrganizationFilters["category"];
  if (p("region")) filters.region = p("region") as OrganizationFilters["region"];
  if (p("source")) filters.source = p("source") as OrganizationFilters["source"];
  if (p("priority")) filters.priority = p("priority") as OrganizationFilters["priority"];
  if (p("fitRating")) filters.fitRating = p("fitRating") as OrganizationFilters["fitRating"];
  if (p("friendship")) filters.friendship = p("friendship") as OrganizationFilters["friendship"];
  if (p("marketSegment")) filters.marketSegment = p("marketSegment");
  if (p("quadrant")) filters.quadrant = p("quadrant") as OrganizationFilters["quadrant"];
  if (p("search")) filters.search = p("search");

  return withNotionError(() =>
    queryOrganizations(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.organization) return error("organization (name) is required");

  return withNotionError(async () => {
    const org = await createOrganization(body);
    return json(org, 201);
  });
}
