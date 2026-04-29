import type { NextRequest } from "next/server";
import { apiHeaders, getSessionKv, hashPin, SESSION_TTL } from "@/lib/session-kv";

interface Session {
  facilitatorPin: string;
  createdAt: string;
  config: { collectReflections: boolean };
}

export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as { code?: string; pin?: string; collectReflections?: boolean };
    const { code, pin, collectReflections } = body;
    if (!code || !pin) {
      return Response.json({ error: "missing code or pin" }, { status: 400, headers: apiHeaders() });
    }

    const kv = getSessionKv();
    const raw = await kv.get(`session:${code}`);
    if (!raw) {
      return Response.json({ error: "session not found or expired" }, { status: 404, headers: apiHeaders() });
    }

    const session = JSON.parse(raw) as Session;
    if ((await hashPin(pin)) !== session.facilitatorPin) {
      return Response.json({ error: "invalid pin" }, { status: 403, headers: apiHeaders() });
    }

    if (typeof collectReflections === "boolean") {
      session.config.collectReflections = collectReflections;
    }

    await kv.put(`session:${code}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
    return Response.json({ config: session.config }, { status: 200, headers: apiHeaders() });
  } catch (err) {
    console.error("session/config error:", err);
    return Response.json({ error: "internal error" }, { status: 500, headers: apiHeaders() });
  }
}
