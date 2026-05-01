/**
 * POST /api/rfp-radar/[id]/re-enrich
 *
 * Re-runs URL enrichment for an existing RFP opportunity on demand.
 * Useful when auto-discovery was skipped at ingest time (e.g. triage produced
 * a good snapshot so the enrichFromUrl guard fired early) or when the source
 * page has since been updated with a TOR/PDF link.
 *
 * Only fills fields that are still empty or sparse — never overwrites manually
 * entered data (due date, requirements snapshot, rfpDocumentUrl).
 *
 * Returns: { ok, found: { dueDate?, torDocumentUrl?, requirementsSnapshot? } }
 */

import { NextRequest, NextResponse } from "next/server";
import { enrichFromUrl } from "@/lib/ai/rfp-ingest";
import { getRfpOpportunity, updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import { auth } from "@/lib/auth";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rfp;
  try {
    rfp = await getRfpOpportunity(id);
  } catch {
    return NextResponse.json({ error: "rfp not found" }, { status: 404 });
  }

  if (!rfp.url?.startsWith("http")) {
    return NextResponse.json(
      { ok: false, error: "no valid source URL — cannot enrich" },
      { status: 422 },
    );
  }

  let enriched;
  try {
    // Pass empty/undefined for existing values so all three needs* flags are true,
    // guaranteeing the page is fetched regardless of what triage already found.
    enriched = await enrichFromUrl(rfp.url, undefined, "", false);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "enrichment failed";
    console.error("[re-enrich] enrichFromUrl threw:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  if (!enriched.dueDate && !enriched.requirementsSnapshot && !enriched.torDocumentUrl) {
    return NextResponse.json({ ok: false, message: "source page had no new data to extract" });
  }

  // Only apply fields that are still empty/sparse on the record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: Record<string, any> = {};
  const found: Record<string, string> = {};

  if (enriched.torDocumentUrl && !rfp.rfpDocumentUrl) {
    updates.rfpDocumentUrl = enriched.torDocumentUrl;
    found.torDocumentUrl = enriched.torDocumentUrl;
  }
  if (enriched.dueDate && !rfp.dueDate?.start) {
    updates.dueDate = { start: enriched.dueDate, end: null };
    found.dueDate = enriched.dueDate;
  }
  if (enriched.requirementsSnapshot && (!rfp.requirementsSnapshot || rfp.requirementsSnapshot.length < 80)) {
    updates.requirementsSnapshot = enriched.requirementsSnapshot;
    found.requirementsSnapshot = enriched.requirementsSnapshot;
  }

  if (Object.keys(updates).length > 0) {
    try {
      await updateRfpOpportunity(id, updates);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "notion update failed";
      console.error("[re-enrich] notion update failed:", msg);
      return NextResponse.json(
        { ok: false, error: `enrichment found data but Notion update failed: ${msg}`, found },
        { status: 207 },
      );
    }
  }

  return NextResponse.json({ ok: true, found });
}
