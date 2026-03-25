import { NextRequest } from "next/server";
import { getActivitiesForContact } from "@/lib/notion/activities";
import { withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(() => getActivitiesForContact(id));
}
