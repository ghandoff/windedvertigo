/**
 * API route: /api/preferences
 *
 * GET  — fetch accessibility + tier preferences
 * PATCH — update accessibility/tier preferences + set cookies for instant CSS
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import {
  getAccessibilityPrefs,
  updateAccessibilityPrefs,
  getUserTier,
  updateUserTier,
} from "@/lib/queries/accessibility";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  const prefs = await getAccessibilityPrefs(session.userId);
  const uiTier = await getUserTier(session.userId);
  return NextResponse.json({ ...prefs, uiTier });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const a11yUpdates: {
      reduceMotion?: boolean;
      dyslexiaFont?: boolean;
      calmTheme?: boolean;
    } = {};

    if (typeof body.reduceMotion === "boolean") {
      a11yUpdates.reduceMotion = body.reduceMotion;
    }
    if (typeof body.dyslexiaFont === "boolean") {
      a11yUpdates.dyslexiaFont = body.dyslexiaFont;
    }
    if (typeof body.calmTheme === "boolean") {
      a11yUpdates.calmTheme = body.calmTheme;
    }

    // Progressive disclosure tier
    const validTiers = ["casual", "curious", "collaborator"];
    const hasTierUpdate = typeof body.uiTier === "string" && validTiers.includes(body.uiTier);

    if (Object.keys(a11yUpdates).length === 0 && !hasTierUpdate) {
      return NextResponse.json(
        { error: "no valid fields to update" },
        { status: 400 },
      );
    }

    // Update accessibility prefs if any provided
    const prefs = Object.keys(a11yUpdates).length > 0
      ? await updateAccessibilityPrefs(session.userId, a11yUpdates)
      : await getAccessibilityPrefs(session.userId);

    // Update tier if provided
    const uiTier = hasTierUpdate
      ? await updateUserTier(session.userId, body.uiTier)
      : await getUserTier(session.userId);

    // Set cookies so root layout can apply CSS classes before JS hydrates.
    // HttpOnly=false so client JS can also read them for optimistic UI.
    const res = NextResponse.json({ ...prefs, uiTier });
    const cookieOpts = {
      path: "/harbor/creaseworks",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };

    res.cookies.set("cw-reduce-motion", String(prefs.reduceMotion), cookieOpts);
    res.cookies.set("cw-dyslexia-font", String(prefs.dyslexiaFont), cookieOpts);
    res.cookies.set("cw-calm-theme", String(prefs.calmTheme), cookieOpts);
    res.cookies.set("cw-ui-tier", String(uiTier), cookieOpts);

    return res;
  } catch (err: unknown) {
    console.error("[a11y prefs] update failed:", err);
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
}
