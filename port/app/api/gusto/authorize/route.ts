/**
 * GET /api/gusto/authorize
 *
 * One-time setup: redirects an admin to Gusto's OAuth authorization page.
 * After the user approves, Gusto redirects to /api/gusto/callback with a code.
 * The callback handler exchanges it for tokens and displays the refresh_token
 * so you can store it as GUSTO_REFRESH_TOKEN in Vercel.
 *
 * Only accessible to admin/finance users (guarded by auth + tier check).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, isFinance } from "@/lib/role";

const GUSTO_API_BASE = process.env.GUSTO_API_BASE ?? "https://api.gusto.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://port.windedvertigo.com";

const SCOPES = [
  "companies:read",
  "employees:read",
  "payrolls:read",
  "payrolls:write",
  "public",
].join(" ");

export async function GET() {
  console.log("[gusto/authorize] OAuth initiation requested");
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  if (!isAdmin(email) && !isFinance(email)) {
    return NextResponse.json({ error: "Forbidden — admin or finance role required" }, { status: 403 });
  }

  const clientId = process.env.GUSTO_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GUSTO_CLIENT_ID not configured" },
      { status: 500 },
    );
  }

  const tier = isAdmin(email) ? "admin" : "finance";
  console.log(`[gusto/authorize] initiating OAuth for ${email} (tier=${tier})`);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${APP_URL}/api/gusto/callback`,
    response_type: "code",
    scope: SCOPES,
  });

  return NextResponse.redirect(
    `${GUSTO_API_BASE}/oauth/authorize?${params.toString()}`,
  );
}
