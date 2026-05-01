import { NextRequest } from "next/server";
import { queryWorkItems, createWorkItem } from "@/lib/notion/work-items";
import { json, error, parsePagination, parseSort, param, boolParam, withNotionError } from "@/lib/api-helpers";
import type { WorkItemFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: WorkItemFilters = {};

  if (param(req, "status")) filters.status = param(req, "status") as WorkItemFilters["status"];
  if (param(req, "taskType")) filters.taskType = param(req, "taskType") as WorkItemFilters["taskType"];
  if (param(req, "priority")) filters.priority = param(req, "priority") as WorkItemFilters["priority"];
  if (param(req, "projectId")) filters.projectId = param(req, "projectId");
  if (param(req, "milestoneId")) filters.milestoneId = param(req, "milestoneId");
  if (boolParam(req, "archive") !== undefined) filters.archive = boolParam(req, "archive");
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryWorkItems(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.task) return error("task (name) is required");

  return withNotionError(async () => {
    const item = await createWorkItem(body);
    return json(item, 201);
  });
}
