import type { NextRequest } from "next/server";
import { apiHeaders, getSessionKv, hashPin, listKeys } from "@/lib/session-kv";

interface Student {
  joinedAt: string | null;
  currentScenario: string | null;
  progress: Record<string, unknown>;
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const pin = searchParams.get("pin");
    if (!code || !pin) {
      return Response.json({ error: "missing code or pin" }, { status: 400, headers: apiHeaders() });
    }

    const kv = getSessionKv();
    const raw = await kv.get(`session:${code}`);
    if (!raw) {
      return Response.json({ error: "session not found or expired" }, { status: 404, headers: apiHeaders() });
    }

    const session = JSON.parse(raw) as { facilitatorPin: string; createdAt: string; config: unknown };
    if ((await hashPin(pin)) !== session.facilitatorPin) {
      return Response.json({ error: "invalid pin" }, { status: 403, headers: apiHeaders() });
    }

    const studentKeys = await listKeys(kv, `student:${code}:`);
    const students = await Promise.all(
      studentKeys.map(async (key) => {
        const pid = key.slice(`student:${code}:`.length);
        const studentRaw = await kv.get(key);
        const student: Student = studentRaw
          ? (JSON.parse(studentRaw) as Student)
          : { joinedAt: null, currentScenario: null, progress: {} };
        return {
          participantId: pid,
          joinedAt: student.joinedAt,
          currentScenario: student.currentScenario,
          progress: student.progress || {},
        };
      }),
    );

    return Response.json(
      { code, createdAt: session.createdAt, config: session.config, studentCount: students.length, students },
      { status: 200, headers: apiHeaders() },
    );
  } catch (err) {
    console.error("session/status error:", err);
    return Response.json({ error: "internal error" }, { status: 500, headers: apiHeaders() });
  }
}
