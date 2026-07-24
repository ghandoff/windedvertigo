/**
 * GET /api/cron/soundings-sweep — sounding-board lifecycle (hourly).
 *
 * Catch-up of thread replies slack never delivered (conversations.replies),
 * transcript retries, the ONE-max reminder DMs, digest at deadline (or early
 * when everyone responded), graceful zero-note expiry, digest-post repair,
 * receipt DMs, and the 7-day grace auto-close. Idempotent throughout — every
 * mutation sits behind a unique index or an atomic status claim, so this can
 * run alongside the events route (and itself) safely.
 *
 * Env vars:
 *   CRON_SECRET            — Bearer auth
 *   SLACK_AGENT_BOT_TOKEN  — thread reads, file downloads, DMs (wv-claw)
 *   OPENAI_API_KEY         — whisper transcription retries
 *   ANTHROPIC_API_KEY      — digest generation
 */

import { NextRequest, NextResponse } from "next/server";
import { runSoundingsSweep } from "@/lib/soundings/sweep";

// Whisper retries + a digest generation can add up; stay well under the
// 15-min cap for cron-triggered routes.
export const maxDuration = 600;

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runSoundingsSweep();
  console.log("[soundings-sweep]", JSON.stringify(result));

  // Per-sounding errors are partial failures (already itemized); only a sweep
  // that couldn't do ANY work while soundings were open is a hard failure the
  // cron-router should log to Opsy.
  const hardFailure =
    result.openSoundings > 0 && result.errors.length >= result.openSoundings;
  if (hardFailure) {
    return NextResponse.json({ ok: false, ...result }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...result });
}
