/**
 * GET  /api/listen/prefs → { speaker } — the caller's chosen Aura voice.
 * PUT  /api/listen/prefs { speaker } → save it (validated against AURA_SPEAKERS).
 *
 * Per-login preference: stored server-side so it syncs across the caller's
 * devices. Session-gated. Falls back to Carl's default ("arcas") when unset.
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { error } from "@/lib/api-helpers";
import { getListenPref, setListenPref } from "@/lib/supabase/listen";
import { resolveAuraSpeaker, CARL_READING_SPEAKER, AURA_SPEAKERS } from "@/lib/tts";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);
  const speaker = (await getListenPref(session.user.email)) ?? CARL_READING_SPEAKER;
  return Response.json({ speaker, voices: AURA_SPEAKERS });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return error("Unauthorized", 401);

  let body: { speaker?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return error("invalid JSON", 400);
  }

  const speaker = resolveAuraSpeaker(body.speaker);
  if (speaker !== body.speaker) return error("unknown voice", 400);

  await setListenPref(session.user.email, speaker);
  return Response.json({ speaker });
}
