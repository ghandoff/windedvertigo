/**
 * GET /api/runs/export?format=csv|pdf — export runs for reporting.
 *
 * Session 12: run export / reporting.
 *
 * Generates either a CSV download or a branded PDF report of all
 * visible runs for the authenticated user. Respects the same
 * visibility model as the runs list page — admins see everything,
 * org members see their org's runs, external users see only their own.
 *
 * Reflective fields (what_changed, next_iteration) are stripped for
 * external users viewing other people's runs, matching the existing
 * API sanitisation logic.
 */

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { requireAuth } from "@/lib/auth-helpers";
import { getRunsForExport } from "@/lib/queries/runs";
import { logAccess } from "@/lib/queries/audit";

export async function GET(req: NextRequest) {
  const session = await requireAuth();
  const format = req.nextUrl.searchParams.get("format") || "csv";

  if (format !== "csv" && format !== "pdf") {
    return NextResponse.json(
      { error: "format must be csv or pdf" },
      { status: 400 },
    );
  }

  // Audit-2 M2: cap export to 500 rows to prevent OOM on Vercel serverless
  const EXPORT_LIMIT = 500;
  const runs = await getRunsForExport(session, EXPORT_LIMIT);
  const truncated = runs.length === EXPORT_LIMIT;

  // audit log
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  await logAccess(
    session.userId,
    session.orgId,
    null,
    null,
    `export_runs_${format}`,
    ip,
    [],
    { count: runs.length, truncated: truncated ? 1 : 0 },
  );

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD

  if (format === "csv") {
    return buildCsv(runs, session.isInternal, dateStr);
  }
  return buildPdf(runs, session, dateStr, now);
}

/* ------------------------------------------------------------------ */
/*  CSV builder                                                        */
/* ------------------------------------------------------------------ */

