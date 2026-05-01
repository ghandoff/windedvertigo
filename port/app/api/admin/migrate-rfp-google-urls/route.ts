/**
 * GET /api/admin/migrate-rfp-google-urls
 *
 * One-time (idempotent) migration: finds all RFP opportunities whose URL
 * field is a google.com/url redirect and replaces it with the real
 * destination URL extracted from the `url=` or `q=` query parameter.
 *
 * These arrive verbatim from Feedly/RSS Google News feeds and are stored
 * without unwrapping. Opening them outside Gmail shows "Redirect Notice –
 * The previous page is sending you to an invalid url."
 *
 * Auth: Authorization: Bearer {CRON_SECRET}
 */

import { NextRequest, NextResponse } from "next/server";
import { sanitiseIngestUrl } from "@/lib/ai/rfp-ingest";
import { getAllRfpOpportunities, updateRfpOpportunity } from "@/lib/notion/rfp-radar";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

interface MigrationRecord {
  id: string;
  name: string;
  original: string;
  resolved: string;
  result: "updated" | "skipped" | "error";
  error?: string;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const all = await getAllRfpOpportunities();
  const candidates = all.filter((o) => o.url?.includes("google.com/url"));

  if (candidates.length === 0) {
    return NextResponse.json({
      scanned: all.length,
      migrated: 0,
      message: "nothing to migrate",
    });
  }

  const results: MigrationRecord[] = [];

  for (const opp of candidates) {
    const original = opp.url!;
    const resolved = sanitiseIngestUrl(original) ?? original;

    if (resolved === original) {
      results.push({ id: opp.id, name: opp.opportunityName, original, resolved, result: "skipped" });
      continue;
    }

    try {
      await updateRfpOpportunity(opp.id, { url: resolved });
      results.push({ id: opp.id, name: opp.opportunityName, original, resolved, result: "updated" });
    } catch (err) {
      results.push({
        id: opp.id,
        name: opp.opportunityName,
        original,
        resolved,
        result: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const migrated = results.filter((r) => r.result === "updated").length;
  const skipped = results.filter((r) => r.result === "skipped").length;
  const errors = results.filter((r) => r.result === "error").length;

  return NextResponse.json({
    scanned: all.length,
    candidates: candidates.length,
    migrated,
    skipped,
    errors,
    results,
  });
}
