/**
 * GET /api/organizations/[id]/emails
 *
 * Returns sent email drafts for an organization, newest first.
 * Used for the org-level email history and analytics panel.
 */

import { NextRequest } from "next/server";
import { queryEmailDraftsByOrg } from "@/lib/notion/email-drafts";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  const { id } = await params;
  const pageSize = Number(req.nextUrl.searchParams.get("pageSize") ?? "20");

  try {
    const result = await queryEmailDraftsByOrg(id, { pageSize });
    return json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch emails";
    return error(msg, 500);
  }
}
