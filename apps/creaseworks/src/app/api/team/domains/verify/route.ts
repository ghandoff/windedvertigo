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
import { verifyDomainByToken } from "@/lib/queries/organisations";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      new URL("/team?verify=error&reason=missing-token", req.url),
    );
  }

  const result = await verifyDomainByToken(token);

  if (!result) {
    // token not found or already used
    return NextResponse.redirect(
      new URL("/team?verify=error&reason=invalid-token", req.url),
    );
  }

  // success — redirect to team page with domain info
  return NextResponse.redirect(
    new URL(
      `/team?verify=success&domain=${encodeURIComponent(result.domain)}`,
      req.url,
    ),
  );
}
