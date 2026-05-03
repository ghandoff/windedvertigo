/**
 * POST /api/admin/backfill-rfp-timezones
 *
 * One-shot backfill: for every rfp_opportunities row where
 * deadline_timezone IS NULL and requirements_snapshot IS NOT NULL,
 * ask Claude to extract the funder's IANA timezone and write it back.
 *
 * Uses a lightweight prompt — only extracts the timezone, not the
 * full triage fields. Processes up to `limit` records (default 50)
 * with CONCURRENCY parallel Claude calls to stay within rate limits.
 *
 * Safe to run multiple times (idempotent — skips rows that already
 * have a timezone).
 *
 * Auth: Bearer CRON_SECRET header required.
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase/client";
import { setDeadlineTimezone } from "@/lib/supabase/rfp-opportunities";

const CONCURRENCY = 3;
const DEFAULT_LIMIT = 50;

const client = new Anthropic();

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  return (authHeader?.replace("Bearer ", "") ?? "") === process.env.CRON_SECRET;
}

/**
 * Ask Claude for just the IANA timezone of the issuing organization.
 * Returns null if it cannot be determined or if the snapshot is too thin.
 */
async function extractTimezone(snapshot: string): Promise<string | null> {
  if (!snapshot || snapshot.trim().length < 30) return null;

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 64,
    messages: [
      {
        role: "user",
        content: `Based on this RFP/EOI announcement, what is the IANA timezone of the issuing organization?

Examples: "Europe/Copenhagen", "America/New_York", "Africa/Nairobi", "Asia/Manila"

Return ONLY the IANA timezone string (e.g. "Europe/Copenhagen") or the word null if you cannot determine it with confidence. No explanation.

Announcement:
${snapshot.slice(0, 1200)}`,
      },
    ],
  });

  const raw = (response.content[0] as { type: string; text?: string }).text?.trim() ?? "";
  if (!raw || raw.toLowerCase() === "null" || !raw.includes("/")) return null;

  // Validate it looks like a real IANA timezone (Continent/City format)
  if (!/^[A-Za-z_]+\/[A-Za-z_]+/.test(raw)) return null;

  // Basic sanity check via Intl
  try {
    Intl.DateTimeFormat(undefined, { timeZone: raw });
    return raw;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const limit = Math.min(Number(body.limit ?? DEFAULT_LIMIT), 200);
  const dryRun = body.dryRun === true;

  // Fetch rows that still need a timezone
  const { data: rows, error } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, requirements_snapshot")
    .is("deadline_timezone", null)
    .not("requirements_snapshot", "is", null)
    .neq("requirements_snapshot", "")
    .limit(limit)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = rows?.length ?? 0;
  if (total === 0) {
    return NextResponse.json({ message: "nothing to backfill", total: 0 });
  }

  // Process in batches of CONCURRENCY to respect API rate limits
  const results: Array<{
    id: string;
    name: string;
    timezone: string | null;
    status: "updated" | "null" | "skipped" | "error";
  }> = [];

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (row) => {
        const id = row.notion_page_id as string;
        const name = row.opportunity_name as string;
        const snapshot = row.requirements_snapshot as string;

        try {
          const timezone = await extractTimezone(snapshot);
          if (timezone && !dryRun) {
            await setDeadlineTimezone(id, timezone);
          }
          return {
            id,
            name,
            timezone,
            status: (timezone ? "updated" : "null") as "updated" | "null",
          };
        } catch (err) {
          console.warn(`[backfill-rfp-timezones] failed for ${id}:`, err);
          return { id, name, timezone: null, status: "error" as const };
        }
      }),
    );
    results.push(...batchResults);
  }

  const updated = results.filter((r) => r.status === "updated").length;
  const nullCount = results.filter((r) => r.status === "null").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    total,
    updated,
    null: nullCount,
    errors,
    dryRun,
    results: results.map((r) => ({ id: r.id, name: r.name, timezone: r.timezone, status: r.status })),
  });
}
