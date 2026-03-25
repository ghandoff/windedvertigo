/**
 * POST /api/generate-pdfs
 *
 * Generates branded PDF packages for each quadrant and uploads to R2.
 * Called weekly by Vercel cron (vercel.json) or manually for testing.
 *
 * Auth: requires ?token= matching CRON_SECRET env var.
 */

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { fetchPackageBuilderData } from "@/lib/notion";
import { uploadBuffer, getPublicUrl } from "@/lib/r2";
import { PackagePDF } from "@/lib/pdf/package-template";

export const maxDuration = 30; // seconds — generous for 4 PDF renders + uploads
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Auth check
  const token = request.nextUrl.searchParams.get("token");
  const secret = process.env.CRON_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const packs = await fetchPackageBuilderData();
    const results: { quadrant: string; key: string; url: string; bytes: number }[] = [];

    for (const [quadrantKey, pack] of Object.entries(packs)) {
      // Render PDF to buffer
      const buffer = await renderToBuffer(
        <PackagePDF pack={pack} quadrantKey={quadrantKey} />
      );

      // Upload to R2
      const r2Key = `package-pdfs/${quadrantKey}.pdf`;
      await uploadBuffer(r2Key, Buffer.from(buffer), "application/pdf");

      results.push({
        quadrant: quadrantKey,
        key: r2Key,
        url: getPublicUrl(r2Key),
        bytes: buffer.byteLength,
      });
    }

    return NextResponse.json({
      ok: true,
      generated: results.length,
      pdfs: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[generate-pdfs] failed:", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
