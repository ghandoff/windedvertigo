import { NextResponse } from "next/server";
import { teamMembers } from "@/lib/data";
import { kvGet } from "@/lib/kv";

export async function GET() {
  const data = await kvGet("ops:team");
  return NextResponse.json(data ?? teamMembers);
}
