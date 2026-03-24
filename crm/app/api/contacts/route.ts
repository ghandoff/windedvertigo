import { NextRequest } from "next/server";
import { queryContacts, createContact } from "@/lib/notion/contacts";
import { json, error, parsePagination, parseSort, param, boolParam, withNotionError } from "@/lib/api-helpers";
import type { ContactFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: ContactFilters = {};

  if (param(req, "contactType")) filters.contactType = param(req, "contactType") as ContactFilters["contactType"];
  if (param(req, "contactWarmth")) filters.contactWarmth = param(req, "contactWarmth") as ContactFilters["contactWarmth"];
  if (param(req, "responsiveness")) filters.responsiveness = param(req, "responsiveness") as ContactFilters["responsiveness"];
  if (boolParam(req, "referralPotential") !== undefined) filters.referralPotential = boolParam(req, "referralPotential");
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryContacts(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("name is required");

  return withNotionError(async () => {
    const contact = await createContact(body);
    return json(contact, 201);
  });
}
