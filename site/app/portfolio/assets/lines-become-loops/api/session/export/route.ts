import type { NextRequest } from "next/server";
import { apiHeaders, getSessionKv, hashPin, listKeys } from "@/lib/session-kv";

interface SessionRecord {
  facilitatorPin: string;
  createdAt: string;
  config: unknown;
}

interface StudentRecord {
  joinedAt: string | null;
  currentScenario?: string | null;
  progress: Record<string, unknown>;
}

interface EventRecord {
  type: string;
  timestamp: string;
  data: { scenario?: string; interventionId?: string; dosage?: number; text?: string };
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const pin = searchParams.get("pin");
    const format = searchParams.get("format");
    if (!code || !pin) {
      return Response.json({ error: "missing code or pin" }, { status: 400, headers: apiHeaders() });
    }

    const kv = getSessionKv();
    const raw = await kv.get(`session:${code}`);
    if (!raw) {
      return Response.json({ error: "session not found or expired" }, { status: 404, headers: apiHeaders() });
    }

    const session = JSON.parse(raw) as SessionRecord;
    if ((await hashPin(pin)) !== session.facilitatorPin) {
      return Response.json({ error: "invalid pin" }, { status: 403, headers: apiHeaders() });
    }

    const studentKeys = await listKeys(kv, `student:${code}:`);
    const participants = await Promise.all(
      studentKeys.map(async (key) => {
        const pid = key.slice(`student:${code}:`.length);
        const studentRaw = await kv.get(key);
        const student: StudentRecord = studentRaw
          ? (JSON.parse(studentRaw) as StudentRecord)
          : { joinedAt: null, currentScenario: null, progress: {} };

        const eventKeys = await listKeys(kv, `event:${code}:${pid}:`);
        const events: EventRecord[] = (
          await Promise.all(eventKeys.map((ek) => kv.get(ek)))
        )
          .filter((v): v is string => Boolean(v))
          .map((e) => JSON.parse(e) as EventRecord)
          .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

        return {
          participantId: pid,
          joinedAt: student.joinedAt,
          currentScenario: student.currentScenario,
          progress: student.progress,
          events,
        };
      }),
    );

    const exportData = { sessionCode: code, createdAt: session.createdAt, config: session.config, participants };

    if (format === "csv") {
      const rows: string[][] = [
        ["timestamp", "participant_id", "event_type", "scenario", "intervention_id", "dosage", "text_value"],
      ];
      participants.forEach((p) => {
        p.events.forEach((evt) => {
          rows.push([
            evt.timestamp || "",
            p.participantId,
            evt.type || "",
            evt.data?.scenario || "",
            evt.data?.interventionId || "",
            String(evt.data?.dosage ?? ""),
            evt.data?.text || "",
          ]);
        });
      });
      const csv = rows
        .map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","))
        .join("\n");
      return new Response(csv, {
        status: 200,
        headers: {
          ...apiHeaders(),
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="session-${code}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify(exportData), {
      status: 200,
      headers: {
        ...apiHeaders(),
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="session-${code}.json"`,
      },
    });
  } catch (err) {
    console.error("session/export error:", err);
    return Response.json({ error: "internal error" }, { status: 500, headers: apiHeaders() });
  }
}
