import { NextRequest } from "next/server";
import { getBdAsset, updateBdAsset, archiveBdAsset } from "@/lib/notion/bd-assets";
import { json, withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(() => getBdAsset(id));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  return withNotionError(() => updateBdAsset(id, body));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(async () => {
    await archiveBdAsset(id);
    return json({ archived: true });
  });
}
