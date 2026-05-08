/**
 * GET /api/auth/connect/linkedin
 *
 * One-click LinkedIn OAuth init. Redirects the (logged-in) user to LinkedIn's
 * authorization page with the right scopes. After approval, LinkedIn redirects
 * to /api/auth/callback/linkedin which displays the tokens + the exact
 * `wrangler secret put` commands to persist them.
 *
 * Required scopes:
 *   - openid + profile + email — needed for `/v2/userinfo` (returns the URN)
 *   - w_member_social          — post on the user's behalf
 *   - r_liteprofile            — fallback profile read
 *   - offline_access           — issues a refresh_token (60-day → 365-day)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const REDIRECT_URI = "https://port.windedvertigo.com/api/auth/callback/linkedin";
const SCOPES = ["openid", "profile", "email", "w_member_social", "r_liteprofile", "offline_access"];

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized — sign in first" }, { status: 401 });
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID not configured on this worker" },
      { status: 500 },
    );
  }

  const state = crypto.randomUUID();
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPES.join(" "));
  url.searchParams.set("state", state);

  return NextResponse.redirect(url.toString(), 302);
}
