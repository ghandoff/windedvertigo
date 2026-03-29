import { NextResponse } from "next/server";
import { financialMetrics } from "@/lib/data";

export async function GET() {
  return NextResponse.json(financialMetrics);
}
