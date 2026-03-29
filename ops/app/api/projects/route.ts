import { NextResponse } from "next/server";
import { projects } from "@/lib/data";

export async function GET() {
  return NextResponse.json(projects);
}
