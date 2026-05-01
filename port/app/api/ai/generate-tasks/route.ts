import { NextRequest } from "next/server";
import { generateTasksFromBrief } from "@/lib/ai/task-generation";
import { json, error, withNotionError } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.brief) return error("brief is required");
  if (!body?.projectName) return error("projectName is required");

  const result = await generateTasksFromBrief(
    body.brief,
    body.projectName,
    session.user.email,
  );

  return json(result);
}
