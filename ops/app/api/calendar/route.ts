import { NextResponse } from "next/server";
import { upcomingMeetings } from "@/lib/data";

export async function GET() {
  return NextResponse.json(upcomingMeetings);
}
