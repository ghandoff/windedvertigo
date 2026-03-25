import { NextRequest } from "next/server";
import { queryActivities, createActivity } from "@/lib/notion/activities";
import { updateContact } from "@/lib/notion/contacts";
import { json, error, parsePagination, parseSort, param, withNotionError } from "@/lib/api-helpers";
import type { ActivityFilters } from "@/lib/notion/types";

export async function GET(req: NextRequest) {
  const filters: ActivityFilters = {};

  if (param(req, "type")) filters.type = param(req, "type") as ActivityFilters["type"];
  if (param(req, "outcome")) filters.outcome = param(req, "outcome") as ActivityFilters["outcome"];
  if (param(req, "contactId")) filters.contactId = param(req, "contactId");
  if (param(req, "orgId")) filters.orgId = param(req, "orgId");
  if (param(req, "eventId")) filters.eventId = param(req, "eventId");
  if (param(req, "search")) filters.search = param(req, "search");

  return withNotionError(() =>
    queryActivities(filters, parsePagination(req), parseSort(req)),
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.activity) return error("activity (description) is required");

  return withNotionError(async () => {
    const activity = await createActivity(body);

    // Update last contacted date on linked contact(s)
    if (body.contactIds?.length && body.date?.start) {
      for (const contactId of body.contactIds) {
        try {
          await updateContact(contactId, {
            lastContacted: { start: body.date.start, end: null },
          });
        } catch {
          // non-critical — don't fail the activity creation
        }
      }
    }

    return activity;
  });
}
