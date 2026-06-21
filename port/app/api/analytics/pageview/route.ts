import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let path: string;
  try {
    const body = await req.json();
    path = typeof body.path === "string" ? body.path : "";
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!path || path.length > 500) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  await supabase.from("port_usage_events").insert({
    user_email: session.user.email,
    path,
  });

  return NextResponse.json({ ok: true });
}
