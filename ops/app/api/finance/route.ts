import { NextResponse } from "next/server";
import { financialMetrics } from "@/lib/data";
import { kvGet } from "@/lib/kv";

export async function GET() {
  const data = await kvGet("ops:finance");
  return NextResponse.json(data ?? financialMetrics);
}
