/**
 * POST /api/contacts/[id]/enrich
 *
 * Enriches a contact with profile photo + email address.
 *
 * Photo priority:  Proxycurl (LinkedIn) → Gravatar
 * Email priority:  Proxycurl (LinkedIn) → Hunter.io (name + org domain)
 *
 * Only overwrites email if the contact currently has none, OR if
 * { forceEmail: true } is passed in the request body.
 */

import { NextRequest, NextResponse } from "next/server";
import { getContact, updateContact } from "@/lib/notion/contacts";
import { getOrganization } from "@/lib/notion/organizations";
import { enrichContact } from "@/lib/enrichment/contact-enrichment";

export const maxDuration = 25;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const forceEmail = Boolean(body?.forceEmail);

  let contact;
  try {
    contact = await getContact(id);
  } catch {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  if (!contact.email && !contact.linkedin && !contact.organizationIds[0]) {
    return NextResponse.json(
      { error: "Contact has no email, LinkedIn URL, or linked org — cannot enrich" },
      { status: 422 },
    );
  }

  // Fetch linked org website for Hunter.io domain lookup
  let orgWebsite: string | undefined;
  if (contact.organizationIds[0]) {
    try {
      const org = await getOrganization(contact.organizationIds[0]);
      orgWebsite = org.website || undefined;
    } catch { /* org fetch optional */ }
  }

  const enriched = await enrichContact({
    name: contact.name,
    email: contact.email || undefined,
    linkedinUrl: contact.linkedin || undefined,
    orgWebsite,
  });

  // Build Notion update — only write what changed
  const updates: Parameters<typeof updateContact>[1] = {};

  if (enriched.photoUrl) {
    updates.profilePhotoUrl = enriched.photoUrl;
  }

  // Only update email if it was blank, or caller explicitly requested an override
  if (enriched.email && (!contact.email || forceEmail)) {
    updates.email = enriched.email;
  }

  if (Object.keys(updates).length > 0) {
    await updateContact(id, updates);
  }

  return NextResponse.json({
    ok: true,
    photoUrl: enriched.photoUrl,
    photoSource: enriched.photoSource,
    email: enriched.email,
    emailSource: enriched.emailSource,
    emailConfidence: enriched.emailConfidence,
    emailUpdated: !!updates.email,
    // Surface what tools are available so the client can show a useful message
    hasProxycurl: !!process.env.PROXYCURL_API_KEY,
    hasHunter: !!process.env.HUNTER_API_KEY,
  });
}
