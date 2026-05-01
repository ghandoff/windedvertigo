/**
 * /api/team/domains — self-service domain verification management.
 *
 * Session 12: self-service domain verification.
 *
 * GET  — list verified domains for the caller's org (org admin only)
 * POST — initiate domain verification: saves domain + sends email
 * DELETE — remove a verified domain record
 *
 * All routes require org admin auth via requireOrgAdmin().
 */

import { NextRequest, NextResponse } from "next/server";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import {
  addVerifiedDomain,
  getOrgVerifiedDomains,
  removeVerifiedDomain,
  isBlockedDomain,
} from "@/lib/queries/organisations";
import { sendDomainVerificationEmail } from "@/lib/email/send-verification";
import { logAccess } from "@/lib/queries/audit";
import { MAX_LENGTHS, parseJsonBody } from "@/lib/validation";

/* ------------------------------------------------------------------ */
/*  GET — list org's verified domains                                  */
/* ------------------------------------------------------------------ */

export async function GET() {
  const session = await requireOrgAdmin();
  const domains = await getOrgVerifiedDomains(session.orgId!);
  return NextResponse.json({ domains });
}

/* ------------------------------------------------------------------ */
/*  POST — initiate domain verification                                */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  const session = await requireOrgAdmin();

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { domain, verificationEmail } = body as {
    domain?: string;
    verificationEmail?: string;
  };

  if (!domain || typeof domain !== "string") {
    return NextResponse.json(
      { error: "domain is required" },
      { status: 400 },
    );
  }

  // normalise and basic validation
  const cleanDomain = domain.toLowerCase().trim().replace(/^@/, "");
  if (
    !cleanDomain ||
    cleanDomain.includes(" ") ||
    !cleanDomain.includes(".") ||
    cleanDomain.length > MAX_LENGTHS.domain
  ) {
    return NextResponse.json(
      { error: "invalid domain format" },
      { status: 400 },
    );
  }

  // check blocklist
  if (await isBlockedDomain(cleanDomain)) {
    return NextResponse.json(
      { error: "this domain is blocked" },
      { status: 400 },
    );
  }

  // the verification email must be @domain — the person receiving it
  // proves they have access to a mailbox on that domain.
  // Default to the current user's email if it matches the domain,
  // otherwise the caller must provide a verificationEmail.
  const callerDomain = session.email.split("@")[1]?.toLowerCase().trim();
  let targetEmail: string;

  if (verificationEmail && typeof verificationEmail === "string") {
    if (verificationEmail.length > MAX_LENGTHS.email) {
      return NextResponse.json(
        { error: "verification email is too long" },
        { status: 400 },
      );
    }
    const emailDomain = verificationEmail
      .toLowerCase()
      .trim()
      .split("@")[1];
    if (emailDomain !== cleanDomain) {
      return NextResponse.json(
        {
          error: `verification email must be an @${cleanDomain} address`,
        },
        { status: 400 },
      );
    }
    targetEmail = verificationEmail.toLowerCase().trim();
  } else if (callerDomain === cleanDomain) {
    targetEmail = session.email;
  } else {
    return NextResponse.json(
      {
        error: `provide a verification email address at @${cleanDomain}`,
      },
      { status: 400 },
    );
  }

  // create or reset the domain verification record
  const record = await addVerifiedDomain(
    session.orgId!,
    cleanDomain,
    targetEmail,
  );

  // if the domain is already verified, return early — no email needed
  if (record.verified) {
    return NextResponse.json({
      ok: true,
      domain: {
        id: record.id,
        domain: record.domain,
        verified: true,
        verification_email: targetEmail,
        verified_at: null, // not returned by query, but doesn't matter
      },
      message: `${cleanDomain} is already verified`,
    });
  }

  // send the verification email
  const emailResult = await sendDomainVerificationEmail({
    to: targetEmail,
    domain: cleanDomain,
    orgName: session.orgName || "your organisation",
    token: record.verification_token,
  });

  if (!emailResult.success) {
    return NextResponse.json(
      {
        error: `domain saved but email failed: ${emailResult.error}`,
        domain: record,
      },
      { status: 500 },
    );
  }

  // audit log
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    null,
    null,
    "domain_verification_initiated",
    ip,
    [],
    { domain: cleanDomain },
  );

  return NextResponse.json({
    ok: true,
    domain: {
      id: record.id,
      domain: record.domain,
      verified: false,
      verification_email: targetEmail,
      verified_at: null,
    },
    message: `verification email sent to ${targetEmail}`,
  });
}

/* ------------------------------------------------------------------ */
/*  DELETE — remove a verified domain                                  */
/* ------------------------------------------------------------------ */

export async function DELETE(req: NextRequest) {
  const session = await requireOrgAdmin();

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { domainId } = body as { domainId?: string };
  if (!domainId) {
    return NextResponse.json(
      { error: "domainId is required" },
      { status: 400 },
    );
  }

  const result = await removeVerifiedDomain(session.orgId!, domainId);
  if (!result) {
    return NextResponse.json(
      { error: "domain not found or does not belong to your organisation" },
      { status: 404 },
    );
  }

  // audit log
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    null,
    null,
    "domain_verification_removed",
    ip,
    [],
    { domainId },
  );

  return NextResponse.json({ ok: true });
}
