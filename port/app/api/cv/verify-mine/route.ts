/**
 * GET /api/cv/verify-mine
 *
 * Marks the CURRENT logged-in user's CV as verified — the click-target for
 * the "Your CV is stale" link in proposal-completion DMs.
 *
 * Magic-link UX without the magic link complexity: the DM includes this
 * URL, user clicks, browser opens port (already authenticated), session
 * check resolves the user.email, we bump last_verified_at, then redirect
 * to /work/cv (a small confirmation page).
 *
 * POST variant accepts an explicit email — used by future Slack Block Kit
 * interactive button when we wire the Slack-side flow.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { markCvVerified, getCvByEmail } from "@/lib/supabase/cv";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    // Not logged in — bounce to login with a return-to. The magic link flow
    // will then come back here once auth is established.
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("returnTo", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const email = session.user.email;
  const cv = await getCvByEmail(email).catch(() => null);
  if (!cv) {
    return NextResponse.json(
      { error: `no CV record for ${email} — contact garrett to add one` },
      { status: 404 },
    );
  }

  await markCvVerified(email);
  console.warn(`[cv] ${email} marked their CV current`);

  // Redirect to a tiny confirmation page. /work/cv exists in plan; for now
  // just bounce back to the RFP radar root with a query param the UI can read.
  const dest = new URL("/rfp-radar", req.url);
  dest.searchParams.set("cvVerified", email);
  return NextResponse.redirect(dest);
}

export async function POST(req: NextRequest) {
  // For programmatic use (cron, agent, future Slack interactive button).
  // Auth: must be logged in AND match the email being verified, OR have
  // CRON_SECRET (admin path).
  const session = await auth();
  let email: string | null = null;
  try {
    const body = (await req.json()) as { email?: string };
    email = body?.email ?? null;
  } catch {
    /* fall through */
  }

  const isCron = req.headers.get("authorization")?.replace("Bearer ", "") === process.env.CRON_SECRET;
  if (!isCron) {
    if (!session?.user?.email) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (email && email !== session.user.email) {
      return NextResponse.json({ error: "can only verify your own CV" }, { status: 403 });
    }
    email = session.user.email;
  }

  if (!email) {
    return NextResponse.json({ error: "email required" }, { status: 400 });
  }

  await markCvVerified(email);
  console.warn(`[cv] ${email} marked CV current (via ${isCron ? "cron" : "session"})`);
  return NextResponse.json({ ok: true, email, verifiedAt: new Date().toISOString() });
}
