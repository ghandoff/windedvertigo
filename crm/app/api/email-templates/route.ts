import { NextRequest } from "next/server";
import { queryEmailTemplates, createEmailTemplate } from "@/lib/notion/email-templates";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";
import type { EmailTemplateFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: EmailTemplateFilters = {};
  if (param(req, "category")) filters.category = param(req, "category") as EmailTemplateFilters["category"];
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryEmailTemplates(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");

  return withNotionError(async () => {
    const template = await createEmailTemplate(body);
    return json(template, 201);
  });
}
