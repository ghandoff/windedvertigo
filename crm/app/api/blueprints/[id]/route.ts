import { NextRequest } from "next/server";
import { getBlueprint } from "@/lib/notion/blueprints";
import { withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(() => getBlueprint(id));
}
