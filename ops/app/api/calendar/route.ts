import { NextResponse } from "next/server";
import { upcomingMeetings } from "@/lib/data";
import { kvGet } from "@/lib/kv";

export async function GET() {
  const data = await kvGet("ops:calendar");
  return NextResponse.json(data ?? upcomingMeetings);
}
