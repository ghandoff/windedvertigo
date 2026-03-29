import { NextResponse } from "next/server";
import { dispatchTasks } from "@/lib/data";
import { kvGet } from "@/lib/kv";

export async function GET() {
  const data = await kvGet("ops:dispatch");
  return NextResponse.json(data ?? dispatchTasks);
}
