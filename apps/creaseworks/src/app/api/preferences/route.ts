/**
 * API route: /api/preferences
 *
 * GET  — fetch accessibility preferences
 * PATCH — update accessibility preferences + set cookies for instant CSS
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import {
  getAccessibilityPrefs,
  updateAccessibilityPrefs,
} from "@/lib/queries/accessibility";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const prefs = await getAccessibilityPrefs(session.userId);
  return NextResponse.json(prefs);
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const updates: {
      reduceMotion?: boolean;
      dyslexiaFont?: boolean;
      calmTheme?: boolean;
    } = {};

    if (typeof body.reduceMotion === "boolean") {
      updates.reduceMotion = body.reduceMotion;
    }
    if (typeof body.dyslexiaFont === "boolean") {
      updates.dyslexiaFont = body.dyslexiaFont;
    }
    if (typeof body.calmTheme === "boolean") {
      updates.calmTheme = body.calmTheme;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "no valid fields to update" },
        { status: 400 },
      );
    }

    const prefs = await updateAccessibilityPrefs(session.userId, updates);

    // Set cookies so root layout can apply CSS classes before JS hydrates.
    // HttpOnly=false so client JS can also read them for optimistic UI.
    const res = NextResponse.json(prefs);
    const cookieOpts = {
      path: "/reservoir/creaseworks",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };

    res.cookies.set("cw-reduce-motion", String(prefs.reduceMotion), cookieOpts);
    res.cookies.set("cw-dyslexia-font", String(prefs.dyslexiaFont), cookieOpts);
    res.cookies.set("cw-calm-theme", String(prefs.calmTheme), cookieOpts);

    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "update failed";
    console.error("[a11y prefs] update failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
