import { NextResponse } from "next/server";
import { getState, ensureTable } from "../../lib/prowl-db";

// ensure table exists on first cold start
let tableReady = false;

export async function GET() {
  if (!tableReady) {
    await ensureTable();
    tableReady = true;
  }
  const state = await getState();
  return NextResponse.json(state, {
    headers: { "Cache-Control": "no-store" },
  });
}
