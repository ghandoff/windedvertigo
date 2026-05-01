import { NextRequest } from "next/server";
import { getEvent, updateEvent, archiveEvent } from "@/lib/notion/events";
import { json, withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(() => getEvent(id));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  return withNotionError(() => updateEvent(id, body));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(async () => {
    await archiveEvent(id);
    return json({ archived: true });
  });
}
