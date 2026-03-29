import { NextResponse } from "next/server";
import { dispatchTasks } from "@/lib/data";

export async function GET() {
  return NextResponse.json(dispatchTasks);
}
