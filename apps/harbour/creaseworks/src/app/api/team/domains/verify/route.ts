/**
 * GET /api/team/domains/verify?token=... — confirm domain ownership.
 *
 * Session 12: self-service domain verification.
 *
 * This is the endpoint linked in the verification email. When clicked,
 * it verifies the domain and redirects to the team page with a success
 * message. No auth required — the token itself proves mailbox access.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyDomainByToken,
  getDomainByToken,
} from "@/lib/queries/organisations";

/** Build a redirect URL that preserves basePath via nextUrl.clone(). */
function teamRedirect(req: NextRequest, query: Record<string, string>) {
  const url = req.nextUrl.clone();
  url.pathname = "/team";
  url.search = new URLSearchParams(query).toString();
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return teamRedirect(req, { verify: "error", reason: "missing-token" });
  }

  const result = await verifyDomainByToken(token);

  if (result) {
    // success — redirect to team page with domain info
    return teamRedirect(req, { verify: "success", domain: result.domain });
  }

  // verifyDomainByToken returned null — either the token is invalid,
  // expired, or the domain was already verified (user clicked link twice).
  // Check if the token belongs to an already-verified domain so we can
  // give a friendly "already verified" message instead of an error.
  const existing = await getDomainByToken(token);

  if (existing?.verified) {
    return teamRedirect(req, { verify: "success", domain: existing.domain });
  }

  // token genuinely invalid or expired
  const reason = existing ? "expired-token" : "invalid-token";
  return teamRedirect(req, { verify: "error", reason });
}
