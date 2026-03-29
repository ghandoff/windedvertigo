import { NextResponse } from "next/server";
import { tasks } from "@/lib/data";

export async function GET() {
  return NextResponse.json(tasks);
}
