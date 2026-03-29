import { NextResponse } from "next/server";
import { kvPut } from "@/lib/kv";

export async function POST(request: Request) {
  // Bearer token auth
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.KV_WRITE_TOKEN;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { key, data } = await request.json();

    if (!key || data === undefined) {
      return NextResponse.json(
        { error: "missing key or data in request body" },
        { status: 400 },
      );
    }

    const ok = await kvPut(key, data);

    if (!ok) {
      return NextResponse.json(
        { error: "kv write failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "invalid request body" },
      { status: 400 },
    );
  }
}
