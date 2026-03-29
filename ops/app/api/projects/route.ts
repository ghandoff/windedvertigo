import { NextResponse } from "next/server";
import { projects } from "@/lib/data";
import { kvGet } from "@/lib/kv";

export async function GET() {
  const data = await kvGet("ops:projects");
  return NextResponse.json(data ?? projects);
}
