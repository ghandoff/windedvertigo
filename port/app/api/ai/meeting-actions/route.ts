import { NextRequest } from "next/server";
import { extractMeetingActions } from "@/lib/ai/meeting-actions";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.notes) return error("notes is required");

  const result = await extractMeetingActions(
    body.notes,
    session.user.email,
  );

  return json(result);
}
