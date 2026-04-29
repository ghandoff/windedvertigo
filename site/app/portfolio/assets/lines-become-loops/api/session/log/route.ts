import type { NextRequest } from "next/server";
import { apiHeaders, getSessionKv, SESSION_TTL } from "@/lib/session-kv";

interface Session {
  config?: { collectReflections?: boolean };
}

interface Student {
  joinedAt: string | null;
  currentScenario: string | null;
  progress: Record<string, { started?: boolean; interacting?: boolean }>;
}

const TEXT_EVENTS = new Set(["hypothesis_written", "shifted_written"]);

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ct = req.headers.get("content-type") ?? "";
    const body = (ct.includes("text/plain")
      ? JSON.parse(await req.text())
      : await req.json()) as {
      sessionCode?: string;
      participantId?: string;
      type?: string;
      data?: { scenario?: string; interventionId?: string; dosage?: number; text?: string };
    };

    const { sessionCode, participantId, type, data } = body;
    if (!sessionCode || !participantId || !type) {
      return Response.json({ error: "missing required fields" }, { status: 400, headers: apiHeaders() });
    }

    const kv = getSessionKv();
    const raw = await kv.get(`session:${sessionCode}`);
    if (!raw) {
      return Response.json({ error: "session not found" }, { status: 404, headers: apiHeaders() });
    }

    const session = JSON.parse(raw) as Session;
    if (!session.config?.collectReflections && TEXT_EVENTS.has(type)) {
      return Response.json({ ok: true, skipped: true }, { status: 200, headers: apiHeaders() });
    }

    const event = { type, data: data || {}, timestamp: new Date().toISOString() };
    const eventKey = `event:${sessionCode}:${participantId}:${Date.now()}`;
    await kv.put(eventKey, JSON.stringify(event), { expirationTtl: SESSION_TTL });

    const studentKey = `student:${sessionCode}:${participantId}`;
    const studentRaw = await kv.get(studentKey);
    if (studentRaw) {
      const student = JSON.parse(studentRaw) as Student;
      if (data?.scenario) student.currentScenario = data.scenario;
      if (type === "scenario_started" && data?.scenario) {
        student.progress[data.scenario] = { started: true };
      }
      if (type === "slider_move" && data?.scenario) {
        if (!student.progress[data.scenario]) student.progress[data.scenario] = {};
        student.progress[data.scenario].interacting = true;
      }
      await kv.put(studentKey, JSON.stringify(student), { expirationTtl: SESSION_TTL });
    }

    return Response.json({ ok: true }, { status: 200, headers: apiHeaders() });
  } catch (err) {
    console.error("session/log error:", err);
    return Response.json({ error: "internal error" }, { status: 500, headers: apiHeaders() });
  }
}
