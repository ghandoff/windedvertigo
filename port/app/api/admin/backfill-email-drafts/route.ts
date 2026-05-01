/**
 * One-shot backfill: populate `sentTo` on email drafts from the first campaign.
 *
 * GET /api/admin/backfill-email-drafts
 *
 * For campaign 33be4ee7-4ba4-81be-b832-d045290c5a30, finds every draft that has
 * an organisationId but empty sentTo, looks up the org email, and writes it back.
 * These were all org-level sends (no contact fan-out in the first campaign).
 *
 * Rate-limited to ~3 writes/sec (Notion's limit) via a 350ms delay.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  queryEmailDraftsByCampaign,
  updateEmailDraft,
} from "@/lib/notion/email-drafts";
import { getOrganization } from "@/lib/notion/organizations";

const CAMPAIGN_ID = "33be4ee7-4ba4-81be-b832-d045290c5a30";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const drafts = await queryEmailDraftsByCampaign(CAMPAIGN_ID);

  let total = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { id: string; subject: string; error: string }[] = [];

  for (const draft of drafts) {
    total++;

    // Only backfill drafts that have an org but no sentTo
    if (!draft.organizationId || draft.sentTo) {
      skipped++;
      continue;
    }

    try {
      const org = await getOrganization(draft.organizationId);

      if (!org.email) {
        skipped++;
        continue;
      }

      await updateEmailDraft(draft.id, { sentTo: org.email });
      updated++;
    } catch (err) {
      errors.push({
        id: draft.id,
        subject: draft.subject,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Respect Notion's 3-req/sec rate limit
    await new Promise((r) => setTimeout(r, 350));
  }

  return NextResponse.json({ total, updated, skipped, errors });
}
