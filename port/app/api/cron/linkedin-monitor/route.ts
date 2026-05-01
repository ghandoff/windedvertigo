/**
 * GET /api/cron/linkedin-monitor
 *
 * Runs monthly on the 5th at 9am UTC.
 * For each contact with a LinkedIn URL, re-fetches their current role/company
 * via Proxycurl and flags job changes since last check.
 *
 * Requires:
 *   PROXYCURL_API_KEY — get at nubela.co/proxycurl (~$0.01/lookup)
 *
 * On job change: updates contact notes with the change, posts Slack alert.
 * Skips gracefully if PROXYCURL_API_KEY is not set.
 */

import { NextRequest, NextResponse } from "next/server";
import { queryContacts, updateContact } from "@/lib/notion/contacts";
import { postToSlack } from "@/lib/slack";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

interface ProxycurlPerson {
  full_name?: string;
  headline?: string;
  occupation?: string;
  company?: string;
  experiences?: Array<{
    company?: string;
    title?: string;
    starts_at?: { year?: number; month?: number };
    ends_at?: null | { year?: number };
  }>;
}

async function fetchLinkedInProfile(
  linkedinUrl: string,
): Promise<ProxycurlPerson | null> {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://nubela.co/proxycurl/api/v2/linkedin?url=${encodeURIComponent(linkedinUrl)}&use_cache=if-present`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getCurrentRole(profile: ProxycurlPerson): string {
  // Most recent experience with no end date = current role
  const current = profile.experiences?.find((e) => !e.ends_at);
  if (current) return `${current.title ?? ""} at ${current.company ?? ""}`.trim();
  return profile.headline ?? profile.occupation ?? "";
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.PROXYCURL_API_KEY) {
    return NextResponse.json({ message: "skipped — PROXYCURL_API_KEY not set" });
  }

  // Get contacts with LinkedIn URLs (pageSize 50 — process monthly in batches)
  const { data: contacts } = await queryContacts({}, { pageSize: 50 });
  const withLinkedIn = contacts.filter((c) => c.linkedin?.includes("linkedin.com"));

  if (withLinkedIn.length === 0) {
    return NextResponse.json({ message: "no contacts with LinkedIn URLs" });
  }

  const jobChanges: string[] = [];
  const checked: string[] = [];
  let errors = 0;

  for (const contact of withLinkedIn) {
    try {
      const profile = await fetchLinkedInProfile(contact.linkedin);
      if (!profile) { errors++; continue; }

      const currentRole = getCurrentRole(profile);
      checked.push(contact.name);

      // Detect job change: compare to role stored in port
      // We use the contact's `role` field as the reference
      const storedRole = contact.role?.trim().toLowerCase();
      const fetchedRole = currentRole.trim().toLowerCase();

      if (
        storedRole &&
        fetchedRole &&
        storedRole !== fetchedRole &&
        !fetchedRole.includes(storedRole) &&
        !storedRole.includes(fetchedRole)
      ) {
        jobChanges.push(
          `*${contact.name}*: was "${contact.role}" → now "${currentRole}"`,
        );

        // Update role and flag in nextAction
        const changeNote = `job change detected ${new Date().toISOString().split("T")[0]}: → ${currentRole}`;
        await updateContact(contact.id, {
          role: currentRole,
          nextAction: changeNote.slice(0, 500),
        }).catch(() => {});
      }
    } catch {
      errors++;
    }
  }

  if (jobChanges.length > 0) {
    const msg = [
      "*🔄 LinkedIn Job Change Alerts*",
      "",
      ...jobChanges,
      "",
      "_These contacts may be worth re-engaging. View at port.windedvertigo.com/contacts_",
    ].join("\n");
    await postToSlack(msg);
  }

  return NextResponse.json({
    message: `checked ${checked.length} contacts, found ${jobChanges.length} job changes`,
    jobChanges,
    errors,
  });
}
