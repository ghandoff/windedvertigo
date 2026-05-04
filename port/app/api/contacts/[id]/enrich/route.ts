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
import { getContactByIdFromSupabase, upsertContactToSupabase } from "@/lib/supabase/contacts";
import { getOrganizationByIdFromSupabase } from "@/lib/supabase/organizations";
import { enrichContact } from "@/lib/enrichment/contact-enrichment";

export const maxDuration = 25;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const forceEmail = Boolean(body?.forceEmail);

  const contact = await getContactByIdFromSupabase(id);
  if (!contact) {
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
    const org = await getOrganizationByIdFromSupabase(contact.organizationIds[0]);
    orgWebsite = org?.website || undefined;
  }

  const enriched = await enrichContact({
    name: contact.name,
    email: contact.email || undefined,
    linkedinUrl: contact.linkedin || undefined,
    orgWebsite,
  });

  // Build Supabase update — only write what changed
  const supabaseUpdates: Record<string, unknown> = {};

  if (enriched.photoUrl) {
    supabaseUpdates.profile_photo_url = enriched.photoUrl;
  }

  // Only update email if it was blank, or caller explicitly requested an override
  if (enriched.email && (!contact.email || forceEmail)) {
    supabaseUpdates.email = enriched.email;
  }

  if (Object.keys(supabaseUpdates).length > 0) {
    await upsertContactToSupabase(id, supabaseUpdates as Parameters<typeof upsertContactToSupabase>[1]);
  }

  return NextResponse.json({
    ok: true,
    photoUrl: enriched.photoUrl,
    photoSource: enriched.photoSource,
    email: enriched.email,
    emailSource: enriched.emailSource,
    emailConfidence: enriched.emailConfidence,
    emailUpdated: !!supabaseUpdates.email,
    // Surface what tools are available so the client can show a useful message
    hasProxycurl: !!process.env.PROXYCURL_API_KEY,
    hasHunter: !!process.env.HUNTER_API_KEY,
  });
}
