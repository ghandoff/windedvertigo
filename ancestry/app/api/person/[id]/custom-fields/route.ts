import { NextRequest, NextResponse } from "next/server";
import { auth } from "@windedvertigo/auth";
import { updateCustomFields, deleteCustomField } from "@/lib/db/queries";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  await updateCustomFields(id, body.fields);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const { key } = await req.json();
  await deleteCustomField(id, key);
  return NextResponse.json({ ok: true });
}
