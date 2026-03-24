import { NextRequest } from "next/server";
import { queryProjects, createProject } from "@/lib/notion/projects";
import { json, error, parsePagination, parseSort, param, boolParam, withNotionError } from "@/lib/api-helpers";
import type { ProjectFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: ProjectFilters = {};

  if (param(req, "status")) filters.status = param(req, "status") as ProjectFilters["status"];
  if (param(req, "priority")) filters.priority = param(req, "priority") as ProjectFilters["priority"];
  if (boolParam(req, "archive") !== undefined) filters.archive = boolParam(req, "archive");
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryProjects(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.project) return error("project (name) is required");

  return withNotionError(async () => {
    const proj = await createProject(body);
    return json(proj, 201);
  });
}
