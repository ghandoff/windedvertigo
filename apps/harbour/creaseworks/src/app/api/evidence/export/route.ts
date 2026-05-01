/**
 * GET /api/evidence/export?format=pdf&playdate=slug&type=photo
 *
 * Generates a branded PDF of the user's evidence portfolio.
 * Auth required. Practitioner tier feature.
 *
 * Query params:
 *   format   — only "pdf" for now (default: pdf)
 *   type     — filter by evidence type
 *   playdate — filter by playdate slug
 *
 * Phase D — evidence export (practitioner tier).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import {
  getPortfolioEvidence,
  type EvidenceType,
} from "@/lib/queries/evidence";
import { getObjectBytes } from "@/lib/r2";
import { buildEvidencePdf, type EvidencePdfItem } from "@/lib/pdf/evidence-pdf";
import { logAccess } from "@/lib/queries/audit";

const VALID_TYPES = new Set<EvidenceType>(["photo", "quote", "observation", "artifact"]);

/** Cap items to keep PDF size reasonable on Vercel serverless. */
const EXPORT_LIMIT = 50;

export async function GET(req: NextRequest) {
  const session = await requireAuth();

  const url = req.nextUrl;
  const format = url.searchParams.get("format") || "pdf";

  if (format !== "pdf") {
    return NextResponse.json(
      { error: "format must be pdf" },
      { status: 400 },
    );
  }

  const typeParam = url.searchParams.get("type") as EvidenceType | null;
  const playdateSlug = url.searchParams.get("playdate");

  if (typeParam && !VALID_TYPES.has(typeParam)) {
    return NextResponse.json(
      { error: `type must be one of: ${[...VALID_TYPES].join(", ")}` },
      { status: 400 },
    );
  }

  // Fetch evidence items
  const items = await getPortfolioEvidence(session.userId, {
    evidenceType: typeParam ?? undefined,
    playdateSlug: playdateSlug ?? undefined,
    limit: EXPORT_LIMIT,
    offset: 0,
  });

  if (items.length === 0) {
    return NextResponse.json(
      { error: "no evidence to export" },
      { status: 404 },
    );
  }

  // Fetch photo bytes from R2 for embedding
  const enriched: EvidencePdfItem[] = await Promise.all(
    items.map(async (item) => {
      if (item.evidence_type === "photo" && item.storage_key) {
        const photoBytes = await getObjectBytes(item.storage_key);
        const ext = item.storage_key.split(".").pop()?.toLowerCase();
        const photoMime = ext === "png" ? "image/png" : "image/jpeg";
        return { ...item, photoBytes, photoMime };
      }
      return { ...item, photoBytes: null, photoMime: null };
    }),
  );

  // Build PDF
  const pdfBytes = await buildEvidencePdf(enriched, {
    orgName: session.orgName,
    email: session.email,
    filters: {
      type: typeParam,
      playdate: playdateSlug,
    },
  });

  // Audit log
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    null,
    null,
    "export_evidence_pdf",
    ip,
    [],
    {
      count: items.length,
      ...(typeParam ? { filter_type: typeParam } : {}),
      ...(playdateSlug ? { filter_playdate: playdateSlug } : {}),
    },
  );

  const dateStr = new Date().toISOString().slice(0, 10);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="creaseworks-evidence-${dateStr}.pdf"`,
    },
  });
}
