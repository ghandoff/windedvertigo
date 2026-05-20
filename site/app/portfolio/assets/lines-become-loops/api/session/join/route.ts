import type { NextRequest } from "next/server";
import { apiHeaders, getSessionKv, SESSION_TTL } from "@/lib/session-kv";

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as { code?: string };
    if (!body.code || !/^[A-Z0-9]{6}$/.test(body.code.toUpperCase())) {
      return Response.json({ error: "invalid session code" }, { status: 400, headers: apiHeaders() });
    }

    const upperCode = body.code.toUpperCase();
    const kv = getSessionKv();
    const raw = await kv.get(`session:${upperCode}`);
    if (!raw) {
      return Response.json({ error: "session not found or expired" }, { status: 404, headers: apiHeaders() });
    }

    const pid = crypto.randomUUID();
    const student = {
      joinedAt: new Date().toISOString(),
      currentScenario: null as string | null,
      progress: {} as Record<string, unknown>,
    };
    // Wrap in try-catch: if KV is rate-limited the student still gets a
    // participantId and can interact; state tracking may be degraded but the
    // session does not abort.
    try {
      await kv.put(`student:${upperCode}:${pid}`, JSON.stringify(student), { expirationTtl: SESSION_TTL });
    } catch (writeErr) {
      console.error("session/join: student write failed (issuing participantId anyway):", writeErr);
    }

    const session = JSON.parse(raw) as { config?: { collectReflections?: boolean } };
    return Response.json(
      { participantId: pid, sessionCode: upperCode, config: session.config || { collectReflections: true } },
      { status: 200, headers: apiHeaders() },
    );
  } catch (err) {
    console.error("session/join error:", err);
    return Response.json({ error: "internal error" }, { status: 500, headers: apiHeaders() });
  }
}
