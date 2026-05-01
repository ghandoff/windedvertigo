/**
 * GET /api/cron/sync-allowances
 *
 * Runs on the 28th of each month — creates draft reimbursement timesheet entries
 * for the upcoming month from active allowances. Runs early so members can
 * submit invoices before month-end, even if the 1st falls on a weekend. Each allowance generates one reimbursement entry per
 * member, pre-populated with the allowance amount and description.
 *
 * Deduplication: Checks for existing reimbursement entries with the same
 * description + date to avoid double-creating on re-runs.
 *
 * Requires env vars:
 *   CRON_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import { getActiveAllowances } from "@/lib/notion/allowances";
import { getActiveMembers } from "@/lib/notion/members";
import { createTimesheet, queryTimesheets } from "@/lib/notion/timesheets";
import { getNotionUserMap } from "@/lib/role";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [allowances, members, notionUserMap] = await Promise.all([
    getActiveAllowances(),
    getActiveMembers(),
    getNotionUserMap(),
  ]);

  if (allowances.length === 0) {
    return NextResponse.json({ message: "no active allowances", created: 0 });
  }

  // Build member ID → member lookup
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Target the 1st of NEXT month — the cron runs on the 28th so entries
  // are available before month-end, letting people submit invoices early
  // if the 1st falls on a weekend.
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, "0");
  const dateStr = `${year}-${month}-01`;
  const monthLabel = target.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Check existing reimbursements for this month to avoid duplicates
  const { data: existingEntries } = await queryTimesheets(
    {
      type: "reimbursement",
      dateAfter: dateStr,
      dateBefore: `${year}-${month}-28`, // conservative end-of-month
    },
    { pageSize: 200 },
  );
  const existingKeys = new Set(
    existingEntries.map((e) => `${e.entry.toLowerCase()}|${e.dateAndTime?.start ?? ""}`),
  );

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const allowance of allowances) {
    if (!allowance.amount || allowance.amount <= 0) continue;

    // Each allowance is linked to a member via relation
    for (const memberId of allowance.memberIds) {
      const member = memberMap.get(memberId);
      if (!member) {
        errors.push(`Allowance "${allowance.description}" — member ${memberId} not found`);
        continue;
      }

      // Resolve Notion workspace user ID for the person field
      const notionUserId = notionUserMap.get(member.email.toLowerCase());

      const entryDescription = `${allowance.description} — ${monthLabel}`;
      const dedupeKey = `${entryDescription.toLowerCase()}|${dateStr}`;

      if (existingKeys.has(dedupeKey)) {
        skipped++;
        continue;
      }

      try {
        await createTimesheet({
          entry: entryDescription,
          type: "reimbursement",
          amount: allowance.amount,
          status: "draft",
          billable: false,
          dateAndTime: { start: dateStr, end: null },
          ...(notionUserId ? { personIds: [notionUserId] } : {}),
          explanation: `[allowance:${allowance.id}] ${allowance.category}: ${allowance.notes || allowance.description}`,
        });
        created++;
      } catch (err) {
        errors.push(
          `Failed to create reimbursement for "${allowance.description}" (${member.name}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return NextResponse.json({
    message: `synced ${created} allowance reimbursements for ${monthLabel}`,
    created,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    totalAllowances: allowances.length,
  });
}
