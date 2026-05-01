import { NextResponse } from "next/server";
import { saveSessionResults } from "@/lib/notion";
import type { SessionResultPayload } from "@/lib/notion";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SessionResultPayload;

    // basic validation
    if (!payload.code || !payload.sessionName) {
      return NextResponse.json(
        { error: "missing required fields" },
        { status: 400 },
      );
    }

    const pageId = await saveSessionResults(payload);
    return NextResponse.json({ id: pageId });
  } catch (error) {
    console.error("failed to save session:", error);
    return NextResponse.json(
      { error: "failed to save session results" },
      { status: 500 },
    );
  }
}
