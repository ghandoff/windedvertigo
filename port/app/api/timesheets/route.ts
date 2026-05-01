import { NextRequest } from "next/server";
import { queryTimesheets, createTimesheet } from "@/lib/notion/timesheets";
import { json, error, parsePagination, parseSort, param, boolParam, withNotionError } from "@/lib/api-helpers";
import type { TimesheetFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: TimesheetFilters = {};

  if (param(req, "status")) filters.status = param(req, "status") as TimesheetFilters["status"];
  if (param(req, "type")) filters.type = param(req, "type") as TimesheetFilters["type"];
  if (boolParam(req, "billable") !== undefined) filters.billable = boolParam(req, "billable");
  if (param(req, "taskId")) filters.taskId = param(req, "taskId");
  if (param(req, "dateAfter")) filters.dateAfter = param(req, "dateAfter");
  if (param(req, "dateBefore")) filters.dateBefore = param(req, "dateBefore");
  if (param(req, "search")) filters.search = param(req, "search");
  if (param(req, "personId")) filters.personId = param(req, "personId");

  return withNotionError(() =>
    queryTimesheets(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.entry) return error("entry (description) is required");

  return withNotionError(async () => {
    const ts = await createTimesheet(body);
    return json(ts, 201);
  });
}
