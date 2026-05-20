import type { NextRequest } from "next/server";
import { apiHeaders, getSessionKv, hashPin, SESSION_TTL } from "@/lib/session-kv";

const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ2345679";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
  return code;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as { pin?: string };
    if (!body.pin || !/^\d{4}$/.test(body.pin)) {
      return Response.json({ error: "pin must be exactly 4 digits" }, { status: 400, headers: apiHeaders() });
    }

    const kv = getSessionKv();
    let code = "";
    let attempts = 0;
    do {
      code = generateCode();
      const exists = await kv.get(`session:${code}`);
      if (!exists) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return Response.json({ error: "could not generate unique code, try again" }, { status: 503, headers: apiHeaders() });
    }

    const session = {
      facilitatorPin: await hashPin(body.pin),
      createdAt: new Date().toISOString(),
      config: { collectReflections: true },
    };

    await kv.put(`session:${code}`, JSON.stringify(session), { expirationTtl: SESSION_TTL });
    return Response.json({ code, createdAt: session.createdAt }, { status: 200, headers: apiHeaders() });
  } catch (err) {
    console.error("session/create error:", err);
    return Response.json({ error: "internal error" }, { status: 500, headers: apiHeaders() });
  }
}
