import { NextResponse } from "next/server";
import { tasks } from "@/lib/data";
import { kvGet } from "@/lib/kv";

export async function GET() {
  const data = await kvGet("ops:tasks");
  return NextResponse.json(data ?? tasks);
}
