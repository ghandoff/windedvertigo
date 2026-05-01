/**
 * One-shot backfill: compute `relationship` from legacy fields and write
 * to the new native Notion property for every organisation.
 *
 * GET /api/admin/backfill-relationship
 *
 * Rate-limited to ~3 writes/sec (Notion's limit) via a 350ms delay.
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOrganizations, updateOrganization } from "@/lib/notion/organizations";
import { deriveRelationship } from "@/lib/notion/derived-fields";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let total = 0;
  let updated = 0;
  let skipped = 0;
  const errors: { id: string; name: string; error: string }[] = [];
  let cursor: string | undefined;

  do {
    const page = await queryOrganizations(undefined, {
      pageSize: 100,
      cursor,
    });

    for (const org of page.data) {
      total++;

      const derived = deriveRelationship(
        org.connection,
        org.outreachStatus,
        org.friendship,
      );

      // Skip if org already has the correct native value
      // (in case of re-run after partial backfill)
      if (org.relationship === derived) {
        skipped++;
        continue;
      }

      try {
        await updateOrganization(org.id, { relationship: derived });
        updated++;
      } catch (err) {
        errors.push({
          id: org.id,
          name: org.organization,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Respect Notion's 3-req/sec rate limit
      await new Promise((r) => setTimeout(r, 350));
    }

    cursor = page.nextCursor ?? undefined;
  } while (cursor);

  return NextResponse.json({ total, updated, skipped, errors });
}
