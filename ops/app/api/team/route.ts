import { NextResponse } from "next/server";
import { teamMembers } from "@/lib/data";

export async function GET() {
  return NextResponse.json(teamMembers);
}