function escCsv(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(
  runs: Awaited<ReturnType<typeof getRunsForExport>>,
  isInternal: boolean,
  dateStr: string,
): NextResponse {
  // columns — reflective fields included conditionally
  const headers = [
    "title",
    "playdate",
    "context_of_use",
    "date",
    "context_tags",
    "trace_evidence",
    "materials",
    ...(isInternal ? ["what_changed", "next_iteration"] : []),
  ];

  const rows = runs.map((r) => [
    escCsv(r.title),
    escCsv(r.playdate_title),
    escCsv(r.run_type),
    escCsv(r.run_date),
    escCsv(
      Array.isArray(r.context_tags)
        ? r.context_tags.join("; ")
        : r.context_tags,
    ),
    escCsv(
      Array.isArray(r.trace_evidence)
        ? r.trace_evidence.join("; ")
        : r.trace_evidence,
    ),
    escCsv(r.materials_list),
    ...(isInternal
      ? [escCsv(r.what_changed), escCsv(r.next_iteration)]
      : []),
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="creaseworks-reflections-${dateStr}.csv"`,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  PDF builder                                                        */
/* ------------------------------------------------------------------ */

async function buildPdf(
  runs: Awaited<ReturnType<typeof getRunsForExport>>,
  session: { email: string; orgName: string | null; isInternal: boolean },
  dateStr: string,
  now: Date,
): Promise<NextResponse> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 50;
  const maxWidth = pageWidth - margin * 2;
  const cadet = rgb(0.153, 0.196, 0.282); // #273248
  const redwood = rgb(0.694, 0.314, 0.263); // #b15043
  const grey = rgb(0.5, 0.5, 0.5);
  const lightGrey = rgb(0.85, 0.85, 0.85);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  /* ---- helper: wrap and draw text, returns new y ---- */
  function drawText(
    text: string,
    x: number,
    startY: number,
    size: number,
    usedFont: typeof font,
    colour: typeof cadet,
    lineHeight: number = size * 1.4,
  ): number {
    const words = text.split(/\s+/);
    let line = "";
    let currentY = startY;

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      const width = usedFont.widthOfTextAtSize(test, size);
      if (width > maxWidth && line) {
        if (currentY < margin + 40) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;
        }
        page.drawText(line, {
          x,
          y: currentY,
          size,
          font: usedFont,
          color: colour,
        });
        currentY -= lineHeight;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      if (currentY < margin + 40) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }
      page.drawText(line, {
        x,
        y: currentY,
        size,
        font: usedFont,
        color: colour,
      });
      currentY -= lineHeight;
    }
    return currentY;
  }

  /* ---- helper: draw a thin horizontal rule ---- */
  function drawRule(startY: number): number {
    if (startY < margin + 40) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      startY = pageHeight - margin;
    }
    page.drawLine({
      start: { x: margin, y: startY },
      end: { x: pageWidth - margin, y: startY },
      thickness: 0.5,
      color: lightGrey,
    });
    return startY - 12;
  }

  /* ---- header ---- */
  y = drawText(
    session.orgName || "creaseworks",
    margin,
    y,
    20,
    fontBold,
    cadet,
  );
  y -= 2;
  y = drawText("reflections report", margin, y, 14, fontItalic, redwood);
  y -= 2;
  y = drawText(`generated ${dateStr}`, margin, y, 9, font, grey);
  y -= 16;

  /* ---- summary section ---- */
  y = drawText("SUMMARY", margin, y, 9, fontBold, redwood);
  y -= 2;
  y = drawText(`total reflections: ${runs.length}`, margin, y, 10, font, cadet);

  // runs by type breakdown
  const typeCounts: Record<string, number> = {};
  for (const r of runs) {
    const t = r.run_type || "unspecified";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const typeList = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([t, c]) => `${t} (${c})`)
    .join(", ");
  if (typeList) {
    y = drawText(`by type: ${typeList}`, margin, y, 10, font, cadet);
  }

  // top playdates
  const playdateCounts: Record<string, number> = {};
  for (const r of runs) {
    if (r.playdate_title) {
      playdateCounts[r.playdate_title] =
        (playdateCounts[r.playdate_title] || 0) + 1;
    }
  }
  const topPlaydates = Object.entries(playdateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([p, c]) => `${p} (${c})`)
    .join(", ");
  if (topPlaydates) {
    y = drawText(
      `top playdates: ${topPlaydates}`,
      margin,
      y,
      10,
      font,
      cadet,
    );
  }

  y -= 12;
  y = drawRule(y);
  y -= 4;

  /* ---- run details ---- */
  y = drawText("REFLECTION DETAILS", margin, y, 9, fontBold, redwood);
  y -= 4;

  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];

    // ensure we have space for at least a run header + a couple of lines
    if (y < margin + 80) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }

    // run title + date
    const dateLabel = r.run_date
      ? ` — ${r.run_date}`
      : "";
    y = drawText(
      `${r.title}${dateLabel}`,
      margin,
      y,
      11,
      fontBold,
      cadet,
    );

    // playdate + type
    const meta: string[] = [];
    if (r.playdate_title) meta.push(`playdate: ${r.playdate_title}`);
    if (r.run_type) meta.push(`type: ${r.run_type}`);
    if (meta.length) {
      y = drawText(meta.join("  ·  "), margin, y, 9, font, grey);
    }

    // context tags
    const tags = Array.isArray(r.context_tags)
      ? r.context_tags.join(", ")
      : r.context_tags;
    if (tags && String(tags).length > 0) {
      y = drawText(`context: ${tags}`, margin, y, 9, font, grey);
    }

    // trace evidence
    const evidence = Array.isArray(r.trace_evidence)
      ? r.trace_evidence.join(", ")
      : r.trace_evidence;
    if (evidence && String(evidence).length > 0) {
      y = drawText(`evidence: ${evidence}`, margin, y, 9, font, grey);
    }

    // materials
    if (r.materials_list) {
      y = drawText(
        `materials: ${r.materials_list}`,
        margin,
        y,
        9,
        font,
        grey,
      );
    }

    // reflective fields (only if present — already sanitised by query)
    if (r.what_changed) {
      y = drawText("what changed:", margin, y, 9, fontBold, cadet);
      y = drawText(r.what_changed, margin + 8, y, 9, font, cadet);
    }
    if (r.next_iteration) {
      y = drawText("next iteration:", margin, y, 9, fontBold, cadet);
      y = drawText(r.next_iteration, margin + 8, y, 9, font, cadet);
    }

    y -= 6;

    // separator between runs
    if (i < runs.length - 1) {
      y = drawRule(y);
      y -= 2;
    }
  }

  /* ---- watermark on every page ---- */
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();
  const watermark = [
    session.orgName || "personal",
    session.email,
    `${dd}/${mm}/${yyyy}`,
  ].join("  ·  ");

  const pages = pdfDoc.getPages();
  for (const pg of pages) {
    pg.drawText(watermark, {
      x: margin,
      y: 20,
      size: 7,
      font,
      color: rgb(0.7, 0.7, 0.7),
    });
    pg.drawText("creaseworks · windedvertigo.com", {
      x: margin,
      y: 10,
      size: 6,
      font: fontItalic,
      color: rgb(0.8, 0.8, 0.8),
    });
  }

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="creaseworks-reflections-${dateStr}.pdf"`,
    },
  });
}
